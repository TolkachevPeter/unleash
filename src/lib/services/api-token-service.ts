import crypto from 'crypto';
import cron from 'node-cron';
import { Logger } from '../logger';
import { ADMIN, CLIENT, FRONTEND } from '../types/permissions';
import { IUnleashStores } from '../types/stores';
import { IUnleashConfig } from '../types/option';
import ApiUser from '../types/api-user';
import {
    ApiTokenType,
    IApiToken,
    ILegacyApiTokenCreate,
    IApiTokenCreate,
    validateApiToken,
    validateApiTokenEnvironment,
    mapLegacyToken,
    mapLegacyTokenWithSecret,
} from '../types/models/api-token';
import { IApiTokenStore } from '../types/stores/api-token-store';
import { FOREIGN_KEY_VIOLATION } from '../error/db-error';
import BadDataError from '../error/bad-data-error';
import { minutesToMilliseconds } from 'date-fns';
import { IEnvironmentStore } from 'lib/types/stores/environment-store';
import { constantTimeCompare } from '../util/constantTimeCompare';
import { EmailService } from './email-service';
import UserService from './user-service';
import ProjectService from 'lib/services/project-service';
import { GroupService } from './group-service';


const resolveTokenPermissions = (tokenType: string) => {
    if (tokenType === ApiTokenType.ADMIN) {
        return [ADMIN];
    }

    if (tokenType === ApiTokenType.CLIENT) {
        return [CLIENT];
    }

    if (tokenType === ApiTokenType.FRONTEND) {
        return [FRONTEND];
    }

    return [];
};

export class ApiTokenService {
    private store: IApiTokenStore;

    private environmentStore: IEnvironmentStore;

    private logger: Logger;

    private timer: NodeJS.Timeout;

    private activeTokens: IApiToken[] = [];

    private emailService: EmailService;

    private userService: UserService;

    private projectService?: ProjectService;

    private groupService?: GroupService;

    constructor(
        {
            apiTokenStore,
            environmentStore,
        }: Pick<IUnleashStores, 'apiTokenStore' | 'environmentStore'>,
        config: Pick<IUnleashConfig, 'getLogger' | 'authentication'>,
        services: {
            emailService: EmailService;
            userService: UserService;
            projectService: ProjectService;
            groupService: GroupService;
        },
    ) {
        this.store = apiTokenStore;
        this.environmentStore = environmentStore;
        this.logger = config.getLogger('/services/api-token-service.ts');
        this.fetchActiveTokens();
        this.timer = setInterval(
            () => this.fetchActiveTokens(),
            minutesToMilliseconds(1),
        ).unref();
        this.emailService = services.emailService;
        this.userService = services.userService;
        this.projectService = services.projectService;
        this.groupService = services.groupService;
        if (config.authentication.initApiTokens.length > 0) {
            process.nextTick(async () =>
                this.initApiTokens(config.authentication.initApiTokens),
            );
        }
        this.scheduleTokenExpirationReminders();
    }

    async fetchActiveTokens(): Promise<void> {
        try {
            this.activeTokens = await this.getAllActiveTokens();
        } finally {
            // eslint-disable-next-line no-unsafe-finally
            return;
        }
    }

    public async getAllTokens(): Promise<IApiToken[]> {
        return this.store.getAll();
    }

    public async getAllActiveTokens(): Promise<IApiToken[]> {
        return this.store.getAllActive();
    }

    private async initApiTokens(tokens: ILegacyApiTokenCreate[]) {
        const tokenCount = await this.store.count();
        if (tokenCount > 0) {
            return;
        }
        try {
            const createAll = tokens
                .map(mapLegacyTokenWithSecret)
                .map((t) => this.insertNewApiToken(t));
            await Promise.all(createAll);
        } catch (e) {
            this.logger.error('Unable to create initial Admin API tokens');
        }
    }

    public getUserForToken(secret: string): ApiUser | undefined {
        if (!secret) {
            return undefined;
        }

        let token = this.activeTokens.find(
            (activeToken) =>
                Boolean(activeToken.secret) &&
                constantTimeCompare(activeToken.secret, secret),
        );

        // If the token is not found, try to find it in the legacy format with alias.
        // This allows us to support the old format of tokens migrating to the embedded proxy.
        if (!token) {
            token = this.activeTokens.find(
                (activeToken) =>
                    Boolean(activeToken.alias) &&
                    constantTimeCompare(activeToken.alias, secret),
            );
        }

        if (token) {
            return new ApiUser({
                username: token.username,
                permissions: resolveTokenPermissions(token.type),
                projects: token.projects,
                environment: token.environment,
                type: token.type,
                secret: token.secret,
            });
        }

        return undefined;
    }

    public async updateExpiry(
        secret: string,
        expiresAt: Date,
    ): Promise<IApiToken> {
        return this.store.setExpiry(secret, expiresAt);
    }

    public async delete(secret: string): Promise<void> {
        return this.store.delete(secret);
    }

    /**
     * @deprecated This may be removed in a future release, prefer createApiTokenWithProjects
     */
    public async createApiToken(
        newToken: Omit<ILegacyApiTokenCreate, 'secret'>,
    ): Promise<IApiToken> {
        const token = mapLegacyToken(newToken);
        return this.createApiTokenWithProjects(token);
    }

