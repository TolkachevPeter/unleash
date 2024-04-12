import { VFC } from 'react';
import { useLocationSettings } from 'hooks/useLocationSettings';
import { formatDateYMD } from 'utils/formatDate';
import { parseISO } from 'date-fns';
import { TextCell } from 'component/common/Table/cells/TextCell/TextCell';

interface IDateCellProps {
    value?: Date | string | null;
    isSpecial?: boolean;
}

export const DateCell: VFC<IDateCellProps> = ({ value, isSpecial = false }, isRedColor = false) => {
    const { locationSettings } = useLocationSettings();

    const date = value
        ? value instanceof Date
            ? formatDateYMD(value, locationSettings.locale)
            : formatDateYMD(parseISO(value), locationSettings.locale)
        : undefined;

        const currentDate = new Date();
        const dateValue = value instanceof Date ? value : parseISO(value!);
        const isOld = (currentDate.getTime() - dateValue.getTime()) / (1000 * 3600 * 24) > 14;

        const color = isOld && isSpecial ? 'red' : undefined;
    
        return <TextCell style={{ color }}>{date}</TextCell>;
};
