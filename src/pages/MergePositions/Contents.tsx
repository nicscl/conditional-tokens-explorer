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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getTokenBytecode } = require('1155-to-20-helper/src')

const logger = getLogger('MergePosition')

const ModeSwitcher = styled(Row)`
  margin-bottom: 24px;
  justify-content: center;
  gap: 12px;
`

const WarningMessage = styled(StatusInfoInline)`
  margin-top: 8px;
`

const UnwrapStep = styled.div`
  margin-left: 20px;
  margin-top: 4px;
  cursor: pointer;
  color: #0066cc;
  text-decoration: underline;
  
  &:hover {
    color: #004c99;
  }
`

const StyledStatusInfo = styled(StatusInfoInline)`
  margin-left: 20px;
  margin-top: 4px;
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

  const [currencyAmount, setCurrencyAmount] = useState<BigNumber>(ZERO_BN)
  const [companyAmount, setCompanyAmount] = useState<BigNumber>(ZERO_BN)
  const [advancedAmount, setAdvancedAmount] = useState<BigNumber>(ZERO_BN)

  const [collateralToken, setCollateralToken] = useState<Maybe<Token>>(null)
  const [mergeResult, setMergeResult] = useState<string>('')
  const [wrappedTokenInfo, setWrappedTokenInfo] = useState<{ [address: string]: Token }>({})
  const [transfer, setTransfer] = useState<Remote<TransferOptions>>(Remote.notAsked<TransferOptions>())
  const [transactionTitle, setTransactionTitle] = useState<string>('')

  const [unwrapStatus, setUnwrapStatus] = useState<{ success: boolean; message: string }>({ success: false, message: '' });

  const quickMergeConfig = useMemo(() => {
    if (!networkConfig) return null
    return quickMergeConfigs[networkConfig.networkId]?.[0] || null
  }, [networkConfig])

  const { condition } = useCondition(quickMergeConfig?.conditionId || null)
  const { data: positions, refetchPositions } = usePositionsList(defaultAdvancedFilter)

  // Find mergeable positions for currency token
  const currencyPositions = useMemo(() => {
    if (!positions || !quickMergeConfig) return { yes: null, no: null }
    
    const yesPosition = positions.find(p => p.id === quickMergeConfig.currencyPositions.yes.positionId)
    const noPosition = positions.find(p => p.id === quickMergeConfig.currencyPositions.no.positionId)
    
    return { yes: yesPosition || null, no: noPosition || null }
  }, [positions, quickMergeConfig])

  // Find mergeable positions for company token
  const companyPositions = useMemo(() => {
    if (!positions || !quickMergeConfig?.companyPositions) return { yes: null, no: null }
    
    const config = quickMergeConfig.companyPositions
    const yesPosition = positions.find(p => p.id === config?.yes?.positionId)
    const noPosition = positions.find(p => p.id === config?.no?.positionId)
    
    return { yes: yesPosition || null, no: noPosition || null }
  }, [positions, quickMergeConfig])

  // Set mergeable positions for quick mode
  useEffect(() => {
    if (mode === 'quick') {
      if (currencyPositions.yes && currencyPositions.no) {
        // Set the positions that will be merged for currency
      setSelectedPositions([currencyPositions.yes, currencyPositions.no])
      } else if (companyPositions.yes && companyPositions.no) {
        // Set the positions that will be merged for company
        setSelectedPositions([companyPositions.yes, companyPositions.no])
      }
      // Set the condition ID
      if (quickMergeConfig) {
        setConditionId(quickMergeConfig.conditionId)
      }
    }
  }, [mode, currencyPositions, companyPositions, quickMergeConfig])

  // Calculate max mergeable amount for currency positions
  const maxCurrencyBalance = useMemo(() => {
    if (!currencyPositions.yes || !currencyPositions.no) return ZERO_BN
    
    const yesTotalBalance = currencyPositions.yes.userBalanceERC1155.add(currencyPositions.yes.userBalanceERC20)
    const noTotalBalance = currencyPositions.no.userBalanceERC1155.add(currencyPositions.no.userBalanceERC20)
    
    return yesTotalBalance.gt(noTotalBalance) ? noTotalBalance : yesTotalBalance
  }, [currencyPositions])

  // Calculate max mergeable amount for company positions
  const maxCompanyBalance = useMemo(() => {
    if (!companyPositions.yes || !companyPositions.no) return ZERO_BN
    
    const yesTotalBalance = companyPositions.yes.userBalanceERC1155.add(companyPositions.yes.userBalanceERC20)
    const noTotalBalance = companyPositions.no.userBalanceERC1155.add(companyPositions.no.userBalanceERC20)
    
    return yesTotalBalance.gt(noTotalBalance) ? noTotalBalance : yesTotalBalance
  }, [companyPositions])

  // Get the appropriate max balance based on context
  const maxBalance = useMemo(() => {
    if (mode === 'advanced') {
      if (selectedPositions.length < 2) return ZERO_BN
      const [pos1, pos2] = selectedPositions
      if (!pos1 || !pos2) return ZERO_BN
      
      const balance1 = pos1.userBalanceERC1155.add(pos1.userBalanceERC20)
      const balance2 = pos2.userBalanceERC1155.add(pos2.userBalanceERC20)
      
      return balance1.gt(balance2) ? balance2 : balance1
    }

    // For quick mode, determine which section we're in
    const positions = selectedPositions.length > 0 ? selectedPositions : currencyPositions
    const isCompanySection = positions === companyPositions

    return isCompanySection ? maxCompanyBalance : maxCurrencyBalance
  }, [mode, selectedPositions, currencyPositions, companyPositions, maxCurrencyBalance, maxCompanyBalance])

  const onCurrencyAmountChange = useCallback((value: BigNumber) => {
    if (value.gt(maxCurrencyBalance)) {
      setCurrencyAmount(maxCurrencyBalance)
    } else {
      setCurrencyAmount(value)
    }
  }, [maxCurrencyBalance])

  const onCompanyAmountChange = useCallback((value: BigNumber) => {
    if (value.gt(maxCompanyBalance)) {
      setCompanyAmount(maxCompanyBalance)
    } else {
      setCompanyAmount(value)
    }
  }, [maxCompanyBalance])

  const onAdvancedAmountChange = useCallback((value: BigNumber) => {
    if (value.gt(maxBalance)) {
      setAdvancedAmount(maxBalance)
    } else {
      setAdvancedAmount(value)
    }
  }, [maxBalance])

  const onCurrencyUseBalance = useCallback(() => {
    if (maxCurrencyBalance.gt(ZERO_BN)) {
      setCurrencyAmount(maxCurrencyBalance)
    }
  }, [maxCurrencyBalance])

  const onCompanyUseBalance = useCallback(() => {
    if (maxCompanyBalance.gt(ZERO_BN)) {
      setCompanyAmount(maxCompanyBalance)
    }
  }, [maxCompanyBalance])

  const onAdvancedUseBalance = useCallback(() => {
    if (maxBalance.gt(ZERO_BN)) {
      setAdvancedAmount(maxBalance)
    }
  }, [maxBalance])

  // Check if wrapping is needed for currency positions
  const needsCurrencyWrapping = useMemo(() => {
    if (!currencyAmount) return false

    if (!currencyPositions.yes || !currencyPositions.no) return false

    const yesNeedsWrapping = currencyPositions.yes.userBalanceERC1155.lt(currencyAmount) && 
      currencyPositions.yes.userBalanceERC1155.add(currencyPositions.yes.userBalanceERC20).gte(currencyAmount)

    const noNeedsWrapping = currencyPositions.no.userBalanceERC1155.lt(currencyAmount) && 
      currencyPositions.no.userBalanceERC1155.add(currencyPositions.no.userBalanceERC20).gte(currencyAmount)

    return yesNeedsWrapping || noNeedsWrapping
  }, [currencyAmount, currencyPositions])

  // Check if wrapping is needed for company positions
  const needsCompanyWrapping = useMemo(() => {
    if (!companyAmount) return false

    if (!companyPositions.yes || !companyPositions.no) return false

    const yesNeedsWrapping = companyPositions.yes.userBalanceERC1155.lt(companyAmount) && 
      companyPositions.yes.userBalanceERC1155.add(companyPositions.yes.userBalanceERC20).gte(companyAmount)

    const noNeedsWrapping = companyPositions.no.userBalanceERC1155.lt(companyAmount) && 
      companyPositions.no.userBalanceERC1155.add(companyPositions.no.userBalanceERC20).gte(companyAmount)

    return yesNeedsWrapping || noNeedsWrapping
  }, [companyAmount, companyPositions])

  // Get unwrap steps for currency positions
  const getCurrencyUnwrapSteps = useCallback(() => {
    if (!currencyAmount || !currencyPositions.yes || !currencyPositions.no) return []

    const steps = []
    if (currencyPositions.yes.userBalanceERC1155.lt(currencyAmount) && 
        currencyPositions.yes.userBalanceERC1155.add(currencyPositions.yes.userBalanceERC20).gte(currencyAmount)) {
      steps.push({
        type: 'YES',
        amount: currencyAmount.sub(currencyPositions.yes.userBalanceERC1155),
        symbol: 'WXDAI_Y'
      })
    }
    if (currencyPositions.no.userBalanceERC1155.lt(currencyAmount) && 
        currencyPositions.no.userBalanceERC1155.add(currencyPositions.no.userBalanceERC20).gte(currencyAmount)) {
      steps.push({
        type: 'NO',
        amount: currencyAmount.sub(currencyPositions.no.userBalanceERC1155),
        symbol: 'WXDAI_N'
      })
    }
    return steps
  }, [currencyAmount, currencyPositions])

  // Get unwrap steps for company positions
  const getCompanyUnwrapSteps = useCallback(() => {
    if (!companyAmount || !companyPositions.yes || !companyPositions.no) return []

    const steps = []
    if (companyPositions.yes.userBalanceERC1155.lt(companyAmount) && 
        companyPositions.yes.userBalanceERC1155.add(companyPositions.yes.userBalanceERC20).gte(companyAmount)) {
      steps.push({
        type: 'YES',
        amount: companyAmount.sub(companyPositions.yes.userBalanceERC1155),
        symbol: 'FUTA_Y'
      })
    }
    if (companyPositions.no.userBalanceERC1155.lt(companyAmount) && 
        companyPositions.no.userBalanceERC1155.add(companyPositions.no.userBalanceERC20).gte(companyAmount)) {
      steps.push({
        type: 'NO',
        amount: companyAmount.sub(companyPositions.no.userBalanceERC1155),
        symbol: 'FUTA_N'
      })
    }
    return steps
  }, [companyAmount, companyPositions])

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

  // For advanced mode
  const advancedNeedsWrapping = useMemo(() => {
    if (!advancedAmount || mode !== 'advanced') return false
    if (selectedPositions.length < 2) return false
    const [pos1, pos2] = selectedPositions
    if (!pos1 || !pos2) return false

    const pos1NeedsWrapping = pos1.userBalanceERC1155.lt(advancedAmount) && 
      pos1.userBalanceERC1155.add(pos1.userBalanceERC20).gte(advancedAmount)

    const pos2NeedsWrapping = pos2.userBalanceERC1155.lt(advancedAmount) && 
      pos2.userBalanceERC1155.add(pos2.userBalanceERC20).gte(advancedAmount)

    return pos1NeedsWrapping || pos2NeedsWrapping
  }, [advancedAmount, mode, selectedPositions])

  // Helper function to check if positions is an array
  const isPositionsArray = (positions: PositionWithUserBalanceWithDecimals[] | { 
    yes: PositionWithUserBalanceWithDecimals | null; 
    no: PositionWithUserBalanceWithDecimals | null; 
  }): positions is PositionWithUserBalanceWithDecimals[] => {
    return Array.isArray(positions)
  }

  // Helper function to check if positions is a yes/no object
  const isPositionsObject = (positions: PositionWithUserBalanceWithDecimals[] | { 
    yes: PositionWithUserBalanceWithDecimals | null; 
    no: PositionWithUserBalanceWithDecimals | null; 
  }): positions is { 
    yes: PositionWithUserBalanceWithDecimals | null; 
    no: PositionWithUserBalanceWithDecimals | null; 
  } => {
    return !Array.isArray(positions) && 'yes' in positions && 'no' in positions
  }

  const onMerge = useCallback(async (positionType: 'currency' | 'company' | 'advanced' = 'currency') => {
    const mergeAmount = positionType === 'currency' ? currencyAmount : 
                       positionType === 'company' ? companyAmount : 
                       advancedAmount
    try {
      if (
        status === Web3ContextStatus.Connected &&
        CPKService &&
        walletAddress &&
        condition &&
        quickMergeConfig
      ) {
        setTransactionStatus(Remote.loading())

        // Get the correct positions and wrapping state based on position type
        const positions = positionType === 'currency' ? currencyPositions : 
                         positionType === 'company' ? companyPositions : 
                         selectedPositions
        const needsWrapping = positionType === 'currency' ? needsCurrencyWrapping : 
                            positionType === 'company' ? needsCompanyWrapping : 
                            advancedNeedsWrapping

        // Type check for positions object vs array
        if (positionType === 'advanced') {
          if (selectedPositions.length < 2) {
            throw new Error('Not enough positions selected for advanced merge')
          }
          const [pos1, pos2] = selectedPositions
          if (!pos1 || !pos2) {
            throw new Error('Invalid positions for advanced merge')
          }
        } else if (!isPositionsObject(positions) || !positions.yes || !positions.no) {
          throw new Error(`No ${positionType} positions found`)
        }

        // Check if we need to wrap tokens first
        if (needsWrapping) {
          logger.info(`Wrapping ${positionType} tokens before merge`)
          
          if (isPositionsObject(positions)) {
            const { yes, no } = positions
          // Handle YES position wrapping if needed
            if (yes && yes.userBalanceERC1155.lt(mergeAmount)) {
              const amountToWrap = mergeAmount.sub(yes.userBalanceERC1155)
              if (amountToWrap.gt(ZERO_BN) && yes.wrappedTokenAddress) {
                logger.info(`Wrapping YES ${positionType} position tokens:`, amountToWrap.toString())
              await CTService.safeTransferFrom(
                walletAddress,
                  yes.wrappedTokenAddress,
                  yes.id,
                amountToWrap,
                ethers.utils.defaultAbiCoder.encode(
                  ['string', 'bytes32'],
                    ['Wrapped ERC-1155', ethers.utils.id(positionType === 'currency' ? 'WXDAI_Y' : 'FUTA_Y')]
                )
              )
            }
          }

          // Handle NO position wrapping if needed
            if (no && no.userBalanceERC1155.lt(mergeAmount)) {
              const amountToWrap = mergeAmount.sub(no.userBalanceERC1155)
              if (amountToWrap.gt(ZERO_BN) && no.wrappedTokenAddress) {
                logger.info(`Wrapping NO ${positionType} position tokens:`, amountToWrap.toString())
              await CTService.safeTransferFrom(
                walletAddress,
                  no.wrappedTokenAddress,
                  no.id,
                amountToWrap,
                ethers.utils.defaultAbiCoder.encode(
                  ['string', 'bytes32'],
                    ['Wrapped ERC-1155', ethers.utils.id(positionType === 'currency' ? 'WXDAI_N' : 'FUTA_N')]
                  )
                )
              }
            }
          } else {
            // Handle advanced mode wrapping
            const [pos1, pos2] = positions
            if (pos1 && pos1.userBalanceERC1155.lt(mergeAmount)) {
              const amountToWrap = mergeAmount.sub(pos1.userBalanceERC1155)
              if (amountToWrap.gt(ZERO_BN) && pos1.wrappedTokenAddress) {
                logger.info('Wrapping Position 1 tokens:', amountToWrap.toString())
                await CTService.safeTransferFrom(
                  walletAddress,
                  pos1.wrappedTokenAddress,
                  pos1.id,
                  amountToWrap,
                  ethers.utils.defaultAbiCoder.encode(['string', 'bytes32'], ['Wrapped ERC-1155', ethers.utils.id('ERC20')])
                )
              }
            }

            if (pos2 && pos2.userBalanceERC1155.lt(mergeAmount)) {
              const amountToWrap = mergeAmount.sub(pos2.userBalanceERC1155)
              if (amountToWrap.gt(ZERO_BN) && pos2.wrappedTokenAddress) {
                logger.info('Wrapping Position 2 tokens:', amountToWrap.toString())
                await CTService.safeTransferFrom(
                  walletAddress,
                  pos2.wrappedTokenAddress,
                  pos2.id,
                  amountToWrap,
                  ethers.utils.defaultAbiCoder.encode(['string', 'bytes32'], ['Wrapped ERC-1155', ethers.utils.id('ERC20')])
                )
              }
            }
          }

          // Refetch positions to get updated balances
          await refetchPositions()
        }

        // Get the positions to merge and ensure they are not null
        const positionsToMerge = isPositionsObject(positions) ? 
          (positions.yes && positions.no ? [positions.yes, positions.no] : []) : 
          positions.filter((pos): pos is PositionWithUserBalanceWithDecimals => pos !== null)

        if (positionsToMerge.length < 2) {
          throw new Error('Not enough valid positions to merge')
        }

        const { collateralToken: posCollateralToken, conditionIds, indexSets } = positionsToMerge[0]
        
        logger.info('Merge positions data:', {
          positionsToMerge: positionsToMerge.map(p => ({
            id: p.id,
            conditionIds: p.conditionIds,
            indexSets: p.indexSets
          })),
          conditionId: quickMergeConfig.conditionId
        })

        // Calculate parent collection ID
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

        // Create partition array with validation
        const partition = positionsToMerge.map(({ conditionIds, indexSets }) => {
          const conditionIndex = conditionIds.findIndex(id => id === quickMergeConfig.conditionId)
          if (conditionIndex === -1) {
            logger.error('Condition not found in position:', {
              positionConditionIds: conditionIds,
              targetConditionId: quickMergeConfig.conditionId
            })
            throw new Error('Position does not contain the target condition')
          }

          const indexSet = indexSets[conditionIndex]
          if (!indexSet) {
            logger.error('Index set not found for condition:', {
              conditionIndex,
              indexSets,
              conditionId: quickMergeConfig.conditionId
            })
            throw new Error('Index set not found for condition')
          }

          return indexSet
        })

        logger.info('Created partition:', {
          partition,
          conditionId: quickMergeConfig.conditionId
        })

        // Validate partition before converting to BigNumber
        if (!partition.every(Boolean)) {
          logger.error('Invalid partition data:', { partition })
          throw new Error('Invalid partition data: some values are undefined')
        }

        const partitionBN: BigNumber[] = partition.map((indexSet) => {
          if (!indexSet) {
            throw new Error('Unexpected undefined index set')
          }
          return new BigNumber(indexSet)
        })

        if (partitionBN.length !== 2) {
          throw new Error(`Expected 2 positions to merge, got ${partitionBN.length}`)
        }

        logger.info('Final merge parameters:', {
          partition: partitionBN.map(bn => bn.toString()),
          conditionId: quickMergeConfig.conditionId,
          parentCollectionId,
          posCollateralToken,
          mergeAmount: mergeAmount.toString()
        })

        const shouldTransferAmount = isConditionFullIndexSet(
          positionsToMerge,
          quickMergeConfig.conditionId,
          condition.outcomeSlotCount
        )

        if (isUsingTheCPKAddress()) {
          await CPKService.mergePositions({
            CTService,
            amount: mergeAmount,
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
            mergeAmount
          )
        }

            setMergeResult(
          parentCollectionId === NULL_PARENT_ID
            ? posCollateralToken
            : ConditionalTokensService.getPositionId(posCollateralToken, parentCollectionId)
        )
        setTransactionStatus(Remote.success(mergeAmount))
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setTransactionStatus(Remote.failure(error))
      logger.error(`${positionType} Merge error:`, error)
    }
  }, [
    status,
    CPKService,
    walletAddress,
    condition,
    quickMergeConfig,
    currencyAmount,
    companyAmount,
    advancedAmount,
    CTService,
    currencyPositions,
    companyPositions,
    selectedPositions,
    needsCurrencyWrapping,
    needsCompanyWrapping,
    advancedNeedsWrapping,
    refetchPositions,
    isUsingTheCPKAddress,
    logger
  ])

  const decimals = useMemo(() => (collateralToken ? collateralToken.decimals : 0), [collateralToken])

  const isLoading = useMemo(
    () => !condition || transactionStatus.isLoading(),
    [condition, transactionStatus]
  )

  const disabledCurrency = useMemo(() => {
    if (isLoading || status !== Web3ContextStatus.Connected) return true
    if (!currencyPositions.yes || !currencyPositions.no) return true
    if (currencyAmount.isZero()) return true
    if (currencyAmount.gt(maxCurrencyBalance)) return true
    return false
  }, [isLoading, status, currencyPositions, currencyAmount, maxCurrencyBalance])

  const disabledCompany = useMemo(() => {
    if (isLoading || status !== Web3ContextStatus.Connected) return true
    if (!companyPositions.yes || !companyPositions.no) return true
    if (companyAmount.isZero()) return true
    if (companyAmount.gt(maxCompanyBalance)) return true
    return false
  }, [isLoading, status, companyPositions, companyAmount, maxCompanyBalance])

  // Get the current positions based on mode and section
  const getCurrentPositions = useCallback(() => {
    if (mode === 'advanced') {
      return selectedPositions
    }

    const positions = selectedPositions.length > 0 ? selectedPositions : currencyPositions
    const isCompanySection = positions === companyPositions

    return isCompanySection ? companyPositions : currencyPositions
  }, [mode, selectedPositions, currencyPositions, companyPositions])

  // Get whether we're in company section
  const isCompanySection = useMemo(() => {
    const positions = getCurrentPositions()
    return positions === companyPositions
  }, [getCurrentPositions, companyPositions])

  // Advanced mode unwrap steps
  const getAdvancedUnwrapSteps = useCallback(() => {
    if (!advancedAmount || mode !== 'advanced') return []
    if (selectedPositions.length < 2) return []
    const [pos1, pos2] = selectedPositions
    if (!pos1 || !pos2) return []

    const steps = []
    if (pos1.userBalanceERC1155.lt(advancedAmount) && 
        pos1.userBalanceERC1155.add(pos1.userBalanceERC20).gte(advancedAmount)) {
      steps.push({
        type: 'Position 1',
        amount: advancedAmount.sub(pos1.userBalanceERC1155),
        symbol: 'ERC20'
      })
    }
    if (pos2.userBalanceERC1155.lt(advancedAmount) && 
        pos2.userBalanceERC1155.add(pos2.userBalanceERC20).gte(advancedAmount)) {
      steps.push({
        type: 'Position 2',
        amount: advancedAmount.sub(pos2.userBalanceERC1155),
        symbol: 'ERC20'
      })
    }
    return steps
  }, [advancedAmount, mode, selectedPositions])

  const disabledAdvanced = useMemo(() => {
    if (isLoading || status !== Web3ContextStatus.Connected) return true
    if (mergeablePositions.length === 0) return true
    if (advancedAmount.isZero()) return true
    if (advancedAmount.gt(maxBalance)) return true
    if (advancedNeedsWrapping) return true
    return false
  }, [isLoading, status, mergeablePositions, advancedAmount, maxBalance, advancedNeedsWrapping])

  const currencyError = useMemo(() => {
    if (!isPositionsObject(currencyPositions) || !currencyPositions.yes || !currencyPositions.no) {
      return 'No mergeable currency positions found for this condition'
    }

      if (currencyPositions.yes.userBalanceERC1155.add(currencyPositions.yes.userBalanceERC20).isZero() || 
          currencyPositions.no.userBalanceERC1155.add(currencyPositions.no.userBalanceERC20).isZero()) {
      return 'Insufficient total balance (ERC1155 + ERC20) to merge currency positions'
      }

    if (currencyAmount.gt(maxCurrencyBalance)) {
      return `Amount exceeds maximum available balance of ${ethers.utils.formatUnits(maxCurrencyBalance, decimals)}`
      }

    return null
  }, [currencyPositions, currencyAmount, maxCurrencyBalance, decimals])

  const companyError = useMemo(() => {
    if (!isPositionsObject(companyPositions) || !companyPositions.yes || !companyPositions.no) {
      return 'No mergeable company positions found for this condition'
    }

    if (companyPositions.yes.userBalanceERC1155.add(companyPositions.yes.userBalanceERC20).isZero() || 
        companyPositions.no.userBalanceERC1155.add(companyPositions.no.userBalanceERC20).isZero()) {
      return 'Insufficient total balance (ERC1155 + ERC20) to merge company positions'
    }

    if (companyAmount.gt(maxCompanyBalance)) {
      return `Amount exceeds maximum available balance of ${ethers.utils.formatUnits(maxCompanyBalance, decimals)}`
    }

    return null
  }, [companyPositions, companyAmount, maxCompanyBalance, decimals])

  const advancedError = useMemo(() => {
    if (mergeablePositions.length === 0) {
      return 'No mergeable positions found for this condition'
    }

    if (advancedAmount.gt(maxBalance)) {
      return `Amount exceeds maximum available balance of ${ethers.utils.formatUnits(maxBalance, decimals)}`
    }

    return null
  }, [mergeablePositions, advancedAmount, maxBalance, decimals])

  const onWrapYes = useCallback(async (transferValue: TransferOptions) => {
    try {
      if (!quickMergeConfig || !CPKService || !walletAddress || !CTService) {
        throw new Error('Required services or config not available')
      }

      setTransactionTitle('Wrapping YES Position ERC1155')
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
    } catch (err) {
      logger.error('Wrap error:', err)
      setTransfer(Remote.failure(err instanceof Error ? err : new Error(String(err))))
    }
  }, [quickMergeConfig, CPKService, walletAddress, CTService, isUsingTheCPKAddress, logger, refetchPositions, setTransactionTitle, setTransfer])

  const onWrapNo = useCallback(async (transferValue: TransferOptions) => {
    try {
      if (!quickMergeConfig || !CPKService || !walletAddress || !CTService) {
        throw new Error('Required services or config not available')
      }

      setTransactionTitle('Wrapping NO Position ERC1155')
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
    } catch (err) {
      logger.error('Wrap error:', err)
      setTransfer(Remote.failure(err instanceof Error ? err : new Error(String(err))))
    }
  }, [quickMergeConfig, CPKService, walletAddress, CTService, isUsingTheCPKAddress, logger, refetchPositions, setTransactionTitle, setTransfer])

  const onUnwrapYes = useCallback(async (transferValue: TransferOptions) => {
    try {
      if (!quickMergeConfig || !currencyPositions.yes || !CPKService || !walletAddress || !CTService || !WrapperService) {
        throw new Error('Required services or position data not available')
      }

      logger.info('Starting unwrap YES position with values:', {
        transferValue,
        walletAddress,
        CTServiceAddress: CTService?.address,
        isUsingCPK: isUsingTheCPKAddress(),
        config: quickMergeConfig.currencyPositions.yes.wrap
      })

      setTransactionTitle('Unwrapping YES Position ERC20')
      setTransfer(Remote.loading())

      if (isUsingTheCPKAddress()) {
        logger.info('Unwrapping with CPK')
        await CPKService.unwrap({
          CTService,
          WrapperService,
          addressFrom: CTService.address,
          addressTo: walletAddress,
          positionId: transferValue.positionId,
          amount: transferValue.amount,
          tokenBytes: transferValue.tokenBytes,
        })
      } else {
        logger.info('Unwrapping without CPK')
        await WrapperService.unwrap(
          CTService.address,
          transferValue.positionId,
          transferValue.amount,
          walletAddress,
          transferValue.tokenBytes
        )
      }

      await refetchPositions()
      setTransfer(Remote.success(transferValue))
      logger.info('Unwrap completed successfully')
    } catch (err) {
      logger.error('Unwrap error in Merge Positions:', err)
      setTransfer(Remote.failure(err instanceof Error ? err : new Error(String(err))))
    }
  }, [quickMergeConfig, currencyPositions.yes, CPKService, walletAddress, CTService, WrapperService, isUsingTheCPKAddress, logger, refetchPositions])

  const onUnwrapNo = useCallback(async (transferValue: TransferOptions) => {
    try {
      if (!quickMergeConfig || !currencyPositions.no || !CPKService || !walletAddress || !CTService || !WrapperService) {
        throw new Error('Required services or position data not available')
      }

      logger.info('Starting unwrap NO position with values:', {
        transferValue,
        walletAddress,
        CTServiceAddress: CTService?.address,
        isUsingCPK: isUsingTheCPKAddress(),
        config: quickMergeConfig.currencyPositions.no.wrap
      })

      setTransactionTitle('Unwrapping NO Position ERC20')
      setTransfer(Remote.loading())

      if (isUsingTheCPKAddress()) {
        logger.info('Unwrapping with CPK')
        await CPKService.unwrap({
          CTService,
          WrapperService,
          addressFrom: CTService.address,
          addressTo: walletAddress,
          positionId: transferValue.positionId,
          amount: transferValue.amount,
          tokenBytes: transferValue.tokenBytes,
        })
      } else {
        logger.info('Unwrapping without CPK')
        await WrapperService.unwrap(
          CTService.address,
          transferValue.positionId,
          transferValue.amount,
          walletAddress,
          transferValue.tokenBytes
        )
      }

      await refetchPositions()
      setTransfer(Remote.success(transferValue))
      logger.info('Unwrap completed successfully')
    } catch (err) {
      logger.error('Unwrap error in Merge Positions:', err)
      setTransfer(Remote.failure(err instanceof Error ? err : new Error(String(err))))
    }
  }, [quickMergeConfig, currencyPositions.no, CPKService, walletAddress, CTService, WrapperService, isUsingTheCPKAddress, logger, refetchPositions])

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
    if (!currencyAmount || !currencyPositions.yes || !currencyPositions.no || !quickMergeConfig) return null

    const steps = []
    
    // Check YES position
    if (currencyPositions.yes.userBalanceERC1155.lt(currencyAmount)) {
      const amountToUnwrap = currencyAmount.sub(currencyPositions.yes.userBalanceERC1155)
      if (amountToUnwrap.gt(ZERO_BN)) {
        steps.push({
          type: 'YES',
          amount: amountToUnwrap,
          symbol: quickMergeConfig.currencyPositions.yes.wrap.tokenSymbol
        })
      }
    }

    // Check NO position
    if (currencyPositions.no.userBalanceERC1155.lt(currencyAmount)) {
      const amountToUnwrap = currencyAmount.sub(currencyPositions.no.userBalanceERC1155)
      if (amountToUnwrap.gt(ZERO_BN)) {
        steps.push({
          type: 'NO',
          amount: amountToUnwrap,
          symbol: quickMergeConfig.currencyPositions.no.wrap.tokenSymbol
        })
      }
    }

    return steps.length > 0 ? steps : null
  }, [currencyAmount, currencyPositions, quickMergeConfig])

  const onUnwrap = useCallback(async () => {
    try {
      const steps = getUnwrapSteps()
      if (!steps || !walletAddress || !CTService || !WrapperService) {
        logger.error('Modal unwrap - Missing requirements:', {
          hasSteps: !!steps,
          hasWalletAddress: !!walletAddress,
          hasCTService: !!CTService,
          hasWrapperService: !!WrapperService
        });
        return;
      }

      logger.info('Modal unwrap - Starting unwrap with steps:', {
        stepsCount: steps.length,
        steps: steps.map(step => ({
          type: step.type,
          amount: step.amount.toString(),
          symbol: step.symbol
        }))
      });

      logger.info('Modal unwrap - Initial context:', {
        walletAddress,
        CTServiceAddress: CTService?.address,
        isUsingCPK: isUsingTheCPKAddress(),
        yesPosition: currencyPositions.yes ? {
          id: currencyPositions.yes.id,
          wrappedTokenAddress: currencyPositions.yes.wrappedTokenAddress,
          userBalanceERC1155: currencyPositions.yes.userBalanceERC1155.toString(),
          userBalanceERC20: currencyPositions.yes.userBalanceERC20.toString()
        } : null,
        noPosition: currencyPositions.no ? {
          id: currencyPositions.no.id,
          wrappedTokenAddress: currencyPositions.no.wrappedTokenAddress,
          userBalanceERC1155: currencyPositions.no.userBalanceERC1155.toString(),
          userBalanceERC20: currencyPositions.no.userBalanceERC20.toString()
        } : null
      });

      setTransactionStatus(Remote.loading())

      for (const step of steps) {
        const position = step.type === 'YES' ? currencyPositions.yes : currencyPositions.no
        if (!position?.wrappedTokenAddress) {
          logger.warn('Modal unwrap - Skipping step due to missing position:', {
            stepType: step.type,
            hasPosition: !!position,
            hasWrappedTokenAddress: !!position?.wrappedTokenAddress
          });
          continue;
        }

        logger.info('Modal unwrap - Processing step:', {
          type: step.type,
          amount: step.amount.toString(),
          position: {
            id: position.id,
            wrappedTokenAddress: position.wrappedTokenAddress,
            userBalanceERC1155: position.userBalanceERC1155.toString(),
            userBalanceERC20: position.userBalanceERC20.toString()
          }
        });
        
        const tokenBytes = getTokenBytecode(
          'Wrapped ERC-1155',
          step.type === 'YES' ? 'FUTA_Y' : 'FUTA_N',
          decimals,
          position.wrappedTokenAddress
        );
        
        logger.info('Modal unwrap - Created tokenBytes:', {
          tokenBytes,
          params: {
            tokenName: 'Wrapped ERC-1155',
            tokenSymbol: step.type === 'YES' ? 'FUTA_Y' : 'FUTA_N',
            decimals,
            wrappedTokenAddress: position.wrappedTokenAddress
          }
        });

        logger.info('Modal unwrap - Unwrap parameters:', {
          amount: step.amount.toString(),
          positionId: position.id,
          tokenBytes,
          walletAddress,
          CTServiceAddress: CTService.address
        });

        if (isUsingTheCPKAddress()) {
          logger.info('Modal unwrap - Using CPK for unwrap');
          await CPKService?.unwrap({
            CTService,
            WrapperService,
            addressFrom: CTService.address,
            addressTo: walletAddress,
            positionId: position.id,
            amount: step.amount,
            tokenBytes,
          });
        } else {
          logger.info('Modal unwrap - Using direct unwrap');
          await WrapperService.unwrap(
            CTService.address,
            position.id,
            step.amount,
            walletAddress,
            tokenBytes
          );
        }

        logger.info('Modal unwrap - Step completed successfully');
      }

      await refetchPositions();
      setTransactionStatus(Remote.success(null));
      logger.info('Modal unwrap - All steps completed successfully');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setTransactionStatus(Remote.failure(error));
      logger.error('Modal unwrap - Error:', error);
      logger.error('Modal unwrap - Error context:', {
        steps: getUnwrapSteps()?.map(step => ({
          type: step.type,
          amount: step.amount.toString(),
          symbol: step.symbol
        })),
        positions: {
          yes: currencyPositions.yes ? {
            id: currencyPositions.yes.id,
            wrappedTokenAddress: currencyPositions.yes.wrappedTokenAddress,
            balances: {
              erc1155: currencyPositions.yes.userBalanceERC1155.toString(),
              erc20: currencyPositions.yes.userBalanceERC20.toString()
            }
          } : null,
          no: currencyPositions.no ? {
            id: currencyPositions.no.id,
            wrappedTokenAddress: currencyPositions.no.wrappedTokenAddress,
            balances: {
              erc1155: currencyPositions.no.userBalanceERC1155.toString(),
              erc20: currencyPositions.no.userBalanceERC20.toString()
            }
          } : null
        }
      });
    }
  }, [getUnwrapSteps, walletAddress, CTService, WrapperService, currencyPositions, isUsingTheCPKAddress, CPKService, logger, refetchPositions]);

  const renderMergeResultModal = useCallback(() => {
    if (!mergeResult || !collateralToken) return null

    let amount: BigNumber
    if (mode === 'advanced') {
      amount = advancedAmount
    } else {
      // Quick mode
      amount = isCompanySection ? companyAmount : currencyAmount
    }

    return (
      <MergeResultModal
        amount={amount}
        closeAction={() => setMergeResult('')}
        collateralToken={collateralToken}
        isOpen={!!mergeResult}
        mergeResult={mergeResult}
      />
    )
  }, [mergeResult, collateralToken, mode, advancedAmount, isCompanySection, companyAmount, currencyAmount])

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
                            {' '}+ <span style={{ color: 'blue' }}>{currencyPositions.yes.userBalanceERC20WithDecimals}</span> ({quickMergeConfig.currencyPositions.yes.wrap.tokenSymbol})
                          </span>
                        )}
                        <div style={{ marginTop: '4px', color: 'red' }}>
                          Total Available: {ethers.utils.formatUnits(currencyPositions.yes.userBalanceERC1155.add(currencyPositions.yes.userBalanceERC20), decimals)}
                        </div>
                        {quickMergeConfig && (
                          <div style={{ marginTop: '4px', fontSize: '12px' }}>
                            <span>Wrapped Token Address: </span>
                            <a href={`https://blockscout.com/xdai/mainnet/address/${quickMergeConfig.currencyPositions.yes.wrap.wrappedCollateralTokenAddress}`} target="_blank" rel="noopener noreferrer">
                              <FormatHash hash={truncateStringInTheMiddle(quickMergeConfig.currencyPositions.yes.wrap.wrappedCollateralTokenAddress, 8, 6)} />
                            </a>
                            <ButtonCopy value={quickMergeConfig.currencyPositions.yes.wrap.wrappedCollateralTokenAddress} />
                            <ExternalLink href={`https://blockscout.com/xdai/mainnet/address/${quickMergeConfig.currencyPositions.yes.wrap.wrappedCollateralTokenAddress}`} />
                          </div>
                        )}
                        {currencyPositions.yes && (
                          <QuickWrapUnwrap
                            positionId={currencyPositions.yes.id}
                            balanceERC1155={currencyPositions.yes.userBalanceERC1155}
                            balanceERC20={currencyPositions.yes.userBalanceERC20}
                            decimals={decimals}
                            symbol={collateralToken?.symbol || 'WXDAI'}
                            wrap={quickMergeConfig.currencyPositions.yes.wrap}
                            onUnwrap={onUnwrapYes}
                            onWrap={onWrapYes}
                          />
                        )}
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
                            {' '}+ <span style={{ color: 'blue' }}>{currencyPositions.no.userBalanceERC20WithDecimals}</span> ({quickMergeConfig.currencyPositions.no.wrap.tokenSymbol})
                          </span>
                        )}
                        <div style={{ marginTop: '4px', color: 'red' }}>
                          Total Available: {ethers.utils.formatUnits(currencyPositions.no.userBalanceERC1155.add(currencyPositions.no.userBalanceERC20), decimals)}
                        </div>
                        {quickMergeConfig && (
                          <div style={{ marginTop: '4px', fontSize: '12px' }}>
                            <span>Wrapped Token Address: </span>
                            <a href={`https://blockscout.com/xdai/mainnet/address/${quickMergeConfig.currencyPositions.no.wrap.wrappedCollateralTokenAddress}`} target="_blank" rel="noopener noreferrer">
                              <FormatHash hash={truncateStringInTheMiddle(quickMergeConfig.currencyPositions.no.wrap.wrappedCollateralTokenAddress, 8, 6)} />
                            </a>
                            <ButtonCopy value={quickMergeConfig.currencyPositions.no.wrap.wrappedCollateralTokenAddress} />
                            <ExternalLink href={`https://blockscout.com/xdai/mainnet/address/${quickMergeConfig.currencyPositions.no.wrap.wrappedCollateralTokenAddress}`} />
                          </div>
                        )}
                        {currencyPositions.no && (
                          <QuickWrapUnwrap
                            positionId={currencyPositions.no.id}
                            balanceERC1155={currencyPositions.no.userBalanceERC1155}
                            balanceERC20={currencyPositions.no.userBalanceERC20}
                            decimals={decimals}
                            symbol={collateralToken?.symbol || 'WXDAI'}
                            wrap={quickMergeConfig.currencyPositions.no.wrap}
                            onUnwrap={onUnwrapNo}
                            onWrap={onWrapNo}
                          />
                        )}
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
                      amount={currencyAmount}
                      balance={maxCurrencyBalance}
                      decimals={decimals}
                      isFromAPosition
                      max={maxCurrencyBalance.toString()}
                      onAmountChange={onCurrencyAmountChange}
                      onUseWalletBalance={onCurrencyUseBalance}
                    />
                    {needsCurrencyWrapping && (
                      <WarningMessage status={StatusInfoType.warning}>
                        <div>
                          <div>This merge requires unwrapping tokens first. Required steps:</div>
                          {getCurrencyUnwrapSteps()?.map((step, index) => (
                            <div key={index} style={{ marginLeft: '20px', marginTop: '4px' }}>
                              {index + 1}. Use the <strong>Unwrap</strong> button above in the {step.type} position section to unwrap {ethers.utils.formatUnits(step.amount, decimals)} {step.symbol}
                              </div>
                          ))}
                        </div>
                      </WarningMessage>
                    )}
                  </div>
                </Row>
                {currencyError && (
                  <StatusInfoInline status={StatusInfoType.warning}>
                    {currencyError}
                  </StatusInfoInline>
                )}
                <ButtonContainer>
                  {needsCurrencyWrapping ? (
                    <Button 
                      disabled={true}
                      buttonType={ButtonType.primary}
                    >
                      Merge Currency Positions (Unwrap Required)
                    </Button>
                  ) : (
                    <Button 
                      disabled={disabledCurrency} 
                      onClick={(e) => onMerge('currency')}
                      buttonType={ButtonType.primary}
                    >
                      Merge Currency Positions
                    </Button>
                  )}
                </ButtonContainer>
                {/* Company token section */}
                <h3>Company Token Positions</h3>
                {quickMergeConfig?.companyPositions ? (
                  <>
                    <Row>
                      <div>
                        <strong>YES Position:</strong> {companyPositions.yes ? (
                          <>
                            Balance: <span style={{ color: 'green' }}>{companyPositions.yes.userBalanceERC1155WithDecimals}</span> (ERC1155)
                            {companyPositions.yes.userBalanceERC20.gt(ZERO_BN) && companyPositions.yes.wrappedTokenAddress && (
                              <span>
                                {' '}+ <span style={{ color: 'blue' }}>{companyPositions.yes.userBalanceERC20WithDecimals}</span> ({quickMergeConfig.companyPositions.yes.wrap.tokenSymbol})
                              </span>
                            )}
                            <div style={{ marginTop: '4px', color: 'red' }}>
                              Total Available: {ethers.utils.formatUnits(companyPositions.yes.userBalanceERC1155.add(companyPositions.yes.userBalanceERC20), decimals)}
                            </div>
                            {quickMergeConfig && (
                              <div style={{ marginTop: '4px', fontSize: '12px' }}>
                                <span>Wrapped Token Address: </span>
                                <a href={`https://blockscout.com/xdai/mainnet/address/${quickMergeConfig.companyPositions.yes.wrap.wrappedCollateralTokenAddress}`} target="_blank" rel="noopener noreferrer">
                                  <FormatHash hash={truncateStringInTheMiddle(quickMergeConfig.companyPositions.yes.wrap.wrappedCollateralTokenAddress, 8, 6)} />
                                </a>
                                <ButtonCopy value={quickMergeConfig.companyPositions.yes.wrap.wrappedCollateralTokenAddress} />
                                <ExternalLink href={`https://blockscout.com/xdai/mainnet/address/${quickMergeConfig.companyPositions.yes.wrap.wrappedCollateralTokenAddress}`} />
                              </div>
                            )}
                            {companyPositions.yes && (
                              <QuickWrapUnwrap
                                positionId={companyPositions.yes.id}
                                balanceERC1155={companyPositions.yes.userBalanceERC1155}
                                balanceERC20={companyPositions.yes.userBalanceERC20}
                                decimals={decimals}
                                symbol={collateralToken?.symbol || 'WXDAI'}
                                wrap={quickMergeConfig.companyPositions.yes.wrap}
                                onUnwrap={onUnwrapYes}
                                onWrap={onWrapYes}
                              />
                            )}
                          </>
                        ) : 'No balance'}
                      </div>
                    </Row>
                    <Row>
                      <div>
                        <strong>NO Position:</strong> {companyPositions.no ? (
                          <>
                            Balance: <span style={{ color: 'green' }}>{companyPositions.no.userBalanceERC1155WithDecimals}</span> (ERC1155)
                            {companyPositions.no.userBalanceERC20.gt(ZERO_BN) && companyPositions.no.wrappedTokenAddress && (
                              <span>
                                {' '}+ <span style={{ color: 'blue' }}>{companyPositions.no.userBalanceERC20WithDecimals}</span> ({quickMergeConfig.companyPositions.no.wrap.tokenSymbol})
                              </span>
                            )}
                            <div style={{ marginTop: '4px', color: 'red' }}>
                              Total Available: {ethers.utils.formatUnits(companyPositions.no.userBalanceERC1155.add(companyPositions.no.userBalanceERC20), decimals)}
                            </div>
                            {quickMergeConfig && (
                              <div style={{ marginTop: '4px', fontSize: '12px' }}>
                                <span>Wrapped Token Address: </span>
                                <a href={`https://blockscout.com/xdai/mainnet/address/${quickMergeConfig.companyPositions.no.wrap.wrappedCollateralTokenAddress}`} target="_blank" rel="noopener noreferrer">
                                  <FormatHash hash={truncateStringInTheMiddle(quickMergeConfig.companyPositions.no.wrap.wrappedCollateralTokenAddress, 8, 6)} />
                                </a>
                                <ButtonCopy value={quickMergeConfig.companyPositions.no.wrap.wrappedCollateralTokenAddress} />
                                <ExternalLink href={`https://blockscout.com/xdai/mainnet/address/${quickMergeConfig.companyPositions.no.wrap.wrappedCollateralTokenAddress}`} />
                              </div>
                            )}
                            {companyPositions.no && (
                              <QuickWrapUnwrap
                                positionId={companyPositions.no.id}
                                balanceERC1155={companyPositions.no.userBalanceERC1155}
                                balanceERC20={companyPositions.no.userBalanceERC20}
                                decimals={decimals}
                                symbol={collateralToken?.symbol || 'WXDAI'}
                                wrap={quickMergeConfig.companyPositions.no.wrap}
                                onUnwrap={onUnwrapNo}
                                onWrap={onWrapNo}
                              />
                            )}
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
                          amount={companyAmount}
                          balance={maxCompanyBalance}
                          decimals={decimals}
                          isFromAPosition
                          max={maxCompanyBalance.toString()}
                          onAmountChange={onCompanyAmountChange}
                          onUseWalletBalance={onCompanyUseBalance}
                        />
                        {needsCompanyWrapping && (
                      <WarningMessage status={StatusInfoType.warning}>
                        <div>
                              <div>This merge requires unwrapping tokens first. Required steps:</div>
                              {getCompanyUnwrapSteps()?.map((step, index) => (
                            <div key={index} style={{ marginLeft: '20px', marginTop: '4px' }}>
                              {index + 1}. Use the <strong>Unwrap</strong> button above in the {step.type} position section to unwrap {ethers.utils.formatUnits(step.amount, decimals)} {step.symbol}
                            </div>
                          ))}
                        </div>
                      </WarningMessage>
                        )}
                      </div>
                    </Row>
                    {companyError && (
                      <StatusInfoInline status={StatusInfoType.warning}>
                        {companyError}
                      </StatusInfoInline>
                    )}
                    <ButtonContainer>
                      {needsCompanyWrapping ? (
                      <Button 
                        disabled={true}
                        buttonType={ButtonType.primary}
                      >
                          Merge Company Positions (Unwrap Required)
                      </Button>
                  ) : (
                    <Button 
                          disabled={disabledCompany} 
                          onClick={(e) => onMerge('company')}
                      buttonType={ButtonType.primary}
                    >
                          Merge Company Positions
                    </Button>
                  )}
                </ButtonContainer>
                  </>
                ) : (
                <StatusInfoInline status={StatusInfoType.warning}>
                    No company token positions configured for this network
                </StatusInfoInline>
                )}
                {/* Currency section merge result */}
                {renderMergeResultModal()}
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
                    amount={advancedAmount}
          balance={maxBalance}
          decimals={decimals}
                    isFromAPosition
          max={maxBalance.toString()}
                    onAmountChange={onAdvancedAmountChange}
                    onUseWalletBalance={onAdvancedUseBalance}
        />
                  {advancedNeedsWrapping && (
                    <WarningMessage status={StatusInfoType.warning}>
                      <div>
                        <div>This merge requires unwrapping tokens first. Required steps:</div>
                        {getAdvancedUnwrapSteps()?.map((step, index) => (
                          <div key={index} style={{ marginLeft: '20px', marginTop: '4px' }}>
                            {index + 1}. Use the <strong>Unwrap</strong> button above in the {step.type} section to unwrap {ethers.utils.formatUnits(step.amount, decimals)} {step.symbol}
                          </div>
                        ))}
                      </div>
                    </WarningMessage>
                  )}
                </div>
      </Row>
              {selectedPositions.length > 0 && conditionId && (
                <Row>
        <MergePreview
                    amount={advancedAmount}
          condition={condition}
          positions={selectedPositions}
          token={collateralToken}
        />
      </Row>
      )}
      <ButtonContainer>
                <Button
                  disabled={disabledAdvanced}
                  onClick={(e) => onMerge('advanced')}
                >
                  {advancedNeedsWrapping ? 'Unwrap & Merge Positions' : 'Merge Positions'}
        </Button>
      </ButtonContainer>
            </>
          )}
          {renderMergeResultModal()}
    </CenteredCard>
      )}
    </>
  )
}
