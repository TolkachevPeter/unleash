import { ENVIRONMENT_STRATEGY_ERROR } from 'constants/apiErrors';
import useFeatureApi from 'hooks/api/actions/useFeatureApi/useFeatureApi';
import { useFeature } from 'hooks/api/getters/useFeature/useFeature';
import useToast from 'hooks/useToast';
import { IFeatureEnvironment } from 'interfaces/featureToggle';
import PermissionSwitch from 'component/common/PermissionSwitch/PermissionSwitch';
import StringTruncator from 'component/common/StringTruncator/StringTruncator';
import { UPDATE_FEATURE_ENVIRONMENT } from 'component/providers/AccessProvider/permissions';
import React, { useState } from 'react';
import { formatUnknownError } from 'utils/formatUnknownError';
import { useStyles } from './FeatureOverviewEnvSwitch.styles';
import { useRequiredPathParam } from 'hooks/useRequiredPathParam';

interface IFeatureOverviewEnvSwitchProps {
    env: IFeatureEnvironment;
    callback?: () => void;
    text?: string;
    showInfoBox: () => void;
}

const FeatureOverviewEnvSwitch = ({
    env,
    callback,
    text,
    showInfoBox,
}: IFeatureOverviewEnvSwitchProps) => {
    const projectId = useRequiredPathParam('projectId');
    const featureId = useRequiredPathParam('featureId');
    const { toggleFeatureEnvironmentOn, toggleFeatureEnvironmentOff, toggleFeatureGetJiraStatus } =
        useFeatureApi();
    const { refetchFeature } = useFeature(projectId, featureId);
    const { setToastData, setToastApiError } = useToast();
    const { classes: styles } = useStyles();
    const [isRequestLoading, setIsRequestLoading] = useState(false);

    const handleToggleEnvironmentOn = async () => {
        setIsRequestLoading(true);
        let jiraStatus;
        try {
            await toggleFeatureEnvironmentOn(projectId, featureId, env.name);
            try {
                const response = await toggleFeatureGetJiraStatus(
                    projectId,
                    featureId,
                );
                const data = await response.json();
                jiraStatus = data.status;
            } catch(e) {
                console.error(e);
            }
            setToastData({
                type: 'success',
                title: `Available in ${env.name}`,
                text: `${featureId} is now available in ${env.name} based on its defined strategies. ${jiraStatus ? ('Jira status: ' + jiraStatus) : ''}`,
            });
            refetchFeature();
            if (callback) {
                callback();
            }
        } catch (error: unknown) {
            if (
                error instanceof Error &&
                error.message === ENVIRONMENT_STRATEGY_ERROR
            ) {
                showInfoBox();
            } else {
                setToastApiError(formatUnknownError(error));
            }
        } finally {
            setIsRequestLoading(false);
        }
    };

    const handleToggleEnvironmentOff = async () => {
        setIsRequestLoading(true);
        try {
            await toggleFeatureEnvironmentOff(projectId, featureId, env.name);
            setToastData({
                type: 'success',
                title: `Unavailable in ${env.name}`,
                text: `${featureId} is unavailable in ${env.name} and its strategies will no longer have any effect.`,
            });
            refetchFeature();
            if (callback) {
                callback();
            }
        } catch (error: unknown) {
            setToastApiError(formatUnknownError(error));
        } finally {
            setIsRequestLoading(false);
        }
    };

    const toggleEnvironment = async (e: React.ChangeEvent) => {
        if (env.enabled) {
            await handleToggleEnvironmentOff();
            return;
        }
        await handleToggleEnvironmentOn();
    };

    let content = text ? (
        text
    ) : (
        <>
            {' '}
            <span data-loading>{env.enabled ? 'enabled' : 'disabled'} in</span>
            &nbsp;
            <StringTruncator text={env.name} maxWidth="120" maxLength={15} />
        </>
    );

    return (
        <div>
            <label className={styles.label}>
                <PermissionSwitch
                    permission={UPDATE_FEATURE_ENVIRONMENT}
                    projectId={projectId}
                    checked={env.enabled}
                    onChange={toggleEnvironment}
                    environmentId={env.name}
                    disabled={isRequestLoading}
                />
                {content}
            </label>
        </div>
    );
};

export default FeatureOverviewEnvSwitch;
