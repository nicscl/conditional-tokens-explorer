import { ethers } from 'ethers'
import { BigNumber } from 'ethers/utils'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'

import { Button } from 'components/buttons/Button'
import { ButtonType } from 'components/buttons/buttonStylingTypes'
import { CenteredCard } from 'components/common/CenteredCard'
import { Amount } from 'components/form/Amount'
import { ConditionsDropdown } from 'components/form/ConditionsDropdown'
import { MergePreview } from 'components/mergePositions/MergePreview'
import { MergeResultModal } from 'components/mergePositions/MergeResultModal'
import { MergeWith } from 'components/mergePositions/MergeWith'
import { ButtonContainer } from 'components/pureStyledComponents/ButtonContainer'
import { Row } from 'components/pureStyledComponents/Row'
import { SelectablePositionTable } from 'components/table/SelectablePositionTable'
import { StatusInfoInline, StatusInfoType } from 'components/statusInfo/StatusInfoInline'
import { NULL_PARENT_ID, ZERO_BN } from 'config/constants'
import { quickMergeConfigs } from 'config/mergeConfig'
import { Web3ContextStatus, useWeb3ConnectedOrInfura } from 'contexts/Web3Context'
import { useActiveAddress } from 'hooks/useActiveAddress'
import { useCondition } from 'hooks/useCondition'
import { Position } from 'hooks/utils'
import { PositionWithUserBalanceWithDecimals, usePositionsList } from 'hooks/usePositionsList'
import { ConditionalTokensService } from 'services/conditionalTokens'
import { getLogger } from 'util/logger'
import { Remote } from 'util/remoteData'
import { getTokenSummary, isConditionFullIndexSet, arePositionMergeablesByCondition } from 'util/tools'
import { AdvancedFilterPosition, CollateralFilterOptions, MergeablePosition, PositionSearchOptions, Token, WrappedCollateralOptions } from 'util/types'

const logger = getLogger('MergePosition')

const ModeSwitcher = styled(Row)`
  margin-bottom: 24px;
  justify-content: center;
  gap: 12px;
`

const defaultAdvancedFilter: AdvancedFilterPosition = {
  CollateralValue: {
    type: CollateralFilterOptions.All,
    value: null,
  },
  ToCreationDate: null,
  FromCreationDate: null,
  TextToSearch: {
    type: PositionSearchOptions.All,
    value: null,
  },
  WrappedCollateral: WrappedCollateralOptions.All,
}

