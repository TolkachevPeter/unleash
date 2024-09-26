import User, { IUser } from '../types/user';
import { AccessService } from './access-service';
import NameExistsError from '../error/name-exists-error';
import InvalidOperationError from '../error/invalid-operation-error';
import { nameType } from '../routes/util';
import { projectSchema } from './project-schema';
import NotFoundError from '../error/notfound-error';
import {
    PROJECT_CREATED,
    PROJECT_DELETED,
    PROJECT_UPDATED,
    ProjectUserAddedEvent,
    ProjectUserRemovedEvent,
    ProjectUserUpdateRoleEvent,
    ProjectGroupAddedEvent,
    ProjectGroupRemovedEvent,
    ProjectGroupUpdateRoleEvent,
} from '../types/events';
import { IUnleashStores } from '../types';
import { IUnleashConfig } from '../types/option';
import {
    FeatureToggle,
    IProject,
    IProjectOverview,
    IProjectWithCount,
    IUserWithRole,
    RoleName,
} from '../types/model';
import { IEnvironmentStore } from '../types/stores/environment-store';
import { IFeatureTypeStore } from '../types/stores/feature-type-store';
import { IFeatureToggleStore } from '../types/stores/feature-toggle-store';
import { IFeatureEnvironmentStore } from '../types/stores/feature-environment-store';
import { IProjectQuery, IProjectStore } from '../types/stores/project-store';
import {
    IProjectAccessModel,
    IRoleDescriptor,
} from '../types/stores/access-store';
import { IEventStore } from '../types/stores/event-store';
import FeatureToggleService from './feature-toggle-service';
import { MOVE_FEATURE_TOGGLE } from '../types/permissions';
import NoAccessError from '../error/no-access-error';
import IncompatibleProjectError from '../error/incompatible-project-error';
import { DEFAULT_PROJECT } from '../types/project';
import { IFeatureTagStore } from 'lib/types/stores/feature-tag-store';
import ProjectWithoutOwnerError from '../error/project-without-owner-error';
import { IUserStore } from 'lib/types/stores/user-store';
import { arraysHaveSameItems } from '../util/arraysHaveSameItems';
import { GroupService } from './group-service';
import { IGroupModelWithProjectRole, IGroupRole } from 'lib/types/group';
import { CronJob } from 'cron';
import { subMonths, isBefore, subWeeks } from 'date-fns';
import { EmailService } from './email-service';

const getCreatedBy = (user: IUser) => user.email || user.username;

export interface AccessWithRoles {
    users: IUserWithRole[];
    roles: IRoleDescriptor[];
    groups: IGroupModelWithProjectRole[];
}

export default class ProjectService {
    private store: IProjectStore;

    private accessService: AccessService;

    private eventStore: IEventStore;

    private featureToggleStore: IFeatureToggleStore;

    private featureTypeStore: IFeatureTypeStore;

    private featureEnvironmentStore: IFeatureEnvironmentStore;

    private environmentStore: IEnvironmentStore;

    private groupService: GroupService;

    private logger: any;

    private featureToggleService: FeatureToggleService;

    private tagStore: IFeatureTagStore;

    private userStore: IUserStore;

    private emailService: EmailService;

    constructor(
        {
            projectStore,
            eventStore,
            featureToggleStore,
            featureTypeStore,
            environmentStore,
            featureEnvironmentStore,
            featureTagStore,
            userStore,
        }: Pick<
            IUnleashStores,
            | 'projectStore'
            | 'eventStore'
            | 'featureToggleStore'
            | 'featureTypeStore'
            | 'environmentStore'
            | 'featureEnvironmentStore'
            | 'featureTagStore'
            | 'userStore'
        >,
        config: IUnleashConfig,
        accessService: AccessService,
        featureToggleService: FeatureToggleService,
        groupService: GroupService,
        emailService: EmailService,
    ) {
        this.store = projectStore;
        this.environmentStore = environmentStore;
        this.featureEnvironmentStore = featureEnvironmentStore;
        this.accessService = accessService;
        this.eventStore = eventStore;
        this.featureToggleStore = featureToggleStore;
        this.featureTypeStore = featureTypeStore;
        this.featureToggleService = featureToggleService;
        this.tagStore = featureTagStore;
        this.userStore = userStore;
        this.groupService = groupService;
        this.emailService = emailService;
        this.logger = config.getLogger('services/project-service.js');
        this.scheduleUnusedToggleNotifications();
        if (
            process.env.CHECK_OLD_ENABLED_TOGGLES === 'true' ||
            process.env.CHECK_OLD_ENABLED_TOGGLES === 'TRUE'
        ) {
            this.scheduleOldEnabledToggleNotifications();
        }
    }

