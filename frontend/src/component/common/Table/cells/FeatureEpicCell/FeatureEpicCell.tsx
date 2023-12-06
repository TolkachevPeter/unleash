import useUiConfig from 'hooks/api/getters/useUiConfig/useUiConfig';
import { FC } from 'react';
import { LinkCell } from '../LinkCell/LinkCell';

interface IEpicCellProps {
    value: string;
}

export const EpicCell: FC<IEpicCellProps> = ({ value }) => {
    const { uiConfig } = useUiConfig();
    const url = uiConfig.jiraUrl ? `${uiConfig.jiraUrl}/jira/browse/${value}` : '';

    return (
        <LinkCell
            title={value}
            to={url}
            external={!!uiConfig.jiraUrl}
        />
    );
};
