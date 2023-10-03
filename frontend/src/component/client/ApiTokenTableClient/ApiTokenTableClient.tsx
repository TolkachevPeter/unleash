import { IApiToken, useApiTokens } from 'hooks/api/getters/useApiTokens/useApiTokens';
import { useTable, useGlobalFilter, useSortBy } from 'react-table';
import { PageContent } from 'component/common/PageContent/PageContent';
import {
    SortableTableHeader,
    TableCell,
    TablePlaceholder,
} from 'component/common/Table';
import { Table, TableBody, Box, TableRow, useMediaQuery } from '@mui/material';
import { PageHeader } from 'component/common/PageHeader/PageHeader';
import { SearchHighlightProvider } from 'component/common/Table/SearchHighlightContext/SearchHighlightContext';
import { IconCell } from 'component/common/Table/cells/IconCell/IconCell';
import { Key } from '@mui/icons-material';
import { DateCell } from 'component/common/Table/cells/DateCell/DateCell';
import { sortTypes } from 'utils/sortTypes';
import { useMemo } from 'react';
import theme from 'themes/theme';
import useUiConfig from 'hooks/api/getters/useUiConfig/useUiConfig';
import { ProjectsList } from 'component/admin/apiToken/ProjectsList/ProjectsList';
import { ConditionallyRender } from 'component/common/ConditionallyRender/ConditionallyRender';
import { HighlightCell } from 'component/common/Table/cells/HighlightCell/HighlightCell';
import useHiddenColumns from 'hooks/useHiddenColumns';
import { ExpiringDateCell } from 'component/common/Table/cells/ExpiringDateCell/ExpiringDateCell';

const hiddenColumnsSmall = ['Icon', 'createdAt', 'expiresAt'];
const hiddenColumnsFlagE = ['projects', 'environment'];

export const ApiTokenTableClient = () => {
    const { tokens, loading } = useApiTokens({path: 'api/admin/api-tokens/client'});
    const initialState = useMemo(() => ({ sortBy: [{ id: 'createdAt' }] }), []);
    const { uiConfig } = useUiConfig();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));

    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
        state: { globalFilter },
        setHiddenColumns,
    } = useTable(
        {
            columns: COLUMNS as any,
            data: tokens as any,
            initialState,
            sortTypes,
            disableSortRemove: true,
        },
        useGlobalFilter,
        useSortBy
    );

    useHiddenColumns(setHiddenColumns, hiddenColumnsSmall, isSmallScreen);
    useHiddenColumns(setHiddenColumns, hiddenColumnsFlagE, !uiConfig.flags.E);

    return (
        <PageContent
            header={
                <PageHeader
                    title={`Client Tokens (${rows.length})`}
                />
            }
        >
            <Box sx={{ overflowX: 'auto' }}>
                <SearchHighlightProvider value={globalFilter}>
                    <Table {...getTableProps()}>
                        <SortableTableHeader
                            headerGroups={headerGroups as any}
                        />
                        <TableBody {...getTableBodyProps()}>
                            {rows.map(row => {
                                prepareRow(row);
                                const expirationDate = (row.original as IApiToken)?.expiresAt;
                                const isExpired = expirationDate ? new Date(expirationDate) < new Date() : false;
                                return (
                                    <TableRow 
                                    hover 
                                    {...row.getRowProps()} 
                                    style={{ backgroundColor: isExpired ? 'rgba(255, 0, 0, 0.05)' : undefined }}
                                  >
                                    {row.cells.map(cell => (
                                      <TableCell {...cell.getCellProps()}>
                                        {cell.render('Cell')}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </SearchHighlightProvider>
            </Box>
            <ConditionallyRender
                condition={rows.length === 0 && !loading}
                show={
                    <ConditionallyRender
                        condition={globalFilter?.length > 0}
                        show={
                            <TablePlaceholder>
                                No tokens found matching &ldquo;
                                {globalFilter}
                                &rdquo;
                            </TablePlaceholder>
                        }
                        elseShow={
                            <TablePlaceholder>
                                <span>
                                    {'No tokens available. Read '}
                                    <a
                                        href="https://docs.getunleash.io/how-to/api"
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        API How-to guides
                                    </a>{' '}
                                    {' to learn more.'}
                                </span>
                            </TablePlaceholder>
                        }
                    />
                }
            />
        </PageContent>
    );
};

const tokenDescriptions = {
    client: {
        label: 'CLIENT',
        title: 'Connect server-side SDK or Unleash Proxy',
    },
    frontend: {
        label: 'FRONTEND',
        title: 'Connect web and mobile SDK',
    },
    admin: {
        label: 'ADMIN',
        title: 'Full access for managing Unleash',
    },
};

const COLUMNS = [
    {
        id: 'Icon',
        width: '1%',
        Cell: () => <IconCell icon={<Key color="disabled" />} />,
        disableSortBy: true,
        disableGlobalFilter: true,
    },
    {
        Header: 'Username',
        accessor: 'username',
        Cell: HighlightCell,
    },
    {
        Header: 'Type',
        accessor: 'type',
        Cell: ({ value }: { value: 'admin' | 'client' | 'frontend' }) => (
            <HighlightCell
                value={tokenDescriptions[value].label}
                subtitle={tokenDescriptions[value].title}
            />
        ),
        minWidth: 280,
    },
    {
        Header: 'Project',
        accessor: 'project',
        Cell: (props: any) => (
            <ProjectsList
                project={props.row.original.project}
                projects={props.row.original.projects}
            />
        ),
        minWidth: 120,
    },
    {
        Header: 'Environment',
        accessor: 'environment',
        Cell: HighlightCell,
        minWidth: 120,
    },
    {
        Header: 'Created',
        accessor: 'createdAt',
        Cell: DateCell,
        minWidth: 150,
        disableGlobalFilter: true,
    },
    {
        Header: 'Expires',
        accessor: 'expiresAt',
        Cell: ExpiringDateCell,
        minWidth: 150,
        disableGlobalFilter: true,
    },
];
