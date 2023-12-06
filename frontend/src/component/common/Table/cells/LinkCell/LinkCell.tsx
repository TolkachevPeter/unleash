import { FC } from 'react';
import { Link, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { ConditionallyRender } from 'component/common/ConditionallyRender/ConditionallyRender';
import { useStyles } from './LinkCell.styles';
import { Highlighter } from 'component/common/Highlighter/Highlighter';
import { useSearchHighlightContext } from 'component/common/Table/SearchHighlightContext/SearchHighlightContext';
import classnames from 'classnames';

interface ILinkCellProps {
    title?: string;
    to?: string;
    onClick?: () => void;
    subtitle?: string;
    external?: boolean;
}

export const LinkCell: FC<ILinkCellProps> = ({
    title,
    to,
    onClick,
    subtitle,
    children,
    external=false,
}) => {
    const { classes: styles } = useStyles();
    const { searchQuery } = useSearchHighlightContext();

    const content = (
        <div className={styles.container}>
            <span
                data-loading
                className={styles.title}
                style={{
                    WebkitLineClamp: Boolean(subtitle) ? 1 : 2,
                    lineClamp: Boolean(subtitle) ? 1 : 2,
                }}
            >
                <Highlighter search={searchQuery}>{title}</Highlighter>
                {children}
            </span>
            <ConditionallyRender
                condition={Boolean(subtitle)}
                show={
                    <>
                        <Typography
                            className={styles.description}
                            component="span"
                            data-loading
                        >
                            <Highlighter search={searchQuery}>
                                {subtitle}
                            </Highlighter>
                        </Typography>
                    </>
                }
            />
        </div>
    );

    if (external && to) {
        return (
            <Link
                href={to}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                className={classnames(styles.wrapper, styles.link)}
            >
                {content}
            </Link>
        );
    } else if (to) {
        return (
            <Link
                component={RouterLink}
                to={to}
                underline="hover"
                className={classnames(styles.wrapper, styles.link)}
            >
                {content}
            </Link>
        );
    } else if (onClick) {
        return (
            <Link
                onClick={onClick}
                underline="hover"
                className={classnames(styles.wrapper, styles.link)}
            >
                {content}
            </Link>
        );
    } else {
        return (
            <span className={styles.wrapper}>{content}</span>
        );
    }
};