    private scheduleOldEnabledToggleNotifications(): void {
        // const job = new CronJob('0 9 * * 1,3', async () => {
        const job = new CronJob(
            process.env.CRON_OLD_ENABLED_TOGGLES || '30 * * * *',
            async () => {
                await this.sendOldEnabledFeatureToggleNotifications();
            },
        );
        job.start();
        this.logger.info(
            'Scheduled old enabled toggles notifications (Mon, Wed at 09:00).',
        );
    }

    public async sendOldEnabledFeatureToggleNotifications(): Promise<void> {
        try {
            const allToggles = await this.featureToggleStore.getAll({
                archived: false,
            });

            const releaseToggles = allToggles.filter(
                (toggle) => toggle.type === 'release',
            );

            const twoWeeksAgo = subWeeks(new Date(), 2);

            const oldEnabledToggles: FeatureToggle[] = [];

            for (const toggle of releaseToggles) {
                const lastEnabledAt = toggle.lastEnabledAt;

                if (
                    lastEnabledAt &&
                    isBefore(new Date(lastEnabledAt), twoWeeksAgo)
                ) {
                    try {
                        const envInfo =
                            await this.featureToggleService.getEnvironmentInfo(
                                toggle.project,
                                'production',
                                toggle.name,
                            );

                        if (envInfo.enabled) {
                            oldEnabledToggles.push(toggle);
                        }
                    } catch (error) {
                        this.logger.warn(
                            `Не удалось получить информацию об окружении 'production' для тоггла ${toggle.name}:`,
                            error,
                        );
                    }
                }
            }

            const togglesByProject = oldEnabledToggles.reduce((acc, toggle) => {
                if (!acc[toggle.project]) {
                    acc[toggle.project] = [];
                }
                acc[toggle.project].push(toggle);
                return acc;
            }, {} as Record<string, FeatureToggle[]>);

            for (const [projectId, toggles] of Object.entries(
                togglesByProject,
            )) {
                const teamEmails = await this.getProjectMemberEmails(projectId);

                if (teamEmails.length > 0) {
                    const emailContent =
                        this.generateEmailContentForRealiseOldToggles(
                            toggles,
                            projectId,
                        );

                    const ccEmails = 'peter.tolkachev@tolkachev.ru';

                    await this.emailService.sendOldEnabledTogglesNotification(
                        teamEmails,
                        ccEmails,
                        emailContent.subject,
                        emailContent.html,
                        emailContent.text,
                    );

                    this.logger.info(
                        `Отправлено уведомление о старых включенных toggles для проекта ${projectId} на адреса: ${teamEmails.join(
                            ', ',
                        )}`,
                    );
                } else {
                    this.logger.warn(
                        `Не найдено email-адресов участников для проекта ${projectId}, пропуск уведомления.`,
                    );
                }
            }
        } catch (error) {
            this.logger.error(
                'Не удалось отправить уведомления о старых включенных feature toggles:',
                error,
            );
        }
    }

