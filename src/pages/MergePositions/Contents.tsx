import { ethers } from 'ethers'
import { BigNumber } from 'ethers/utils'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'

import { Button } from 'components/buttons/Button'
import { ButtonType } from 'components/buttons/buttonStylingTypes'
import { ButtonCopy } from 'components/buttons/ButtonCopy'
import { CenteredCard } from 'components/common/CenteredCard'
import { ExternalLink } from 'components/navigation/ExternalLink'
import { FormatHash } from 'components/text/FormatHash'
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
import { getTokenSummary, isConditionFullIndexSet, arePositionMergeablesByCondition, truncateStringInTheMiddle } from 'util/tools'
import { AdvancedFilterPosition, CollateralFilterOptions, MergeablePosition, PositionSearchOptions, Token, TransferOptions, WrappedCollateralOptions } from 'util/types'
import { QuickWrapUnwrap } from 'components/quickMode/QuickWrapUnwrap'

const logger = getLogger('MergePosition')

const ModeSwitcher = styled(Row)`
  margin-bottom: 24px;
  justify-content: center;
  gap: 12px;
`

const WarningMessage = styled(StatusInfoInline)`
  margin-top: 8px;
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
    WrapperService,
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
  const [wrappedTokenInfo, setWrappedTokenInfo] = useState<{ [address: string]: Token }>({})
  const [transfer, setTransfer] = useState<Remote<TransferOptions>>(Remote.notAsked<TransferOptions>())
  const [transactionTitle, setTransactionTitle] = useState<string>('')

  const quickMergeConfig = useMemo(() => {
    if (!networkConfig) return null
    return quickMergeConfigs[networkConfig.networkId]?.[0] || null
  }, [networkConfig])

  const { condition } = useCondition(quickMergeConfig?.conditionId || null)
  const { data: positions, refetchPositions } = usePositionsList(defaultAdvancedFilter)

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

  // Calculate max mergeable amount (minimum of YES/NO total balances)
  const maxBalance = useMemo(() => {
    if (!currencyPositions.yes || !currencyPositions.no) return ZERO_BN
    
    const yesTotalBalance = currencyPositions.yes.userBalanceERC1155.add(currencyPositions.yes.userBalanceERC20)
    const noTotalBalance = currencyPositions.no.userBalanceERC1155.add(currencyPositions.no.userBalanceERC20)
    
    return yesTotalBalance.gt(noTotalBalance) ? noTotalBalance : yesTotalBalance
  }, [currencyPositions])

  const needsWrapping = useMemo(() => {
    if (!amount || !currencyPositions.yes || !currencyPositions.no) return false

    const yesNeedsWrapping = currencyPositions.yes.userBalanceERC1155.lt(amount) && 
      currencyPositions.yes.userBalanceERC1155.add(currencyPositions.yes.userBalanceERC20).gte(amount)

    const noNeedsWrapping = currencyPositions.no.userBalanceERC1155.lt(amount) && 
      currencyPositions.no.userBalanceERC1155.add(currencyPositions.no.userBalanceERC20).gte(amount)

    return yesNeedsWrapping || noNeedsWrapping
  }, [amount, currencyPositions])

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
    if (value.gt(maxBalance)) {
      setAmount(maxBalance)
    } else {
    setAmount(value)
    }
  }, [maxBalance])

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

        // Check if we need to wrap tokens first
        if (needsWrapping) {
          logger.info('Wrapping tokens before merge')
          
          // Handle YES position wrapping if needed
          if (currencyPositions.yes && currencyPositions.yes.userBalanceERC1155.lt(amount)) {
            const amountToWrap = amount.sub(currencyPositions.yes.userBalanceERC1155)
            if (amountToWrap.gt(ZERO_BN) && currencyPositions.yes.wrappedTokenAddress) {
              logger.info('Wrapping YES position tokens:', amountToWrap.toString())
              await CTService.safeTransferFrom(
                walletAddress,
                currencyPositions.yes.wrappedTokenAddress,
                currencyPositions.yes.id,
                amountToWrap,
                ethers.utils.defaultAbiCoder.encode(
                  ['string', 'bytes32'],
                  ['Wrapped ERC-1155', ethers.utils.id('FUTA_Y')]
                )
              )
            }
          }

          // Handle NO position wrapping if needed
          if (currencyPositions.no && currencyPositions.no.userBalanceERC1155.lt(amount)) {
            const amountToWrap = amount.sub(currencyPositions.no.userBalanceERC1155)
            if (amountToWrap.gt(ZERO_BN) && currencyPositions.no.wrappedTokenAddress) {
              logger.info('Wrapping NO position tokens:', amountToWrap.toString())
              await CTService.safeTransferFrom(
                walletAddress,
                currencyPositions.no.wrappedTokenAddress,
                currencyPositions.no.id,
                amountToWrap,
                ethers.utils.defaultAbiCoder.encode(
                  ['string', 'bytes32'],
                  ['Wrapped ERC-1155', ethers.utils.id('FUTA_N')]
                )
              )
            }
          }

          // Refetch positions to get updated balances
          await refetchPositions()
        }

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
      logger.error('Merge error:', error)
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
    needsWrapping,
    currencyPositions,
    refetchPositions
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
      amount.isZero() ||
      amount.gt(maxBalance),
    [isLoading, status, mode, currencyPositions, mergeablePositions, amount, maxBalance]
  )

  const error = useMemo(() => {
    if (mode === 'quick') {
      if (!currencyPositions.yes || !currencyPositions.no) {
        return 'No mergeable positions found for this condition'
      }
      if (currencyPositions.yes.userBalanceERC1155.add(currencyPositions.yes.userBalanceERC20).isZero() || 
          currencyPositions.no.userBalanceERC1155.add(currencyPositions.no.userBalanceERC20).isZero()) {
        return 'Insufficient total balance (ERC1155 + ERC20) to merge positions'
      }
      if (amount.gt(maxBalance)) {
        return `Amount exceeds maximum available balance of ${ethers.utils.formatUnits(maxBalance, decimals)}`
      }
    } else if (mergeablePositions.length === 0) {
      return 'No mergeable positions found for this condition'
    }
    return null
  }, [mode, currencyPositions, mergeablePositions, amount, maxBalance, decimals])

  const onUsePositionBalance = useCallback(() => {
    if (maxBalance.gt(ZERO_BN)) {
      setAmount(maxBalance)
      if (currencyPositions.yes && currencyPositions.no) {
        const yesNeedsUnwrap = currencyPositions.yes.userBalanceERC1155.lt(maxBalance)
        const noNeedsUnwrap = currencyPositions.no.userBalanceERC1155.lt(maxBalance)
        if (yesNeedsUnwrap || noNeedsUnwrap) {
          logger.info('Using max balance will require unwrapping:', {
            maxBalance: maxBalance.toString(),
            yesERC1155: currencyPositions.yes.userBalanceERC1155.toString(),
            yesERC20: currencyPositions.yes.userBalanceERC20.toString(),
            noERC1155: currencyPositions.no.userBalanceERC1155.toString(),
            noERC20: currencyPositions.no.userBalanceERC20.toString()
          })
        }
      }
    }
  }, [maxBalance, currencyPositions, logger])

  const onFilterCallback = useCallback(
    (positions: PositionWithUserBalanceWithDecimals[]) => {
      return positions.filter(
        (position: PositionWithUserBalanceWithDecimals) => 
          !position.userBalanceERC1155.isZero() || !position.userBalanceERC20.isZero()
      )
    },
    []
  )

  // Add effect to fetch wrapped token info
  useEffect(() => {
    const fetchWrappedTokenInfo = async () => {
      if (!networkConfig || !provider || !currencyPositions.yes?.wrappedTokenAddress || !currencyPositions.no?.wrappedTokenAddress) return

      try {
        const addresses = [
          currencyPositions.yes.wrappedTokenAddress,
          currencyPositions.no.wrappedTokenAddress
        ].filter((addr): addr is string => Boolean(addr))

        const tokenInfoPromises = addresses.map(address => 
          getTokenSummary(networkConfig, provider, address)
        )

        const tokens = await Promise.all(tokenInfoPromises)
        const tokenMap = addresses.reduce((acc, addr, i) => ({
          ...acc,
          [addr]: tokens[i]
        }), {})

        setWrappedTokenInfo(tokenMap)
      } catch (err) {
        logger.error('Error fetching wrapped token info:', err)
      }
    }

    fetchWrappedTokenInfo()
  }, [networkConfig, provider, currencyPositions.yes?.wrappedTokenAddress, currencyPositions.no?.wrappedTokenAddress])

  const getUnwrapSteps = useCallback(() => {
    if (!amount || !currencyPositions.yes || !currencyPositions.no) return null

    const steps = []
    
    // Check YES position
    if (currencyPositions.yes.userBalanceERC1155.lt(amount)) {
      const amountToUnwrap = amount.sub(currencyPositions.yes.userBalanceERC1155)
      if (amountToUnwrap.gt(ZERO_BN)) {
        steps.push({
          type: 'YES',
          amount: amountToUnwrap,
          symbol: wrappedTokenInfo[currencyPositions.yes.wrappedTokenAddress || '']?.symbol || 'Loading...'
        })
      }
    }

    // Check NO position
    if (currencyPositions.no.userBalanceERC1155.lt(amount)) {
      const amountToUnwrap = amount.sub(currencyPositions.no.userBalanceERC1155)
      if (amountToUnwrap.gt(ZERO_BN)) {
        steps.push({
          type: 'NO',
          amount: amountToUnwrap,
          symbol: wrappedTokenInfo[currencyPositions.no.wrappedTokenAddress || '']?.symbol || 'Loading...'
        })
      }
    }

    return steps.length > 0 ? steps : null
  }, [amount, currencyPositions, wrappedTokenInfo])

  const onUnwrap = useCallback(async () => {
    try {
      const steps = getUnwrapSteps()
      if (!steps || !walletAddress || !CTService || !WrapperService) return

      logger.info('Starting unwrap in Merge Positions with values:', {
        walletAddress,
        CTServiceAddress: CTService?.address,
        isUsingCPK: isUsingTheCPKAddress(),
      })

      setTransactionStatus(Remote.loading())

      for (const step of steps) {
        const position = step.type === 'YES' ? currencyPositions.yes : currencyPositions.no
        if (!position?.wrappedTokenAddress) continue

        logger.info(`Unwrapping ${step.type} position tokens:`, step.amount.toString())
        
        const tokenBytes = ethers.utils.defaultAbiCoder.encode(
          ['string', 'bytes32'],
          ['Wrapped ERC-1155', ethers.utils.id(step.type === 'YES' ? 'FUTA_Y' : 'FUTA_N')]
        )

        logger.info('Unwrap parameters:', {
          amount: step.amount.toString(),
          positionId: position.id,
          tokenBytes,
          walletAddress
        })

        if (isUsingTheCPKAddress()) {
          logger.info('Unwrapping with CPK')
          await CPKService?.unwrap({
            CTService,
            WrapperService,
            addressFrom: CTService.address,
            addressTo: walletAddress,
            positionId: position.id,
            amount: step.amount,
            tokenBytes,
          })
        } else {
          logger.info('Unwrapping without CPK')
          await WrapperService.unwrap(
            CTService.address,
            position.id,
            step.amount,
            walletAddress,
            tokenBytes
          )
        }
      }

      await refetchPositions()
      setTransactionStatus(Remote.success(null))
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setTransactionStatus(Remote.failure(error))
      logger.error('Unwrap error:', error)
    }
  }, [getUnwrapSteps, walletAddress, CTService, WrapperService, currencyPositions, isUsingTheCPKAddress, CPKService, logger, refetchPositions])

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
                        Balance: <span style={{ color: 'green' }}>{currencyPositions.yes.userBalanceERC1155WithDecimals}</span> (ERC1155)
                        {currencyPositions.yes.userBalanceERC20.gt(ZERO_BN) && currencyPositions.yes.wrappedTokenAddress && (
                          <span>
                            {' '}+ <span style={{ color: 'blue' }}>{currencyPositions.yes.userBalanceERC20WithDecimals}</span> ({wrappedTokenInfo[currencyPositions.yes.wrappedTokenAddress]?.symbol || 'Loading...'})
                          </span>
                        )}
                        <div style={{ marginTop: '4px', color: 'red' }}>
                          Total Available: {ethers.utils.formatUnits(currencyPositions.yes.userBalanceERC1155.add(currencyPositions.yes.userBalanceERC20), decimals)}
                        </div>
                        {currencyPositions.yes.wrappedTokenAddress && (
                          <div style={{ marginTop: '4px', fontSize: '12px' }}>
                            <span>Wrapped Token Address: </span>
                            <a href={`https://blockscout.com/xdai/mainnet/address/${currencyPositions.yes.wrappedTokenAddress}`} target="_blank" rel="noopener noreferrer">
                              <FormatHash hash={truncateStringInTheMiddle(currencyPositions.yes.wrappedTokenAddress, 8, 6)} />
                            </a>
                            <ButtonCopy value={currencyPositions.yes.wrappedTokenAddress} />
                            <ExternalLink href={`https://blockscout.com/xdai/mainnet/address/${currencyPositions.yes.wrappedTokenAddress}`} />
                          </div>
                        )}
                        <QuickWrapUnwrap
                          balanceERC1155={currencyPositions.yes.userBalanceERC1155}
                          balanceERC20={currencyPositions.yes.userBalanceERC20}
                          decimals={decimals}
                          onUnwrap={async (transferValue) => {
                            try {
                              logger.info('Starting unwrap in Merge Positions with values:', {
                                transferValue,
                                walletAddress,
                                CTServiceAddress: CTService?.address,
                                isUsingCPK: isUsingTheCPKAddress(),
                                wrappedTokenAddress: currencyPositions.yes?.wrappedTokenAddress
                              })

                              const yesPosition = currencyPositions.yes
                              if (!yesPosition || !CPKService || !walletAddress || !CTService || !WrapperService) {
                                throw new Error('Required services or position data not available')
                              }

                              const { amount, positionId, tokenBytes } = transferValue
                              
                              logger.info('Unwrap parameters:', {
                                amount: amount.toString(),
                                positionId,
                                tokenBytes,
                                walletAddress
                              })

                              setTransactionTitle('Unwrapping ERC20')
                              setTransfer(Remote.loading())

                              if (isUsingTheCPKAddress()) {
                                logger.info('Unwrapping with CPK')
                                await CPKService.unwrap({
                                  CTService,
                                  WrapperService,
                                  addressFrom: CTService.address,
                                  addressTo: walletAddress,
                                  positionId,
                                  amount,
                                  tokenBytes,
                                })
                              } else {
                                logger.info('Unwrapping without CPK')
                                await WrapperService.unwrap(
                                  CTService.address,
                                  positionId,
                                  amount,
                                  walletAddress,
                                  tokenBytes
                                )
                              }

                              await refetchPositions()
                              setTransfer(Remote.success(transferValue))
                              logger.info('Unwrap completed successfully')
                            } catch (err) {
                              logger.error('Unwrap error in Merge Positions:', err)
                              logger.error('Error details:', {
                                error: err,
                                transferValue,
                                walletAddress,
                                CTServiceAddress: CTService?.address,
                                wrappedTokenAddress: currencyPositions.yes?.wrappedTokenAddress
                              })
                              setTransfer(Remote.failure(err instanceof Error ? err : new Error(String(err))))
                            }
                          }}
                          onWrap={async (transferValue) => {
                            try {
                              if (CPKService && walletAddress && CTService) {
                                setTransactionTitle('Wrapping ERC1155')
                                setTransfer(Remote.loading())

                                const { address: addressTo, amount, positionId, tokenBytes } = transferValue
                                if (isUsingTheCPKAddress()) {
                                  await CPKService.wrapOrTransfer({
                                    CTService,
                                    addressFrom: walletAddress,
                                    addressTo,
                                    positionId,
                                    amount,
                                    tokenBytes,
                                  })
                                } else {
                                  await CTService.safeTransferFrom(
                                    walletAddress,
                                    addressTo,
                                    positionId,
                                    amount,
                                    tokenBytes
                                  )
                                }

                                await refetchPositions()
                                setTransfer(Remote.success(transferValue))
                              }
                            } catch (err) {
                              logger.error('Wrap error:', err)
                              setTransfer(Remote.failure(err instanceof Error ? err : new Error(String(err))))
                            }
                          }}
                          positionId={currencyPositions.yes.id}
                          symbol={collateralToken?.symbol || 'WXDAI'}
                          tokenName={currencyPositions.yes.wrappedTokenAddress ? wrappedTokenInfo[currencyPositions.yes.wrappedTokenAddress]?.name || 'Loading...' : 'Loading...'}
                          tokenSymbol={currencyPositions.yes.wrappedTokenAddress ? wrappedTokenInfo[currencyPositions.yes.wrappedTokenAddress]?.symbol || 'Loading...' : 'Loading...'}
                          wrappedName={`Wrapped ERC-1155`}
                          wrappedSymbol={currencyPositions.yes.wrappedTokenAddress ? wrappedTokenInfo[currencyPositions.yes.wrappedTokenAddress]?.symbol || 'Loading...' : 'Loading...'}
                          wrappedCollateralAddress={currencyPositions.yes.wrappedTokenAddress || undefined}
                        />
                      </>
                    ) : 'No balance'}
                  </div>
                </Row>
                <Row>
                  <div>
                    <strong>NO Position:</strong> {currencyPositions.no ? (
                      <>
                        Balance: <span style={{ color: 'green' }}>{currencyPositions.no.userBalanceERC1155WithDecimals}</span> (ERC1155)
                        {currencyPositions.no.userBalanceERC20.gt(ZERO_BN) && currencyPositions.no.wrappedTokenAddress && (
                          <span>
                            {' '}+ <span style={{ color: 'blue' }}>{currencyPositions.no.userBalanceERC20WithDecimals}</span> ({wrappedTokenInfo[currencyPositions.no.wrappedTokenAddress]?.symbol || 'Loading...'})
                          </span>
                        )}
                        <div style={{ marginTop: '4px', color: 'red' }}>
                          Total Available: {ethers.utils.formatUnits(currencyPositions.no.userBalanceERC1155.add(currencyPositions.no.userBalanceERC20), decimals)}
                        </div>
                        {currencyPositions.no.wrappedTokenAddress && (
                          <div style={{ marginTop: '4px', fontSize: '12px' }}>
                            <span>Wrapped Token Address: </span>
                            <a href={`https://blockscout.com/xdai/mainnet/address/${currencyPositions.no.wrappedTokenAddress}`} target="_blank" rel="noopener noreferrer">
                              <FormatHash hash={truncateStringInTheMiddle(currencyPositions.no.wrappedTokenAddress, 8, 6)} />
                            </a>
                            <ButtonCopy value={currencyPositions.no.wrappedTokenAddress} />
                            <ExternalLink href={`https://blockscout.com/xdai/mainnet/address/${currencyPositions.no.wrappedTokenAddress}`} />
                          </div>
                        )}
                        <QuickWrapUnwrap
                          balanceERC1155={currencyPositions.no.userBalanceERC1155}
                          balanceERC20={currencyPositions.no.userBalanceERC20}
                          decimals={decimals}
                          onUnwrap={async (transferValue) => {
                            try {
                              logger.info('Starting unwrap in Merge Positions with values:', {
                                transferValue,
                                walletAddress,
                                CTServiceAddress: CTService?.address,
                                isUsingCPK: isUsingTheCPKAddress(),
                                wrappedTokenAddress: currencyPositions.no?.wrappedTokenAddress
                              })

                              const noPosition = currencyPositions.no
                              if (!noPosition || !CPKService || !walletAddress || !CTService || !WrapperService) {
                                throw new Error('Required services or position data not available')
                              }

                              const { amount, positionId, tokenBytes } = transferValue
                              
                              logger.info('Unwrap parameters:', {
                                amount: amount.toString(),
                                positionId,
                                tokenBytes,
                                walletAddress
                              })

                              setTransactionTitle('Unwrapping ERC20')
                              setTransfer(Remote.loading())

                              if (isUsingTheCPKAddress()) {
                                logger.info('Unwrapping with CPK')
                                await CPKService.unwrap({
                                  CTService,
                                  WrapperService,
                                  addressFrom: CTService.address,
                                  addressTo: walletAddress,
                                  positionId,
                                  amount,
                                  tokenBytes,
                                })
                              } else {
                                logger.info('Unwrapping without CPK')
                                await WrapperService.unwrap(
                                  CTService.address,
                                  positionId,
                                  amount,
                                  walletAddress,
                                  tokenBytes
                                )
                              }

                              await refetchPositions()
                              setTransfer(Remote.success(transferValue))
                              logger.info('Unwrap completed successfully')
                            } catch (err) {
                              logger.error('Unwrap error in Merge Positions:', err)
                              logger.error('Error details:', {
                                error: err,
                                transferValue,
                                walletAddress,
                                CTServiceAddress: CTService?.address,
                                wrappedTokenAddress: currencyPositions.no?.wrappedTokenAddress
                              })
                              setTransfer(Remote.failure(err instanceof Error ? err : new Error(String(err))))
                            }
                          }}
                          onWrap={async (transferValue) => {
                            try {
                              if (CPKService && walletAddress && CTService) {
                                setTransactionTitle('Wrapping ERC1155')
                                setTransfer(Remote.loading())

                                const { address: addressTo, amount, positionId, tokenBytes } = transferValue
                                if (isUsingTheCPKAddress()) {
                                  await CPKService.wrapOrTransfer({
                                    CTService,
                                    addressFrom: walletAddress,
                                    addressTo,
                                    positionId,
                                    amount,
                                    tokenBytes,
                                  })
                                } else {
                                  await CTService.safeTransferFrom(
                                    walletAddress,
                                    addressTo,
                                    positionId,
                                    amount,
                                    tokenBytes
                                  )
                                }

                                await refetchPositions()
                                setTransfer(Remote.success(transferValue))
                              }
                            } catch (err) {
                              logger.error('Wrap error:', err)
                              setTransfer(Remote.failure(err instanceof Error ? err : new Error(String(err))))
                            }
                          }}
                          positionId={currencyPositions.no.id}
                          symbol={collateralToken?.symbol || 'WXDAI'}
                          tokenName={currencyPositions.no.wrappedTokenAddress ? wrappedTokenInfo[currencyPositions.no.wrappedTokenAddress]?.name || 'Loading...' : 'Loading...'}
                          tokenSymbol={currencyPositions.no.wrappedTokenAddress ? wrappedTokenInfo[currencyPositions.no.wrappedTokenAddress]?.symbol || 'Loading...' : 'Loading...'}
                          wrappedName={`Wrapped ERC-1155`}
                          wrappedSymbol={currencyPositions.no.wrappedTokenAddress ? wrappedTokenInfo[currencyPositions.no.wrappedTokenAddress]?.symbol || 'Loading...' : 'Loading...'}
                          wrappedCollateralAddress={currencyPositions.no.wrappedTokenAddress || undefined}
                        />
                      </>
                    ) : 'No balance'}
                  </div>
                </Row>
                <Row>
                  <div>
                    <div style={{ marginBottom: '8px', fontSize: '12px', color: 'gray' }}>
                      Max amount includes both unwrapped (ERC1155) and wrapped (ERC20) tokens. If needed, tokens will be automatically unwrapped before merging.
                    </div>
                    <Amount
                      amount={amount}
                      balance={maxBalance}
                      decimals={decimals}
                      isFromAPosition
                      max={maxBalance.toString()}
                      onAmountChange={onAmountChange}
                      onUseWalletBalance={onUsePositionBalance}
                    />
                    {needsWrapping && (
                      <WarningMessage status={StatusInfoType.warning}>
                        <div>
                          <div>This merge requires unwrapping tokens first. Required steps:</div>
                          {getUnwrapSteps()?.map((step, index) => (
                            <div key={index} style={{ marginLeft: '20px', marginTop: '4px' }}>
                              {index + 1}. Unwrap {ethers.utils.formatUnits(step.amount, decimals)} {step.symbol} from {step.type} position
                            </div>
                          ))}
                          <div style={{ marginTop: '8px' }}>
                            Click "Unwrap & Merge" to automatically perform these steps and merge the positions.
                          </div>
                        </div>
                      </WarningMessage>
                    )}
                  </div>
                </Row>
                {error && (
                  <StatusInfoInline status={StatusInfoType.warning}>
                    {error}
                  </StatusInfoInline>
                )}
                <ButtonContainer>
                  {needsWrapping ? (
                    <>
                      <WarningMessage status={StatusInfoType.warning}>
                        <div>
                          <div>Please unwrap tokens before merging:</div>
                          {getUnwrapSteps()?.map((step, index) => (
                            <div key={index} style={{ marginLeft: '20px', marginTop: '4px' }}>
                              {index + 1}. Use the <strong>Unwrap</strong> button above in the {step.type} position section to unwrap {ethers.utils.formatUnits(step.amount, decimals)} {step.symbol}
                            </div>
                          ))}
                        </div>
                      </WarningMessage>
                      <Button 
                        disabled={true}
                        buttonType={ButtonType.primary}
                      >
                        Merge Currency Positions (Unwrap Required)
                      </Button>
                    </>
                  ) : (
                    <Button 
                      disabled={disabled} 
                      onClick={onMerge}
                      buttonType={ButtonType.primary}
                    >
                      Merge Currency Positions
                    </Button>
                  )}
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
                <div>
                  <div style={{ marginBottom: '8px', fontSize: '12px', color: 'gray' }}>
                    Max amount includes both unwrapped (ERC1155) and wrapped (ERC20) tokens. If needed, tokens will be automatically unwrapped before merging.
                  </div>
        <Amount
          amount={amount}
          balance={maxBalance}
          decimals={decimals}
                    isFromAPosition
          max={maxBalance.toString()}
          onAmountChange={onAmountChange}
          onUseWalletBalance={onUsePositionBalance}
        />
                  {needsWrapping && (
                    <WarningMessage status={StatusInfoType.warning}>
                      {`This merge will require unwrapping some tokens first. The process will be handled automatically. Available: ${ethers.utils.formatUnits(maxBalance, decimals)} (ERC1155 + ERC20)`}
                    </WarningMessage>
                  )}
                </div>
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
                  {needsWrapping ? 'Unwrap & Merge Positions' : 'Merge Positions'}
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
