import { BigNumber } from 'ethers/utils'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from 'components/buttons/Button'
import { ButtonType } from 'components/buttons/buttonStylingTypes'
import { CenteredCard } from 'components/common/CenteredCard'
import { Amount } from 'components/form/Amount'
import { MergePreview } from 'components/mergePositions/MergePreview'
import { MergeResultModal } from 'components/mergePositions/MergeResultModal'
import { ButtonContainer } from 'components/pureStyledComponents/ButtonContainer'
import { Row } from 'components/pureStyledComponents/Row'
import { StatusInfoInline, StatusInfoType } from 'components/statusInfo/StatusInfoInline'
import { IconTypes } from 'components/statusInfo/common'
import { NULL_PARENT_ID, ZERO_BN } from 'config/constants'
import { quickMergeConfigs } from 'config/mergeConfig'
import { Web3ContextStatus, useWeb3ConnectedOrInfura } from 'contexts/Web3Context'
import { useActiveAddress } from 'hooks/useActiveAddress'
import { useCondition } from 'hooks/useCondition'
import { usePositionsList } from 'hooks/usePositionsList'
import { ConditionalTokensService } from 'services/conditionalTokens'
import { getLogger } from 'util/logger'
import { Remote } from 'util/remoteData'
import { getTokenSummary, isConditionFullIndexSet } from 'util/tools'
import { AdvancedFilterPosition, Token } from 'util/types'

const logger = getLogger('QuickMergeForm')

interface Props {
  config: {
    conditionId: string
    tokenAddress: string
    outcomes: string[]
    description: string
  }
}

export const QuickMergeForm: React.FC<Props> = ({ config }) => {
  const { conditionId, tokenAddress } = config

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

  const [transactionStatus, setTransactionStatus] = useState<Remote<Maybe<BigNumber>>>(
    Remote.notAsked<Maybe<BigNumber>>()
  )

  const [amount, setAmount] = useState<BigNumber>(ZERO_BN)
  const [collateralToken, setCollateralToken] = useState<Maybe<Token>>(null)
  const [mergeResult, setMergeResult] = useState<string>('')

  const { condition } = useCondition(conditionId)
  const { data: positions } = usePositionsList({} as AdvancedFilterPosition)

  // Find mergeable positions for this condition
  const mergeablePositions = useMemo(() => {
    if (!positions || !condition) return []
    
    return positions.filter((position) => {
      const conditionIndex = position.conditionIds.indexOf(conditionId)
      return conditionIndex !== -1 && position.collateralToken === tokenAddress
    })
  }, [positions, condition, conditionId, tokenAddress])

  useEffect(() => {
    const getCollateral = async () => {
      try {
        const token = await getTokenSummary(networkConfig, provider, tokenAddress)
        setCollateralToken(token)
      } catch (err) {
        logger.error(err)
      }
    }

    getCollateral()
  }, [networkConfig, provider, tokenAddress])

  const onAmountChange = useCallback((value: BigNumber) => {
    setAmount(value)
  }, [])

  const onMerge = useCallback(async () => {
    try {
      if (
        mergeablePositions.length > 0 &&
        condition &&
        status === Web3ContextStatus.Connected &&
        CPKService &&
        walletAddress
      ) {
        setTransactionStatus(Remote.loading())

        const { collateralToken: posCollateralToken, conditionIds, indexSets } = mergeablePositions[0]
        const newCollectionsSet = conditionIds.reduce<Array<{ conditionId: string; indexSet: BigNumber }>>(
          (acc, id, i) =>
            id !== conditionId
              ? [...acc, { conditionId: id, indexSet: new BigNumber(indexSets[i]) }]
              : acc,
          []
        )
        const parentCollectionId = newCollectionsSet.length
          ? ConditionalTokensService.getCombinedCollectionId(newCollectionsSet)
          : NULL_PARENT_ID

        const partition = mergeablePositions.map(
          ({ conditionIds, indexSets }) =>
            indexSets[conditionIds.findIndex((id) => conditionId === id)]
        )
        const shouldTransferAmount = isConditionFullIndexSet(
          mergeablePositions,
          conditionId,
          condition.outcomeSlotCount
        )

        const partitionBN: BigNumber[] = partition.map((o: string) => new BigNumber(o))

        if (isUsingTheCPKAddress()) {
          await CPKService.mergePositions({
            CTService,
            amount,
            collateralToken: posCollateralToken,
            conditionId,
            parentCollectionId,
            partition: partitionBN,
            shouldTransferAmount,
            address: walletAddress,
          })
        } else {
          await CTService.mergePositions(
            posCollateralToken,
            parentCollectionId,
            conditionId,
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
    mergeablePositions,
    condition,
    status,
    CPKService,
    walletAddress,
    amount,
    conditionId,
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
      mergeablePositions.length === 0 ||
      amount.isZero(),
    [isLoading, status, mergeablePositions, amount]
  )

  const error = useMemo(() => {
    if (mergeablePositions.length === 0) {
      return 'No mergeable positions found for this condition'
    }
    return null
  }, [mergeablePositions])

  const maxBalance = useMemo(
    () => mergeablePositions[0]?.userBalanceERC1155 || ZERO_BN,
    [mergeablePositions]
  )

  const onUsePositionBalance = useCallback(() => {
    if (maxBalance.gt(ZERO_BN)) {
      setAmount(maxBalance)
    }
  }, [maxBalance])

  return (
    <CenteredCard>
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
          Merge Position
        </Button>
      </ButtonContainer>
      {mergeablePositions.length > 0 && (
        <MergePreview
          amount={amount}
          condition={condition}
          positions={mergeablePositions}
          token={collateralToken}
        />
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
  )
} 