    private generateEmailContentForRealiseOldToggles(
        toggles: FeatureToggle[],
        projectId: string,
    ): {
        subject: string;
        html: string;
        text: string;
    } {
        const toggleListHtml = toggles
            .map((toggle) => `<li>${toggle.name}</li>`)
            .join('');
        const toggleListText = toggles
            .map((toggle) => `- ${toggle.name}`)
            .join('\n');

        const projectName = toggles[0]?.project || projectId;

        const subject = `Unleash. Old enabled feature-toggles of "${projectName}"`;

        const htmlContent = `
            <p>Добрый день.</p>
            <p>Перечисленные в данном письме фича-тоглы были включены в Проде более двух недель назад:</p>
            <ul>
                ${toggleListHtml}
            </ul>
            <p>Рекомендуется начать работы по удалению данных фича-тоглов из кода и из Unleash.</p>
            <p>Если удаление по каким-то причинам еще не может быть выполнено, просьба сообщить об этих причинах в ответном письме на группу <a href="mailto:peter.tolkachev@gmail.com">peter.tolkachev@gmail.com</a>.</p>
        `;

        const textContent = `
Добрый день.

Перечисленные в данном письме фича-тоглы были включены в Проде более двух недель назад:

${toggleListText}

Рекомендуется начать работы по удалению данных фича-тоглов из кода и из Unleash.

Если удаление по каким-то причинам еще не может быть выполнено, просьба сообщить об этих причинах в ответном письме на группу peter.tolkachev@gmail.com.

        `;

        return {
            subject,
            html: htmlContent,
            text: textContent,
        };
    }

    private scheduleUnusedToggleNotifications(): void {
        const job = new CronJob(
            '0 12 * * *',
            async () => {
                this.logger.info(
                    'Running scheduled task: sendUnusedFeatureToggleNotifications',
                );
                await this.sendUnusedFeatureToggleNotifications();
            },
            null,
            true,
            'Europe/Moscow',
        );

        job.start();
    }

    public async sendUnusedFeatureToggleNotifications(): Promise<void> {
        try {
            const allToggles = await this.featureToggleStore.getAll({
                archived: false,
            });

            const unusedToggles = allToggles.filter(
                (toggle) => !toggle.lastSeenAt,
            );

            const twoMonthsAgo = subMonths(new Date(), 2);
            const oldUnusedToggles = unusedToggles.filter((toggle) =>
                isBefore(new Date(toggle.createdAt), twoMonthsAgo),
            );

            const togglesByProject = oldUnusedToggles.reduce((acc, toggle) => {
                if (!acc[toggle.project]) {
                    acc[toggle.project] = [];
                }
                acc[toggle.project].push(toggle);
                return acc;
            }, {} as Record<string, FeatureToggle[]>);

            for (const [projectId, toggles] of Object.entries(
                togglesByProject,
            )) {
                const teamEmails = await this.getProjectMemberEmails(projectId);

                if (teamEmails.length > 0) {
                    const emailContent = this.generateEmailContent(
                        toggles,
                        teamEmails,
                    );

                    await this.emailService.sendUnusedTogglesNotification(
                        teamEmails,
                        emailContent,
                    );

                    this.logger.info(
                        `Отправлено уведомление о неиспользуемых toggles для проекта ${projectId} на адреса: ${teamEmails.join(
                            ', ',
                        )}`,
                    );
                } else {
                    this.logger.warn(
                        `Не найдено email-адресов участников для проекта ${projectId}, пропуск уведомления.`,
                    );
                }
            }
        } catch (error) {
            this.logger.error(
                'Не удалось отправить уведомления о неиспользуемых feature toggles:',
                error,
            );
        }
    }

    private generateEmailContent(
        toggles: FeatureToggle[],
        teamEmails: string[],
    ): string {
        const toggleListText = toggles
            .map((toggle) => `- ${toggle.name}`)
            .join('\n');

        const textContent = `
Hello,

The following feature toggles have not been used and are older than two months:

${toggleListText}

Please consider reviewing or archiving these toggles.

Sent with teamEmails: ${teamEmails}

    `;

        return textContent;
    }