export const Contents = () => {
  const {
    _type: status,
    CPKService,
    CTService,
    address: walletAddress,
    isUsingTheCPKAddress,
    networkConfig,
    provider,
  } = useWeb3ConnectedOrInfura()

  const activeAddress = useActiveAddress()

  const [mode, setMode] = useState<'quick' | 'advanced'>('quick')
  const [position, setPosition] = useState<PositionWithUserBalanceWithDecimals | null>(null)
  const [conditionId, setConditionId] = useState<string | null>(null)
  const [selectedPositions, setSelectedPositions] = useState<PositionWithUserBalanceWithDecimals[]>([])
  const [advancedMergeablePositions, setAdvancedMergeablePositions] = useState<PositionWithUserBalanceWithDecimals[]>([])

  const [transactionStatus, setTransactionStatus] = useState<Remote<Maybe<BigNumber>>>(
    Remote.notAsked<Maybe<BigNumber>>()
  )

  const [amount, setAmount] = useState<BigNumber>(ZERO_BN)
  const [collateralToken, setCollateralToken] = useState<Maybe<Token>>(null)
  const [mergeResult, setMergeResult] = useState<string>('')

  const quickMergeConfig = useMemo(() => {
    if (!networkConfig) return null
    return quickMergeConfigs[networkConfig.networkId]?.[0] || null
  }, [networkConfig])

  const { condition } = useCondition(quickMergeConfig?.conditionId || null)
  const { data: positions } = usePositionsList(defaultAdvancedFilter)

  // Find mergeable positions for currency token
  const currencyPositions = useMemo(() => {
    if (!positions || !quickMergeConfig) return { yes: null, no: null }
    
    const yesPosition = positions.find(p => p.id === quickMergeConfig.currencyPositions.yes)
    const noPosition = positions.find(p => p.id === quickMergeConfig.currencyPositions.no)
    
    return { yes: yesPosition || null, no: noPosition || null }
  }, [positions, quickMergeConfig])

  // Set mergeable positions for quick mode
  useEffect(() => {
    if (mode === 'quick' && currencyPositions.yes && currencyPositions.no) {
      // Set the positions that will be merged
      setSelectedPositions([currencyPositions.yes, currencyPositions.no])
      // Set the condition ID
      if (quickMergeConfig) {
        setConditionId(quickMergeConfig.conditionId)
      }
    }
  }, [mode, currencyPositions, quickMergeConfig])

  // Calculate max mergeable amount (minimum of YES/NO balances)
  const maxBalance = useMemo(() => {
    if (!currencyPositions.yes || !currencyPositions.no) return ZERO_BN
    
    const yesBalance = currencyPositions.yes.userBalanceERC1155
    const noBalance = currencyPositions.no.userBalanceERC1155
    
    return yesBalance.gt(noBalance) ? noBalance : yesBalance
  }, [currencyPositions])

  // Find mergeable positions for this condition
  const mergeablePositions = useMemo(() => {
    if (!positions || !condition || !quickMergeConfig) return []
    
    return positions.filter((position) => {
      const conditionIndex = position.conditionIds.indexOf(quickMergeConfig.conditionId)
      return conditionIndex !== -1 && position.collateralToken === quickMergeConfig.tokenAddress
    })
  }, [positions, condition, quickMergeConfig])

  useEffect(() => {
    const getCollateral = async () => {
      try {
        if (quickMergeConfig) {
          const token = await getTokenSummary(networkConfig, provider, quickMergeConfig.tokenAddress)
          setCollateralToken(token)
        }
      } catch (err) {
        logger.error(err)
      }
    }

    getCollateral()
  }, [networkConfig, provider, quickMergeConfig])

  const onAmountChange = useCallback((value: BigNumber) => {
    setAmount(value)
  }, [])

  const onMerge = useCallback(async () => {
    try {
      if (
        status === Web3ContextStatus.Connected &&
        CPKService &&
        walletAddress &&
        condition &&
        quickMergeConfig &&
        selectedPositions.length > 0
      ) {
        setTransactionStatus(Remote.loading())

        const { collateralToken: posCollateralToken, conditionIds, indexSets } = selectedPositions[0]
        const newCollectionsSet = conditionIds.reduce<Array<{ conditionId: string; indexSet: BigNumber }>>(
          (acc, id, i) =>
            id !== quickMergeConfig.conditionId
              ? [...acc, { conditionId: id, indexSet: new BigNumber(indexSets[i]) }]
              : acc,
          []
        )
        const parentCollectionId = newCollectionsSet.length
          ? ConditionalTokensService.getCombinedCollectionId(newCollectionsSet)
          : NULL_PARENT_ID

        const partition = selectedPositions.map(
          ({ conditionIds, indexSets }) =>
            indexSets[conditionIds.findIndex((id) => quickMergeConfig.conditionId === id)]
        )
        const shouldTransferAmount = isConditionFullIndexSet(
          selectedPositions,
          quickMergeConfig.conditionId,
          condition.outcomeSlotCount
        )

        const partitionBN: BigNumber[] = partition.map((o: string) => new BigNumber(o))

        if (isUsingTheCPKAddress()) {
          await CPKService.mergePositions({
            CTService,
            amount,
            collateralToken: posCollateralToken,
            conditionId: quickMergeConfig.conditionId,
            parentCollectionId,
            partition: partitionBN,
            shouldTransferAmount,
            address: walletAddress,
          })
        } else {
          await CTService.mergePositions(
            posCollateralToken,
            parentCollectionId,
            quickMergeConfig.conditionId,
            partition,
            amount
          )
        }

        setMergeResult(
          parentCollectionId === NULL_PARENT_ID
            ? posCollateralToken
            : ConditionalTokensService.getPositionId(posCollateralToken, parentCollectionId)
        )
        setTransactionStatus(Remote.success(amount))
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setTransactionStatus(Remote.failure(error))
      logger.error(error)
    }
  }, [
    status,
    CPKService,
    walletAddress,
    condition,
    quickMergeConfig,
    selectedPositions,
    amount,
    CTService,
    isUsingTheCPKAddress,
  ])

  const decimals = useMemo(() => (collateralToken ? collateralToken.decimals : 0), [collateralToken])

  const isLoading = useMemo(
    () => !condition || transactionStatus.isLoading(),
    [condition, transactionStatus]
  )

  const disabled = useMemo(
    () =>
      isLoading ||
      status !== Web3ContextStatus.Connected ||
      (mode === 'quick' ? !currencyPositions.yes || !currencyPositions.no : mergeablePositions.length === 0) ||
      amount.isZero(),
    [isLoading, status, mode, currencyPositions, mergeablePositions, amount]
  )

  const error = useMemo(() => {
    if (mode === 'quick') {
      if (!currencyPositions.yes || !currencyPositions.no) {
        return 'No mergeable positions found for this condition'
      }
      if (currencyPositions.yes.userBalanceERC1155.isZero() || currencyPositions.no.userBalanceERC1155.isZero()) {
        return 'Insufficient balance to merge positions'
      }
    } else if (mergeablePositions.length === 0) {
      return 'No mergeable positions found for this condition'
    }
    return null
  }, [mode, currencyPositions, mergeablePositions])

  const onUsePositionBalance = useCallback(() => {
    if (maxBalance.gt(ZERO_BN)) {
      setAmount(maxBalance)
    }
  }, [maxBalance])

  const onFilterCallback = useCallback(
    (positions: PositionWithUserBalanceWithDecimals[]) => {
      return positions.filter(
        (position: PositionWithUserBalanceWithDecimals) => 
          !position.userBalanceERC1155.isZero() || !position.userBalanceERC20.isZero()
      )
    },
    []
  )

  return (
    <>
      <ModeSwitcher>
        <Button onClick={() => setMode('quick')}>
          {mode === 'quick' ? <strong>Quick Mode</strong> : 'Quick Mode'}
        </Button>
        <Button onClick={() => setMode('advanced')}>
          {mode === 'advanced' ? <strong>Advanced Mode</strong> : 'Advanced Mode'}
        </Button>
      </ModeSwitcher>

      {mode === 'quick' ? (
        quickMergeConfig ? (
          <CenteredCard>
            {!positions ? (
              <StatusInfoInline status={StatusInfoType.working}>
                Loading positions...
              </StatusInfoInline>
            ) : (
              <>
                <h3>Currency Token Positions (WXDAI)</h3>
                <Row>
                  <div>
                    <strong>YES Position:</strong> {currencyPositions.yes ? (
                      <>
                        Balance: {currencyPositions.yes.userBalanceERC1155WithDecimals} (ERC1155)
                        {currencyPositions.yes.userBalanceERC20.gt(ZERO_BN) && (
                          <span style={{ color: 'gray' }}>
                            {' '}+ {currencyPositions.yes.userBalanceERC20WithDecimals} (ERC20 - not mergeable)
                          </span>
                        )}
                      </>
                    ) : 'No balance'}
                  </div>
                </Row>
                <Row>
                  <div>
                    <strong>NO Position:</strong> {currencyPositions.no ? (
                      <>
                        Balance: {currencyPositions.no.userBalanceERC1155WithDecimals} (ERC1155)
                        {currencyPositions.no.userBalanceERC20.gt(ZERO_BN) && (
                          <span style={{ color: 'gray' }}>
                            {' '}+ {currencyPositions.no.userBalanceERC20WithDecimals} (ERC20 - not mergeable)
                          </span>
                        )}
                      </>
                    ) : 'No balance'}
                  </div>
                </Row>
                <Row>
                  <Amount
                    amount={amount}
                    balance={maxBalance}
                    decimals={decimals}
                    isFromAPosition
                    max={maxBalance.toString()}
                    onAmountChange={onAmountChange}
                    onUseWalletBalance={onUsePositionBalance}
                  />
                </Row>
                {error && (
                  <StatusInfoInline status={StatusInfoType.warning}>
                    {error}
                  </StatusInfoInline>
                )}
                <ButtonContainer>
                  <Button disabled={disabled} onClick={onMerge}>
                    Merge Currency Positions
                  </Button>
                </ButtonContainer>
                {/* Company token section - to be added later */}
                <h3>Company Token Positions</h3>
                <StatusInfoInline status={StatusInfoType.warning}>
                  Company token positions will be available soon
                </StatusInfoInline>
                {mergeResult && collateralToken && (
                  <MergeResultModal
                    amount={amount}
                    closeAction={() => setMergeResult('')}
                    collateralToken={collateralToken}
                    isOpen={!!mergeResult}
                    mergeResult={mergeResult}
                  />
                )}
              </>
            )}
          </CenteredCard>
        ) : (
          <CenteredCard>
            <StatusInfoInline status={StatusInfoType.warning}>
              No quick merge configurations available for this network
            </StatusInfoInline>
          </CenteredCard>
        )
      ) : (
        <CenteredCard>
          <SelectablePositionTable
            onFilterCallback={onFilterCallback}
            onRowClicked={async (selectedPosition: PositionWithUserBalanceWithDecimals) => {
              setPosition(selectedPosition)
              if (!positions) return

              const positionsWithBalance = positions.filter(
                (p) => !p.userBalanceERC1155.isZero() || !p.userBalanceERC20.isZero()
              )

              const mergeablePositions = positionsWithBalance.filter((p) =>
                selectedPosition.conditions.some((condition) =>
                  arePositionMergeablesByCondition(
                    [selectedPosition, p],
                    condition.conditionId,
                    condition.outcomeSlotCount
                  )
                )
              )

              setAdvancedMergeablePositions(mergeablePositions)
              if (selectedPosition.conditions.length > 0) {
                setConditionId(selectedPosition.conditions[0].conditionId)
              }
            }}
            selectedPosition={position}
          />
          {position && (
            <>
              <Row>
                <MergeWith
                  errorFetching={false}
                  isLoading={false}
                  mergeablePositions={advancedMergeablePositions.map(position => ({
                    position,
                    positionPreview: position.id
                  }))}
                  onClick={(item: MergeablePosition, index: number, selected: boolean) => {
                    if (selected) {
                      setSelectedPositions([...selectedPositions, item.position])
                    } else {
                      setSelectedPositions(
                        selectedPositions.filter((p) => p.id !== item.position.id)
                      )
                    }
                  }}
                />
              </Row>
              <Row>
                <ConditionsDropdown
                  conditions={position.conditions.map((c) => c.conditionId)}
                  onClick={setConditionId}
                  value={conditionId}
                />
              </Row>
              <Row>
                <Amount
                  amount={amount}
                  balance={maxBalance}
                  decimals={decimals}
                  isFromAPosition
                  max={maxBalance.toString()}
                  onAmountChange={onAmountChange}
                  onUseWalletBalance={onUsePositionBalance}
                />
              </Row>
              {selectedPositions.length > 0 && conditionId && (
                <Row>
                  <MergePreview
                    amount={amount}
                    condition={condition}
                    positions={selectedPositions}
                    token={collateralToken}
                  />
                </Row>
              )}
              <ButtonContainer>
                <Button
                  disabled={
                    !conditionId ||
                    selectedPositions.length === 0 ||
                    amount.isZero() ||
                    amount.gt(maxBalance)
                  }
                  onClick={onMerge}
                >
                  Merge Positions
                </Button>
              </ButtonContainer>
            </>
          )}
          {mergeResult && collateralToken && (
            <MergeResultModal
              amount={amount}
              closeAction={() => setMergeResult('')}
              collateralToken={collateralToken}
              isOpen={!!mergeResult}
              mergeResult={mergeResult}
            />
          )}
        </CenteredCard>
      )}
    </>
  )
}
