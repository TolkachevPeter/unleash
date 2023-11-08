import { useEffect, useMemo, useState, VFC } from 'react';
import { Button, Link, useMediaQuery, useTheme } from '@mui/material';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { SortingRule, useFlexLayout, useSortBy, useTable } from 'react-table';
import { TablePlaceholder, VirtualizedTable } from 'component/common/Table';
import { useFeatures } from 'hooks/api/getters/useFeatures/useFeatures';
import { SearchHighlightProvider } from 'component/common/Table/SearchHighlightContext/SearchHighlightContext';
import { DateCell } from 'component/common/Table/cells/DateCell/DateCell';
import { LinkCell } from 'component/common/Table/cells/LinkCell/LinkCell';
import { FeatureSeenCell } from 'component/common/Table/cells/FeatureSeenCell/FeatureSeenCell';
import { FeatureTypeCell } from 'component/common/Table/cells/FeatureTypeCell/FeatureTypeCell';
import { FeatureNameCell } from 'component/common/Table/cells/FeatureNameCell/FeatureNameCell';
import { ConditionallyRender } from 'component/common/ConditionallyRender/ConditionallyRender';
import { PageContent } from 'component/common/PageContent/PageContent';
import { PageHeader } from 'component/common/PageHeader/PageHeader';
import { sortTypes } from 'utils/sortTypes';
import { createLocalStorage } from 'utils/createLocalStorage';
import { FeatureSchema } from 'openapi';
import { CreateFeatureButton } from '../CreateFeatureButton/CreateFeatureButton';
import { FeatureStaleCell } from './FeatureStaleCell/FeatureStaleCell';
import { useSearch } from 'hooks/useSearch';
import { Search } from 'component/common/Search/Search';

export const featuresPlaceholder: FeatureSchema[] = Array(15).fill({
    name: 'Name of the feature',
    description: 'Short description of the feature',
    type: '-',
    createdAt: new Date(2022, 1, 1),
    project: 'projectID',
    epic: 'Epic Name'
});

export type PageQueryType = Partial<
    Record<'sort' | 'order' | 'search' | 'epic', string>
>;


const defaultSort: SortingRule<string> = { id: 'createdAt' };

const { value: storedParams, setValue: setStoredParams } = createLocalStorage(
    'FeatureToggleListTable:v1',
    defaultSort
);