    private async getProjectMemberEmails(projectId: string): Promise<string[]> {
        const allEmails = new Set<string>();

        const [roles, usersWithRoles, groupsWithRoles] =
            await this.accessService.getProjectRoleAccess(projectId);

        for (const role of roles) {
            for (const user of usersWithRoles) {
                if (user.roleId === role.id && user.email) {
                    allEmails.add(user.email);
                }
            }

            for (const group of groupsWithRoles) {
                if (group.roleId === role.id) {
                    const groupDetails = await this.groupService.getGroup(
                        group.id,
                    );
                    for (const groupUser of groupDetails.users) {
                        if (groupUser.user.email) {
                            allEmails.add(groupUser.user.email);
                        }
                    }
                }
            }
        }

        return Array.from(allEmails);
    }

    async getProjects(query?: IProjectQuery): Promise<IProjectWithCount[]> {
        return this.store.getProjectsWithCounts(query);
    }

    async getProject(id: string): Promise<IProject> {
        return this.store.get(id);
    }

    async createProject(
        newProject: Pick<IProject, 'id' | 'name'>,
        user: IUser,
    ): Promise<IProject> {
        const data = await projectSchema.validateAsync(newProject);
        await this.validateUniqueId(data.id);

        await this.store.create(data);

        const enabledEnvironments = await this.environmentStore.getAll({
            enabled: true,
        });

        // TODO: Only if enabled!
        await Promise.all(
            enabledEnvironments.map(async (e) => {
                await this.featureEnvironmentStore.connectProject(
                    e.name,
                    data.id,
                );
            }),
        );

        await this.accessService.createDefaultProjectRoles(user, data.id);

        await this.eventStore.store({
            type: PROJECT_CREATED,
            createdBy: getCreatedBy(user),
            data,
            project: newProject.id,
        });

        return data;
    }

    async updateProject(updatedProject: IProject, user: User): Promise<void> {
        const preData = await this.store.get(updatedProject.id);
        const project = await projectSchema.validateAsync(updatedProject);

        await this.store.update(project);

        await this.eventStore.store({
            type: PROJECT_UPDATED,
            project: project.id,
            createdBy: getCreatedBy(user),
            data: project,
            preData,
        });
    }

    async checkProjectsCompatibility(
        feature: FeatureToggle,
        newProjectId: string,
    ): Promise<boolean> {
        const featureEnvs = await this.featureEnvironmentStore.getAll({
            feature_name: feature.name,
        });
        const newEnvs = await this.store.getEnvironmentsForProject(
            newProjectId,
        );
        return arraysHaveSameItems(
            featureEnvs.map((env) => env.environment),
            newEnvs,
        );
    }

    async changeProject(
        newProjectId: string,
        featureName: string,
        user: User,
        currentProjectId: string,
    ): Promise<any> {
        const feature = await this.featureToggleStore.get(featureName);

        if (feature.project !== currentProjectId) {
            throw new NoAccessError(MOVE_FEATURE_TOGGLE);
        }
        const project = await this.getProject(newProjectId);

        if (!project) {
            throw new NotFoundError(`Project ${newProjectId} not found`);
        }

        const authorized = await this.accessService.hasPermission(
            user,
            MOVE_FEATURE_TOGGLE,
            newProjectId,
        );

        if (!authorized) {
            throw new NoAccessError(MOVE_FEATURE_TOGGLE);
        }

        const isCompatibleWithTargetProject =
            await this.checkProjectsCompatibility(feature, newProjectId);
        if (!isCompatibleWithTargetProject) {
            throw new IncompatibleProjectError(newProjectId);
        }
        const updatedFeature = await this.featureToggleService.changeProject(
            featureName,
            newProjectId,
            getCreatedBy(user),
        );
        await this.featureToggleService.updateFeatureStrategyProject(
            featureName,
            newProjectId,
        );

        return updatedFeature;
    }

    async deleteProject(id: string, user: User): Promise<void> {
        if (id === DEFAULT_PROJECT) {
            throw new InvalidOperationError(
                'You can not delete the default project!',
            );
        }

        const toggles = await this.featureToggleStore.getAll({
            project: id,
            archived: false,
        });

        if (toggles.length > 0) {
            throw new InvalidOperationError(
                'You can not delete a project with active feature toggles',
            );
        }

        await this.store.delete(id);

        await this.eventStore.store({
            type: PROJECT_DELETED,
            createdBy: getCreatedBy(user),
            project: id,
        });

        await this.accessService.removeDefaultProjectRoles(user, id);
    }