    public async createApiTokenWithProjects(
        newToken: Omit<IApiTokenCreate, 'secret'>,
    ): Promise<IApiToken> {
        validateApiToken(newToken);

        const environments = await this.environmentStore.getAll();
        validateApiTokenEnvironment(newToken, environments);

        const secret = this.generateSecretKey(newToken);
        const createNewToken = { ...newToken, secret };
        return this.insertNewApiToken(createNewToken);
    }

    // TODO: Remove this service method after embedded proxy has been released in
    // 4.16.0
    public async createMigratedProxyApiToken(
        newToken: Omit<IApiTokenCreate, 'secret'>,
    ): Promise<IApiToken> {
        validateApiToken(newToken);

        const secret = this.generateSecretKey(newToken);
        const createNewToken = { ...newToken, secret };
        return this.insertNewApiToken(createNewToken);
    }

    private async sendEmailToUserWithToken(token: IApiToken) {
        const user = await this.userService.getByUserName(token.username);

        if (user && user.email) {
            const receiver = {
                email: user.email,
                name: user.name,
            };

            const emailText = `
            token: ${token.secret} <br/>
            project: ${token.project} <br/>
            expires at: ${token.expiresAt} <br/>
            `;

            await this.emailService.sendTokenMail(
                receiver.name,
                receiver.email,
                emailText,
            );
            this.logger.debug(
                `Email sent to ${receiver.name} with email ${receiver.email}`,
            );
        } else {
            this.logger.warn(
                `The email with token was not sent to the user ${token.username} because his email was not found in the database.`,
            );
        }
    }

    private async insertNewApiToken(
        newApiToken: IApiTokenCreate,
    ): Promise<IApiToken> {
        try {
            const token = await this.store.insert(newApiToken);
            this.activeTokens.push(token);
            // отправка токена на почту
            try {
                await this.sendEmailToUserWithToken(token);
            } catch (e) {
                this.logger.error(e);
            }
            return token;
        } catch (error) {
            if (error.code === FOREIGN_KEY_VIOLATION) {
                let { message } = error;
                if (error.constraint === 'api_token_project_project_fkey') {
                    message = `Project=${this.findInvalidProject(
                        error.detail,
                        newApiToken.projects,
                    )} does not exist`;
                } else if (error.constraint === 'api_tokens_environment_fkey') {
                    message = `Environment=${newApiToken.environment} does not exist`;
                }
                throw new BadDataError(message);
            }
            throw error;
        }
    }

    private findInvalidProject(errorDetails, projects) {
        if (!errorDetails) {
            return 'invalid';
        }
        let invalidProject = projects.find((project) => {
            return errorDetails.includes(`=(${project})`);
        });
        return invalidProject || 'invalid';
    }

    private generateSecretKey({ projects, environment }) {
        const randomStr = crypto.randomBytes(28).toString('hex');
        if (projects.length > 1) {
            return `[]:${environment}.${randomStr}`;
        } else {
            return `${projects[0]}:${environment}.${randomStr}`;
        }
    }

    public scheduleTokenExpirationReminders(): void {
        cron.schedule('0 0 * * *', async () => {
            try {
                const tokens = await this.getAllActiveTokens();
                const currentDate = new Date();
    
                for (const token of tokens) {
                    const daysLeft = Math.floor((new Date(token.expiresAt).getTime() - currentDate.getTime()) / (1000 * 3600 * 24));
                    
                    if ([30, 14, 7].includes(daysLeft)) {
                        const user = await this.userService.getByUserName(token.username);
    
                        if (user && user.email) {
                            const tokenSnippet = token.secret.slice(-6);
    
                            // const projectTeamEmails = await this.getProjectTeamEmails(token.projects);
    
                            // const ccEmails = [...projectTeamEmails, 'pierre.tolkachev@yandex.ru'];
                            // для теста пока что так
                            const ccEmails = ['pierre.tolkachev@yandex.ru'];
    
                            await this.emailService.sendTokenExpirationReminderMail(
                                user.name,
                                user.email,
                                tokenSnippet,
                                daysLeft,
                                ccEmails
                            );
    
                            this.logger.info(`Sent token expiration reminder to ${user.email} for token expiring in ${daysLeft} days, with CC: ${ccEmails.join(', ')}`);
                        } else {
                            this.logger.warn(`Could not send token expiration reminder, user ${token.username} has no email.`);
                        }
                    }
                }
    
                this.logger.info('Token expiration reminders have been processed.');
            } catch (error) {
                this.logger.error('Failed to process token expiration reminders:', error);
            }
        });
    }

    private async getProjectTeamEmails(projects: string[]): Promise<string[]> {
        const allEmails = new Set<string>();
    
        for (const projectId of projects) {
            const accessWithRoles = await this.projectService.getAccessToProject(projectId);
    
            // получаем emails пользователей, имеющих доступ к проекту напрямую
            const userEmails = accessWithRoles.users.map(user => user.email);
    
            // получаем email'ы пользователей, которые входят в группы, связанные с проектом
            const groupUserEmailsPromises = accessWithRoles.groups.map(async group => {
                const groupDetails = await this.groupService.getGroup(group.id);
                return groupDetails.users.map(user => user.user.email);
            });
    
            const groupUserEmails = (await Promise.all(groupUserEmailsPromises)).flat();
    
            userEmails.concat(groupUserEmails).forEach(email => allEmails.add(email));
        }
    
        return Array.from(allEmails);
    }
     
    

    destroy(): void {
        clearInterval(this.timer);
        this.timer = null;
    }
}
