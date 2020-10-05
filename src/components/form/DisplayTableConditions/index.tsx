import React, { useCallback } from 'react'
import DataTable from 'react-data-table-component'

import { EmptyContentText } from 'components/pureStyledComponents/EmptyContentText'
import { CellHash } from 'components/table/CellHash'
import { customStyles } from 'theme/tableCustomStyles'
import { ConditionIdsArray } from 'util/types'

interface Props {
  conditionIds: Array<ConditionIdsArray>
  callbackOnHistoryPush?: () => void
}

export const DisplayTableConditions = (props: Props) => {
  const { callbackOnHistoryPush, conditionIds } = props

  const getColumns = useCallback(() => {
    return [
      {
        // eslint-disable-next-line react/display-name
        cell: (row: ConditionIdsArray) => {
          return (
            <CellHash
              externalLink
              href={`/conditions/${row.conditionId}`}
              onClick={() => {
                if (typeof callbackOnHistoryPush === 'function') callbackOnHistoryPush()
              }}
              value={row.conditionId}
            />
          )
        },
        name: 'Condition Id',
        selector: 'createTimestamp',
        sortable: true,
      },
    ]
  }, [callbackOnHistoryPush])

  return (
    <DataTable
      className="outerTableWrapper inlineTable"
      columns={getColumns()}
      customStyles={customStyles}
      data={conditionIds || []}
      noDataComponent={<EmptyContentText>No conditions found.</EmptyContentText>}
      noHeader
      pagination
      paginationPerPage={5}
      paginationRowsPerPageOptions={[5, 10, 15]}
    />
  )
}