    async validateId(id: string): Promise<boolean> {
        await nameType.validateAsync(id);
        await this.validateUniqueId(id);
        return true;
    }

    async validateUniqueId(id: string): Promise<void> {
        const exists = await this.store.hasProject(id);
        if (exists) {
            throw new NameExistsError('A project with this id already exists.');
        }
    }

    // RBAC methods
    async getAccessToProject(projectId: string): Promise<AccessWithRoles> {
        const [roles, users, groups] =
            await this.accessService.getProjectRoleAccess(projectId);

        return {
            roles,
            users,
            groups,
        };
    }

    async addUser(
        projectId: string,
        roleId: number,
        userId: number,
        createdBy: string,
    ): Promise<void> {
        const [roles, users] = await this.accessService.getProjectRoleAccess(
            projectId,
        );
        const user = await this.userStore.get(userId);

        const role = roles.find((r) => r.id === roleId);
        if (!role) {
            throw new NotFoundError(
                `Could not find roleId=${roleId} on project=${projectId}`,
            );
        }

        const alreadyHasAccess = users.some((u) => u.id === userId);
        if (alreadyHasAccess) {
            throw new Error(`User already has access to project=${projectId}`);
        }

        await this.accessService.addUserToRole(userId, role.id, projectId);

        await this.eventStore.store(
            new ProjectUserAddedEvent({
                project: projectId,
                createdBy: createdBy || 'system-user',
                data: {
                    roleId,
                    userId,
                    roleName: role.name,
                    email: user.email,
                },
            }),
        );
    }

    async removeUser(
        projectId: string,
        roleId: number,
        userId: number,
        createdBy: string,
    ): Promise<void> {
        const role = await this.findProjectRole(projectId, roleId);

        await this.validateAtLeastOneOwner(projectId, role);

        await this.accessService.removeUserFromRole(userId, role.id, projectId);

        const user = await this.userStore.get(userId);

        await this.eventStore.store(
            new ProjectUserRemovedEvent({
                project: projectId,
                createdBy,
                preData: {
                    roleId,
                    userId,
                    roleName: role.name,
                    email: user.email,
                },
            }),
        );
    }

    async addGroup(
        projectId: string,
        roleId: number,
        groupId: number,
        modifiedBy: string,
    ): Promise<void> {
        const role = await this.accessService.getRole(roleId);
        const group = await this.groupService.getGroup(groupId);
        const project = await this.getProject(projectId);

        await this.accessService.addGroupToRole(
            group.id,
            role.id,
            modifiedBy,
            project.id,
        );

        await this.eventStore.store(
            new ProjectGroupAddedEvent({
                project: project.id,
                createdBy: modifiedBy,
                data: {
                    groupId: group.id,
                    projectId: project.id,
                    roleName: role.name,
                },
            }),
        );
    }

    async removeGroup(
        projectId: string,
        roleId: number,
        groupId: number,
        modifiedBy: string,
    ): Promise<void> {
        const group = await this.groupService.getGroup(groupId);
        const role = await this.accessService.getRole(roleId);
        const project = await this.getProject(projectId);

        await this.accessService.removeGroupFromRole(
            group.id,
            role.id,
            project.id,
        );

        await this.eventStore.store(
            new ProjectGroupRemovedEvent({
                project: projectId,
                createdBy: modifiedBy,
                preData: {
                    groupId: group.id,
                    projectId: project.id,
                    roleName: role.name,
                },
            }),
        );
    }

    async addAccess(
        projectId: string,
        roleId: number,
        usersAndGroups: IProjectAccessModel,
        createdBy: string,
    ): Promise<void> {
        return this.accessService.addAccessToProject(
            usersAndGroups.users,
            usersAndGroups.groups,
            projectId,
            roleId,
            createdBy,
        );
    }

