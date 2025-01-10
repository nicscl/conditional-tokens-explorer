import { useDebounceCallback } from '@react-hook/debounce'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import DataTable from 'react-data-table-component'
import { useParams } from 'react-router-dom'
import styled, { withTheme } from 'styled-components'

import { TokenIcon } from 'components/common/TokenIcon'
import { CollateralFilterDropdown } from 'components/filters/CollateralFilterDropdown'
import { DateFilter } from 'components/filters/DateFilter'
import { WrappedCollateralFilterDropdown } from 'components/filters/WrappedCollateralFilterDropdown'
import { SearchField } from 'components/form/SearchField'
import { Switch } from 'components/form/Switch'
import { CompactFiltersLayout } from 'components/pureStyledComponents/CompactFiltersLayout'
import { EmptyContentText } from 'components/pureStyledComponents/EmptyContentText'
import {
  FilterResultsControl,
  FilterResultsTextAlternativeLayout,
} from 'components/pureStyledComponents/FilterResultsText'
import { FiltersSwitchWrapper } from 'components/pureStyledComponents/FiltersSwitchWrapper'
import { RadioButton } from 'components/pureStyledComponents/RadioButton'
import { InlineLoading } from 'components/statusInfo/InlineLoading'
import { SpinnerSize } from 'components/statusInfo/common'
import { TableControls } from 'components/table/TableControls'
import { FormatHash } from 'components/text/FormatHash'
import { TitleValue } from 'components/text/TitleValue'
import { useWeb3ConnectedOrInfura } from 'contexts/Web3Context'
import { PositionWithUserBalanceWithDecimals, usePositionsList } from 'hooks/usePositionsList'
import { usePositionsSearchOptions } from 'hooks/usePositionsSearchOptions'
import { customStyles } from 'theme/tableCustomStyles'
import { truncateStringInTheMiddle } from 'util/tools'
import {
  AdvancedFilterPosition,
  CollateralFilterOptions,
  PositionSearchOptions,
  WrappedCollateralOptions,
} from 'util/types'

const Search = styled(SearchField)`
  min-width: 0;
  width: 400px;
`

const TableControlsStyled = styled(TableControls)`
  padding-top: 13px;
`

const TitleValueExtended = styled(TitleValue)<{ hideTitle?: boolean }>`
  ${(props) => props.hideTitle && 'h2 { display: none;}'}
`

interface Props {
  clearFilters?: boolean
  hideTitle?: boolean
  onClearCallback?: () => void
  onFilterCallback?: (
    positions: PositionWithUserBalanceWithDecimals[]
  ) => PositionWithUserBalanceWithDecimals[]
  onRowClicked: (position: PositionWithUserBalanceWithDecimals) => void
  refetch?: boolean
  selectedPosition: Maybe<PositionWithUserBalanceWithDecimals>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  theme?: any
  title?: string
}

interface Params {
  positionId?: string
}