export const FeatureToggleListTable: VFC = () => {
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
    const isMediumScreen = useMediaQuery(theme.breakpoints.down('lg'));
    const { features = [], loading } = useFeatures();
    const [searchParams, setSearchParams] = useSearchParams();
    const [epicFilter, setEpicFilter] = useState('');
    const [initialState] = useState(() => ({
        sortBy: [
            {
                id: searchParams.get('sort') || storedParams.id,
                desc: searchParams.has('order')
                    ? searchParams.get('order') === 'desc'
                    : storedParams.desc,
            },
        ],
        hiddenColumns: ['description'],
        globalFilter: searchParams.get('search') || '',
        epicFilter: searchParams.get('epic') || '',
    }));
    const [searchValue, setSearchValue] = useState(initialState.globalFilter);

    const columns = useMemo(() => [
        {
            Header: 'Seen',
            accessor: 'lastSeenAt',
            Cell: FeatureSeenCell,
            sortType: 'date',
            align: 'center',
            maxWidth: 85,
        },
        {
            Header: 'Type',
            accessor: 'type',
            Cell: FeatureTypeCell,
            align: 'center',
            maxWidth: 85,
        },
        {
            Header: 'Name',
            accessor: 'name',
            minWidth: 150,
            Cell: FeatureNameCell,
            sortType: 'alphanumeric',
            searchable: true,
        },
        {
            Header: 'Created',
            accessor: 'createdAt',
            Cell: DateCell,
            sortType: 'date',
            maxWidth: 150,
        },
        {
            Header: 'Epic',
            accessor: 'epic',
            Cell: ({ value } : {value: string | null }) => (
                <div
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                        if (epicFilter === value) {
                            setEpicFilter('');
                        } else {
                            setEpicFilter(value || '');
                        }
                    }}
                >
                    {value || ''}
                </div>
            ),
            maxWidth: 200,
        },
        {
            Header: 'Project ID',
            accessor: 'project',
            Cell: ({ value }: { value: string }) => (
                <LinkCell title={value} to={`/projects/${value}`} />
            ),
            sortType: 'alphanumeric',
            maxWidth: 150,
            filterName: 'project',
            searchable: true,
        },
        {
            Header: 'State',
            accessor: 'stale',
            Cell: FeatureStaleCell,
            sortType: 'boolean',
            maxWidth: 120,
            filterName: 'state',
            filterParsing: (value: any) => (value ? 'stale' : 'active'),
        },
        // Always hidden -- for search
        {
            accessor: 'description',
        },
    ], [epicFilter, setEpicFilter]);

    const {
        data: searchedData,
        getSearchText,
        getSearchContext,
    } = useSearch(columns, searchValue, features);

    const data = useMemo(() => {
        if (loading) {
            return featuresPlaceholder;
        }
        let filteredData = searchedData;
        if (epicFilter) {
            filteredData = filteredData?.filter((feature) => feature.epic === epicFilter);
        }
        return filteredData || [];
    }, [searchedData, loading, epicFilter]);
    
    const {
        headerGroups,
        rows,
        prepareRow,
        state: { sortBy },
        setHiddenColumns,
    } = useTable(
        {
            columns,
            data,
            initialState,
            sortTypes,
            autoResetSortBy: false,
            disableSortRemove: true,
            disableMultiSort: true,
        },
        useSortBy,
        useFlexLayout
    );

    useEffect(() => {
        const hiddenColumns = ['description'];
        if (isMediumScreen) {
            hiddenColumns.push('lastSeenAt', 'stale');
        }
        if (isSmallScreen) {
            hiddenColumns.push('type', 'createdAt');
        }
        setHiddenColumns(hiddenColumns);
    }, [setHiddenColumns, isSmallScreen, isMediumScreen]);

    useEffect(() => {
        const tableState: PageQueryType = {};
        tableState.sort = sortBy[0].id;
        if (sortBy[0].desc) {
            tableState.order = 'desc';
        }
        if (searchValue) {
            tableState.search = searchValue;
        }

        if (epicFilter) {
            tableState.epic = epicFilter;
        }

        setSearchParams(tableState, {
            replace: true,
        });
        setStoredParams({ id: sortBy[0].id, desc: sortBy[0].desc || false });
    }, [sortBy, searchValue, epicFilter, setSearchParams]);

    useEffect(() => {
        const epicSearchParams = searchParams.get('epic');
        if (epicSearchParams) {
            setEpicFilter(epicSearchParams);
        }
    }, [searchParams]);

    const clearEpicFilter = () => {
        setEpicFilter('');
    };

    return (
        <PageContent
            isLoading={loading}
            header={
                <PageHeader
                    title={`Feature toggles (${
                        rows.length < data.length
                            ? `${rows.length} of ${data.length}`
                            : data.length
                    })`}
                    actions={
                        <>
                            <ConditionallyRender
                                condition={!isSmallScreen}
                                show={
                                    <>
                                        <Search
                                            initialValue={searchValue}
                                            onChange={setSearchValue}
                                            hasFilters
                                            getSearchContext={getSearchContext}
                                        />
                                        <PageHeader.Divider />
                                    </>
                                }
                            />
                            <Link
                                component={RouterLink}
                                to="/archive"
                                underline="always"
                                sx={{ marginRight: 2 }}
                            >
                                View archive
                            </Link>
                            <CreateFeatureButton
                                loading={false}
                                filter={{ query: '', project: 'default' }}
                            />
                        <ConditionallyRender
                            condition={epicFilter.length > 0}
                            show={
                                <Button onClick={clearEpicFilter} variant="outlined" color="primary">
                                    Clean epic filter
                                </Button>
                            }
                        />
                        </>
                    }
                >
                    <ConditionallyRender
                        condition={isSmallScreen}
                        show={
                            <Search
                                initialValue={searchValue}
                                onChange={setSearchValue}
                                hasFilters
                                getSearchContext={getSearchContext}
                            />
                        }
                    />
                </PageHeader>
            }
        >
            <SearchHighlightProvider value={getSearchText(searchValue)}>
                <VirtualizedTable
                    rows={rows}
                    headerGroups={headerGroups}
                    prepareRow={prepareRow}
                />
            </SearchHighlightProvider>
            <ConditionallyRender
                condition={rows.length === 0}
                show={
                    <ConditionallyRender
                        condition={searchValue?.length > 0}
                        show={
                            <TablePlaceholder>
                                No feature toggles found matching &ldquo;
                                {searchValue}
                                &rdquo;
                            </TablePlaceholder>
                        }
                        elseShow={
                            <TablePlaceholder>
                                No feature toggles available. Get started by
                                adding a new feature toggle.
                            </TablePlaceholder>
                        }
                    />
                }
            />
        </PageContent>
    );
};