    async findProjectGroupRole(
        projectId: string,
        roleId: number,
    ): Promise<IGroupRole> {
        const roles = await this.groupService.getRolesForProject(projectId);
        const role = roles.find((r) => r.roleId === roleId);
        if (!role) {
            throw new NotFoundError(
                `Couldn't find roleId=${roleId} on project=${projectId}`,
            );
        }
        return role;
    }

    async findProjectRole(
        projectId: string,
        roleId: number,
    ): Promise<IRoleDescriptor> {
        const roles = await this.accessService.getRolesForProject(projectId);
        const role = roles.find((r) => r.id === roleId);
        if (!role) {
            throw new NotFoundError(
                `Couldn't find roleId=${roleId} on project=${projectId}`,
            );
        }
        return role;
    }

    async validateAtLeastOneOwner(
        projectId: string,
        currentRole: IRoleDescriptor,
    ): Promise<void> {
        if (currentRole.name === RoleName.OWNER) {
            const users = await this.accessService.getProjectUsersForRole(
                currentRole.id,
                projectId,
            );
            const groups = await this.groupService.getProjectGroups(projectId);
            const roleGroups = groups.filter((g) => g.roleId == currentRole.id);
            if (users.length + roleGroups.length < 2) {
                throw new ProjectWithoutOwnerError();
            }
        }
    }

    async changeRole(
        projectId: string,
        roleId: number,
        userId: number,
        createdBy: string,
    ): Promise<void> {
        const usersWithRoles = await this.getAccessToProject(projectId);
        const user = usersWithRoles.users.find((u) => u.id === userId);
        const currentRole = usersWithRoles.roles.find(
            (r) => r.id === user.roleId,
        );

        if (currentRole.id === roleId) {
            // Nothing to do....
            return;
        }

        await this.validateAtLeastOneOwner(projectId, currentRole);

        await this.accessService.updateUserProjectRole(
            userId,
            roleId,
            projectId,
        );
        const role = await this.findProjectRole(projectId, roleId);

        await this.eventStore.store(
            new ProjectUserUpdateRoleEvent({
                project: projectId,
                createdBy,
                preData: {
                    userId,
                    roleId: currentRole.id,
                    roleName: currentRole.name,
                    email: user.email,
                },
                data: {
                    userId,
                    roleId,
                    roleName: role.name,
                    email: user.email,
                },
            }),
        );
    }

    async changeGroupRole(
        projectId: string,
        roleId: number,
        userId: number,
        createdBy: string,
    ): Promise<void> {
        const usersWithRoles = await this.getAccessToProject(projectId);
        const user = usersWithRoles.groups.find((u) => u.id === userId);
        const currentRole = usersWithRoles.roles.find(
            (r) => r.id === user.roleId,
        );

        if (currentRole.id === roleId) {
            // Nothing to do....
            return;
        }

        await this.validateAtLeastOneOwner(projectId, currentRole);

        await this.accessService.updateGroupProjectRole(
            userId,
            roleId,
            projectId,
        );
        const role = await this.findProjectGroupRole(projectId, roleId);

        await this.eventStore.store(
            new ProjectGroupUpdateRoleEvent({
                project: projectId,
                createdBy,
                preData: {
                    userId,
                    roleId: currentRole.id,
                    roleName: currentRole.name,
                },
                data: {
                    userId,
                    roleId,
                    roleName: role.name,
                },
            }),
        );
    }

    async getMembers(projectId: string): Promise<number> {
        return this.store.getMembersCountByProject(projectId);
    }

    async getProjectOverview(
        projectId: string,
        archived: boolean = false,
    ): Promise<IProjectOverview> {
        const project = await this.store.get(projectId);
        const environments = await this.store.getEnvironmentsForProject(
            projectId,
        );
        const features = await this.featureToggleService.getFeatureOverview(
            projectId,
            archived,
        );
        const members = await this.store.getMembersCountByProject(projectId);
        return {
            name: project.name,
            environments,
            description: project.description,
            health: project.health,
            features,
            members,
            version: 1,
        };
    }
}