const SelectPositionTable: React.FC<Props> = (props) => {
  const {
    clearFilters,
    hideTitle,
    onClearCallback,
    onFilterCallback,
    onRowClicked,
    refetch,
    selectedPosition,
    theme,
    title = 'Positions',
    ...restProps
  } = props

  const { networkConfig } = useWeb3ConnectedOrInfura()

  const { positionId } = useParams<Params>()

  const [positionList, setPositionList] = useState<PositionWithUserBalanceWithDecimals[]>([])

  const [searchBy, setSearchBy] = useState<PositionSearchOptions>(PositionSearchOptions.PositionId)
  const [textToShow, setTextToShow] = useState<string>(positionId || '')
  const [textToSearch, setTextToSearch] = useState<string>(positionId || '')
  const [resetPagination, setResetPagination] = useState<boolean>(false)
  const [showFilters, setShowFilters] = useState(false)
  const [isFiltering, setIsFiltering] = useState(false)

  const [selectedCollateralFilter, setSelectedCollateralFilter] = useState<Maybe<string[]>>(null)
  const [selectedCollateralValue, setSelectedCollateralValue] = useState<string>(
    CollateralFilterOptions.All
  )

  const [selectedFromCreationDate, setSelectedFromCreationDate] = useState<Maybe<number>>(null)
  const [selectedToCreationDate, setSelectedToCreationDate] = useState<Maybe<number>>(null)
  const [wrappedCollateral, setWrappedCollateral] = useState<WrappedCollateralOptions>(
    WrappedCollateralOptions.All
  )

  const debouncedHandlerTextToSearch = useDebounceCallback((textToSearch) => {
    setTextToSearch(textToSearch)
  }, 100)

  const onChangeSearch = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = event.currentTarget
      setTextToShow(value)
      debouncedHandlerTextToSearch(value)
    },
    [debouncedHandlerTextToSearch]
  )

  const onClearSearch = useCallback(() => {
    setTextToShow('')
    debouncedHandlerTextToSearch('')
  }, [debouncedHandlerTextToSearch])

  const advancedFilters: AdvancedFilterPosition = useMemo(() => {
    return {
      CollateralValue: {
        type: selectedCollateralValue,
        value: selectedCollateralFilter,
      },
      ToCreationDate: selectedToCreationDate,
      FromCreationDate: selectedFromCreationDate,
      TextToSearch: {
        type: searchBy,
        value: textToSearch,
      },
      WrappedCollateral: wrappedCollateral,
    }
  }, [
    wrappedCollateral,
    selectedCollateralValue,
    selectedCollateralFilter,
    selectedToCreationDate,
    selectedFromCreationDate,
    searchBy,
    textToSearch,
  ])

  const { data, error, loading, refetchPositions, refetchUserPositions } = usePositionsList(
    advancedFilters
  )

  const resetFilters = useCallback(() => {
    setResetPagination(!resetPagination)
    setSelectedToCreationDate(null)
    setSelectedFromCreationDate(null)
    setSelectedCollateralFilter(null)
    setSelectedCollateralValue(CollateralFilterOptions.All)
    setWrappedCollateral(WrappedCollateralOptions.All)
  }, [resetPagination])

  useEffect(() => {
    setIsFiltering(
      selectedToCreationDate !== null ||
        selectedFromCreationDate !== null ||
        wrappedCollateral !== WrappedCollateralOptions.All ||
        selectedCollateralValue !== CollateralFilterOptions.All ||
        wrappedCollateral !== WrappedCollateralOptions.All ||
        selectedCollateralFilter !== null
    )
  }, [
    isFiltering,
    selectedCollateralFilter,
    selectedCollateralValue,
    selectedFromCreationDate,
    selectedToCreationDate,
    wrappedCollateral,
  ])

  // Clear the filters on network change
  useEffect(() => {
    setShowFilters(false)
    resetFilters()
    if (onClearCallback) onClearCallback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkConfig, clearFilters])

  // Filter selected positions from original list. And positions without balance as indicated by props.
  useEffect(() => {
    if (data && data.length > 0) {
      if (onFilterCallback) {
        setPositionList(onFilterCallback(data))
      } else {
        setPositionList(data)
      }
    } else {
      setPositionList([])
    }
  }, [setPositionList, data, onFilterCallback])

  useEffect(() => {
    if (refetch) {
      onClearSearch()
      refetchPositions()
      refetchUserPositions()
    }
  }, [refetch, refetchPositions, refetchUserPositions, onClearSearch])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defaultColumns: Array<any> = useMemo(
    () => [
      {
        // eslint-disable-next-line react/display-name
        cell: (position: PositionWithUserBalanceWithDecimals) => (
          <RadioButton
            checked={!!(selectedPosition && selectedPosition?.id === position.id)}
            onClick={() => onRowClicked(position)}
          />
        ),
        maxWidth: '12px',
        minWidth: '12px',
      },
      {
        // eslint-disable-next-line react/display-name
        cell: (row: PositionWithUserBalanceWithDecimals) => (
          <FormatHash
            hash={truncateStringInTheMiddle(row.id, 8, 6)}
            onClick={() => onRowClicked(row)}
          />
        ),
        maxWidth: '170px',
        name: 'Position Id',
        selector: 'createTimestamp',
        sortable: true,
      },
      {
        // eslint-disable-next-line react/display-name
        cell: (row: PositionWithUserBalanceWithDecimals) => {
          return row.token ? (
            <TokenIcon onClick={() => onRowClicked(row)} token={row.token} />
          ) : (
            row.collateralToken
          )
        },
        maxWidth: '140px',
        minWidth: '140px',
        name: 'Collateral',
        selector: 'collateralToken',
        sortable: true,
      },
      {
        // eslint-disable-next-line react/display-name
        cell: (row: PositionWithUserBalanceWithDecimals) => (
          <div onClick={() => onRowClicked(row)}>
            {row.userBalanceERC1155WithDecimals}
          </div>
        ),
        maxWidth: '140px',
        minWidth: '140px',
        name: 'ERC1155',
        selector: 'userBalanceERC1155WithDecimals',
        sortable: true,
      },
      {
        // eslint-disable-next-line react/display-name
        cell: (row: PositionWithUserBalanceWithDecimals) => (
          <div onClick={() => onRowClicked(row)}>
            {row.userBalanceERC20WithDecimals}
          </div>
        ),
        maxWidth: '140px',
        minWidth: '140px',
        name: 'ERC20',
        selector: 'userBalanceERC20WithDecimals',
        sortable: true,
      },
    ],
    [onRowClicked, selectedPosition]
  )

  const toggleShowFilters = useCallback(() => {
    setShowFilters(!showFilters)
  }, [showFilters])

  const isLoading = useMemo(() => !textToSearch && loading, [textToSearch, loading])
  const isSearching = useMemo(() => textToSearch && loading, [textToSearch, loading])

  const showSpinner = useMemo(() => (isLoading || isSearching) && !error, [
    isLoading,
    isSearching,
    error,
  ])

  const dropdownItems = usePositionsSearchOptions(setSearchBy)

  useEffect(() => {
    if (
      textToSearch !== '' ||
      wrappedCollateral !== WrappedCollateralOptions.All ||
      selectedCollateralValue !== CollateralFilterOptions.All ||
      selectedCollateralFilter ||
      selectedToCreationDate ||
      selectedFromCreationDate
    ) {
      setResetPagination(!resetPagination)
    }
    if (onClearCallback) onClearCallback()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    textToSearch,
    wrappedCollateral,
    selectedCollateralValue,
    selectedCollateralFilter,
    selectedToCreationDate,
    selectedFromCreationDate,
  ])

  const conditionalRowStyles = [
    {
      when: (position: PositionWithUserBalanceWithDecimals) =>
        !!(selectedPosition && selectedPosition?.id === position.id),
      style: {
        backgroundColor: theme.colors.whitesmoke3,
        color: theme.colors.darkerGrey,
        '&:hover': {
          cursor: 'default',
        },
        pointerEvents: 'none' as const,
      },
    },
  ]

  return (
    <TitleValueExtended
      hideTitle={hideTitle}
      title={title}
      value={
        <>
          <TableControlsStyled
            end={
              <Search
                dropdownItems={dropdownItems}
                onChange={onChangeSearch}
                onClear={onClearSearch}
                value={textToShow}
              />
            }
            start={
              <FiltersSwitchWrapper>
                <Switch active={showFilters} label="Filters" onClick={toggleShowFilters} />
                {(isFiltering || showFilters) && (
                  <FilterResultsTextAlternativeLayout>
                    Showing {isFiltering ? 'filtered' : 'all'} results -{' '}
                    <FilterResultsControl disabled={!isFiltering} onClick={resetFilters}>
                      Clear Filters
                    </FilterResultsControl>
                  </FilterResultsTextAlternativeLayout>
                )}
              </FiltersSwitchWrapper>
            }
          />
          <CompactFiltersLayout isVisible={showFilters}>
            <CollateralFilterDropdown
              onClick={(symbol: string, address: Maybe<string[]>) => {
                setSelectedCollateralFilter(address)
                setSelectedCollateralValue(symbol)
              }}
              value={selectedCollateralValue}
            />
            <WrappedCollateralFilterDropdown
              onClick={(value: WrappedCollateralOptions) => {
                setWrappedCollateral(value)
              }}
              value={wrappedCollateral}
            />
            <DateFilter
              fromValue={selectedFromCreationDate}
              onClear={() => {
                setSelectedToCreationDate(null)
                setSelectedFromCreationDate(null)
              }}
              onSubmit={(from, to) => {
                setSelectedFromCreationDate(from)
                setSelectedToCreationDate(to)
              }}
              title="Creation Date"
              toValue={selectedToCreationDate}
            />
          </CompactFiltersLayout>
          <DataTable
            className="outerTableWrapper condensedTable"
            columns={defaultColumns}
            conditionalRowStyles={conditionalRowStyles}
            customStyles={customStyles}
            data={showSpinner ? [] : positionList.length ? positionList : []}
            highlightOnHover
            noDataComponent={
              showSpinner ? (
                <InlineLoading size={SpinnerSize.regular} />
              ) : error ? (
                <EmptyContentText>Error: {error.message}</EmptyContentText>
              ) : (
                <EmptyContentText>No positions found.</EmptyContentText>
              )
            }
            noHeader
            onRowClicked={onRowClicked}
            pagination
            paginationPerPage={5}
            paginationResetDefaultPage={resetPagination}
            paginationRowsPerPageOptions={[5, 10, 15]}
            pointerOnHover
            responsive
          />
        </>
      }
      {...restProps}
    />
  )
}

export const SelectablePositionTable = withTheme(SelectPositionTable)
