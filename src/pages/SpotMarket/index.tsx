import { BigNumber } from 'ethers/utils'
import { ethers } from 'ethers'
import React, { useCallback, useEffect, useState, useRef } from 'react'
import styled from 'styled-components'
import { Web3ContextStatus, useWeb3ConnectedOrInfura } from 'contexts/Web3Context'
import { useActiveAddress } from 'hooks/useActiveAddress'
import { Remote } from 'util/remoteData'
import { getLogger } from 'util/logger'
import { NetworkIds } from 'util/types'
import { quickMergeConfigs } from 'config/mergeConfig'
import { NULL_PARENT_ID, ZERO_BN } from 'config/constants'
import { quickSplitConfigs } from 'config/splitConfig'
import { spotMarketConfigs } from 'config/spotMarketConfig'
import { useCollateral } from 'hooks/useCollateral'
import { ERC20Service } from 'services/erc20'
import { formatBigNumber } from 'util/tools'
import { Button } from 'components/buttons'
import { ButtonContainer } from 'components/pureStyledComponents/ButtonContainer'
import { useAllowance } from 'hooks/useAllowance'
import { useAllowanceState } from 'hooks/useAllowanceState'
import { SetAllowance } from 'components/common/SetAllowance'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getTokenBytecode } = require('1155-to-20-helper/src')

const logger = getLogger('SpotMarket')

const DEBUG_MODE = true // You can toggle this to false to hide debug info

const Container = styled.div`
  padding: 20px;
`

const SpotMarketCard = styled.div`
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
`

const Title = styled.h2`
  font-size: 24px;
  margin-bottom: 24px;
`

const BuySellTabs = styled.div`
  display: flex;
  border-bottom: 1px solid #eee;
  margin-bottom: 24px;
`

const Tab = styled.button<{ active: boolean; isSell?: boolean }>`
  padding: 12px 24px;
  border: none;
  background: none;
  color: ${props => props.active ? (props.isSell ? '#ef4444' : '#22c55e') : '#666'};
  border-bottom: 2px solid ${props => props.active ? (props.isSell ? '#ef4444' : '#22c55e') : 'transparent'};
  cursor: pointer;
`

const OutcomeSection = styled.div`
  margin-bottom: 24px;
`

const OutcomeLabel = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
  color: #666;
`

const OutcomeButtons = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
`

const OutcomeButton = styled.button<{ active: boolean; isFail?: boolean }>`
  padding: 16px;
  border-radius: 8px;
  border: 1px solid ${props => props.active ? (props.isFail ? '#ef4444' : '#22c55e') : '#ddd'};
  background: ${props => props.active ? (props.isFail ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)') : 'white'};
  color: ${props => props.active ? (props.isFail ? '#ef4444' : '#22c55e') : '#666'};
  cursor: pointer;
`

const AmountInput = styled.div`
  display: flex;
  align-items: center;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 4px;
  margin-bottom: 24px;
`

const Input = styled.input`
  flex: 1;
  border: none;
  text-align: center;
  font-size: 16px;
  padding: 8px;
  
  &:focus {
    outline: none;
  }
`

const SpotMarketButton = styled.button<{ disabled?: boolean }>`
  width: 100%;
  padding: 16px;
  border: none;
  border-radius: 8px;
  background: ${props => props.disabled ? '#ddd' : '#22c55e'};
  color: white;
  font-weight: 500;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  
  &:hover:not(:disabled) {
    background: #16a34a;
  }
`

const SwapFrame = styled.iframe`
  border: none;
  width: 100%;
  height: 640px;
  border-radius: 8px;
  margin-top: 20px;
`

const DebugInfo = styled.div`
  margin: 8px 0;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
`

interface Balances {
  usdc: number
  usdcYes: number
  usdcNo: number
  wUsdcYes: number
  wUsdcNo: number
  faoYes: number
  faoNo: number
}

interface ConfirmationModalProps {
  side: 'buy' | 'sell'
  outcome: 'approval' | 'refusal'
  amount: string
  onConfirm: () => void
  onClose: () => void
  balances: Balances
  setBalances: React.Dispatch<React.SetStateAction<Balances>>
  networkId: NetworkIds
  initialPositionIds?: { yes: string; no: string }
}

const ConfirmationModal = ({ 
  side, 
  outcome, 
  amount, 
  onConfirm, 
  onClose, 
  balances, 
  setBalances, 
  networkId,
  initialPositionIds
}: ConfirmationModalProps) => {
  // Start with wrap step if we have initial position IDs (meaning split already happened)
  const [step, setStep] = useState<'split' | 'wrap'>(initialPositionIds ? 'wrap' : 'split')
  const [transactionStatus, setTransactionStatus] = useState<Remote<any>>(Remote.notAsked())
  const { CTService } = useWeb3ConnectedOrInfura()
  const activeAddress = useActiveAddress()
  const config = quickMergeConfigs[networkId]?.[0]
  const wrapConfig = outcome === 'approval' 
    ? config?.currencyPositions.yes.wrap
    : config?.currencyPositions.no.wrap

  const handleWrap = async () => {
    if (!CTService || !config || !activeAddress || !initialPositionIds) {
      throw new Error('Required services or config not available')
    }

    const positionId = outcome === 'approval' ? initialPositionIds.yes : initialPositionIds.no
    if (!positionId) {
      throw new Error('Position ID not available')
    }

    logger.info('Starting wrap with config:', {
      outcome,
      initialPositionIds,
      selectedPositionId: positionId,
      expectedYesId: config.currencyPositions.yes.positionId,
      expectedNoId: config.currencyPositions.no.positionId,
      wrappedAddress: wrapConfig?.wrappedCollateralTokenAddress,
      wrapConfig: {
        tokenName: wrapConfig?.tokenName,
        tokenSymbol: wrapConfig?.tokenSymbol,
        decimals: 18,
        wrappedTokenAddress: wrapConfig?.wrappedCollateralTokenAddress
      }
    })

    setTransactionStatus(Remote.loading())
    try {
      // Convert amount to BigNumber with 18 decimals (same as ERC20)
      const amountBN = ethers.utils.parseUnits(amount, 18)

      const tokenBytes = getTokenBytecode(
        wrapConfig?.tokenName || '',
        wrapConfig?.tokenSymbol || '',
        18,
        wrapConfig?.wrappedCollateralTokenAddress || ''
      )

      logger.info('Executing wrap with parameters:', {
        from: activeAddress,
        to: wrapConfig?.wrappedCollateralTokenAddress,
        positionId: positionId.toString(),
        amount: amountBN.toString(),
        tokenBytes: tokenBytes,
        tokenName: wrapConfig?.tokenName,
        tokenSymbol: wrapConfig?.tokenSymbol
      })

      await CTService.safeTransferFrom(
        activeAddress,
        wrapConfig?.wrappedCollateralTokenAddress || '',
        positionId.toString(),
        amountBN,
        tokenBytes
      )

      logger.info('Wrap completed successfully')
      onConfirm()
    } catch (err) {
      logger.error('Wrap failed:', err)
      setTransactionStatus(Remote.failure(new Error(typeof err === 'string' ? err : 'Transaction failed')))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Confirm Transaction</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {/* Transaction Details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-medium mb-2">
            Wrap {outcome === 'approval' ? 'YES' : 'NO'}
          </h4>
          <div className="flex justify-between items-center">
            <span>{amount} {outcome === 'approval' ? 'YES' : 'NO'}</span>
            <span>→</span>
            <span>{amount} {wrapConfig?.tokenSymbol}</span>
          </div>
          {config && (
            <div className="mt-2 text-xs text-gray-500">
              Using wrapped token address: {wrapConfig?.wrappedCollateralTokenAddress}
            </div>
          )}
        </div>

        <div className="mb-4">Wrap {amount} {outcome === 'approval' ? 'YES' : 'NO'} position into {wrapConfig?.tokenSymbol}</div>
        <button 
          onClick={handleWrap}
          className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Confirm Wrap
        </button>
      </div>
    </div>
  )
}

export const SpotMarket: React.FC = () => {
  const { CTService, WrapperService, networkConfig, provider, signer, _type: status } = useWeb3ConnectedOrInfura()
  const walletAddress = useActiveAddress()
  const [transactionStatus, setTransactionStatus] = useState<Remote<{ positionIds: { yes: string, no: string } }>>(Remote.notAsked())
  const [outcome, setOutcome] = useState<'approval' | 'refusal'>('approval')
  const [amount, setAmount] = useState<string>('')
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [walletBalance, setWalletBalance] = useState<BigNumber>(ZERO_BN)
  const [showSwap, setShowSwap] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Get the split config for the current network
  const config = quickSplitConfigs[networkConfig?.networkId as NetworkIds]?.[0]
  const spotConfig = spotMarketConfigs[networkConfig?.networkId as NetworkIds]?.[0]
  
  // Use FAOT token address for sell mode, WXDAI for buy mode
  const tokenAddress = (side === 'sell' ? spotConfig?.companyToken.address : config?.tokenAddress) || ''
  const { collateral } = useCollateral(tokenAddress)

  // Add allowance handling
  const allowanceMethods = useAllowance(tokenAddress)
  const {
    allowanceError,
    allowanceFinished,
    cleanAllowanceError,
    fetchingAllowance,
    shouldDisplayAllowance,
    unlockCollateral,
  } = useAllowanceState(allowanceMethods, amount ? ethers.utils.parseUnits(amount, collateral?.decimals || 18) : ZERO_BN)

  // Fetch wallet balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (status === Web3ContextStatus.Connected && tokenAddress && walletAddress && signer) {
        const erc20Service = new ERC20Service(provider, tokenAddress, signer)
        const balance = await erc20Service.balanceOf(walletAddress)
        logger.info('Wallet balance updated:', {
          balance: balance.toString(),
          formatted: collateral ? formatBigNumber(balance, collateral.decimals) : 'no collateral',
          token: side === 'sell' ? 'FAOT' : 'WXDAI'
        })
        setWalletBalance(balance)
      }
    }
    fetchBalance()
  }, [status, tokenAddress, walletAddress, signer, provider, collateral, side])

  const handleSplit = async () => {
    try {
      logger.info('Starting split process with inputs:', {
        outcome,
        amount,
        side,
        walletAddress,
        hasServices: {
          CTService: !!CTService,
          config: !!config,
          collateral: !!collateral
        }
      })

      if (!CTService || !config || !walletAddress || !collateral) {
        const error = {
          CTService: !CTService ? 'Missing CTService' : null,
          config: !config ? 'Missing config' : null,
          walletAddress: !walletAddress ? 'Missing wallet address' : null,
          collateral: !collateral ? 'Missing collateral' : null
        }
        logger.error('Required services or config not available:', error)
        throw new Error('Required services or config not available')
      }

      if (!allowanceFinished && shouldDisplayAllowance) {
        logger.error('Token approval required')
        throw new Error('Token approval required')
      }

      // Create partition based on outcomes (YES/NO)
      const partition = [new BigNumber(1), new BigNumber(2)] // Binary partition for YES/NO
      
      // Convert amount to proper decimals
      const amountBN = ethers.utils.parseUnits(amount, collateral.decimals)

      logger.info('Split configuration:', {
        amount: {
          raw: amount,
          decimals: collateral.decimals,
          bigNumber: amountBN.toString()
        },
        partition: partition.map(p => p.toString()),
        config: {
          tokenAddress: tokenAddress, // Use the dynamic token address
          conditionId: config.conditionId,
          collateralSymbol: collateral.symbol,
          side
        }
      })

      // Execute split transaction
      logger.info('Executing split transaction...')
      await CTService.splitPosition(
        tokenAddress, // Use the dynamic token address
        NULL_PARENT_ID,
        config.conditionId,
        partition,
        amountBN
      )
      logger.info('Split transaction completed')

      // Get positions after split
      logger.info('Fetching positions from partition...')
      const positions = await CTService.getPositionsFromPartition(
        partition,
        NULL_PARENT_ID,
        config.conditionId,
        tokenAddress, // Use the dynamic token address
        walletAddress
      )

      // Get the quick merge config for wrapping
      const quickMergeConfig = quickMergeConfigs[networkConfig?.networkId as NetworkIds]?.[0]
      if (!quickMergeConfig) {
        logger.error('Quick merge config not available for network:', networkConfig?.networkId)
        throw new Error('Quick merge config not available')
      }

      logger.info('Retrieved positions:', {
        positions,
        position0: positions[0],
        position0Type: typeof positions[0],
        position0ToString: positions[0].positionId,
        position1: positions[1],
        position1Type: typeof positions[1],
        position1ToString: positions[1].positionId
      })

      if (!Array.isArray(positions) || positions.length < 2) {
        logger.error('Invalid positions returned:', {
          positions,
          isArray: Array.isArray(positions),
          length: positions?.length
        })
        throw new Error('Invalid positions returned from split')
      }

      // NO is position[1], YES is position[0] - matching merge config
      const positionIds = {
        yes: positions[0].positionId,
        no: positions[1].positionId
      }

      // Get the wrap config based on outcome AND side
      const wrapConfig = side === 'sell' 
        ? (outcome === 'approval' 
            ? quickMergeConfig.companyPositions?.yes.wrap
            : quickMergeConfig.companyPositions?.no.wrap)
        : (outcome === 'approval'
            ? quickMergeConfig.currencyPositions.yes.wrap
            : quickMergeConfig.currencyPositions.no.wrap)

      if (!wrapConfig) {
        throw new Error('Wrap config not available')
      }

      logger.info('Position IDs after split:', {
        yes: positionIds.yes,
        no: positionIds.no,
        side,
        outcome,
        wrapConfig
      })

      logger.info('Split completed successfully')
      setTransactionStatus(Remote.success({ positionIds }))
      setShowConfirmation(true)
    } catch (error) {
      const err = error as any // Type assertion here instead
      logger.error('Split process failed:', {
        error: err,
        message: err instanceof Error ? err.message : JSON.stringify(err),
        data: err?.data,
        code: err?.code,
        stack: err instanceof Error ? err.stack : undefined
      })
      const errorMessage = err instanceof Error ? err.message : 
        (err?.data?.message || err?.message || JSON.stringify(err))
      setTransactionStatus(Remote.failure(new Error(errorMessage)))
    }
  }

  const handleConfirmationComplete = () => {
    setShowConfirmation(false)
    setAmount('')
    setTransactionStatus(Remote.notAsked())
  }

  const handleMaxAmount = () => {
    if (collateral && walletBalance.gt(ZERO_BN)) {
      setAmount(formatBigNumber(walletBalance, collateral.decimals))
    }
  }

  const isDisabled = React.useMemo(() => {
    if (!amount || Number(amount) <= 0) return true
    if (!collateral) return false
    if (!allowanceFinished && shouldDisplayAllowance) return true
    // Convert amount to same format as walletBalance (with proper decimals)
    const amountBN = ethers.utils.parseUnits(amount, collateral.decimals)
    return amountBN.gt(walletBalance)
  }, [amount, collateral, walletBalance, allowanceFinished, shouldDisplayAllowance])

  const handleWrap = async () => {
    try {
      const data = transactionStatus.get()
      const config = quickMergeConfigs[networkConfig?.networkId as NetworkIds]?.[0]
      if (!data || !config || !collateral || !WrapperService || !walletAddress) return

      // Use position IDs from split result
      const positionId = outcome === 'approval' ? data.positionIds.yes : data.positionIds.no
      
      logger.info('Wrap config selection:', {
        side,
        outcome,
        positionId,
        splitPositions: data.positionIds,
        companyPositions: {
          yes: config.companyPositions?.yes.positionId,
          no: config.companyPositions?.no.positionId
        }
      })

      // Get wrap config based on side and outcome
      const wrapConfig = side === 'sell' 
        ? (outcome === 'approval'
            ? config.companyPositions?.yes.wrap  // SELL + Pass -> Company YES
            : config.companyPositions?.no.wrap)  // SELL + Fail -> Company NO
        : (outcome === 'approval'
            ? config.currencyPositions.yes.wrap  // BUY + Pass -> Currency YES
            : config.currencyPositions.no.wrap)  // BUY + Fail -> Currency NO

      if (!wrapConfig) {
        throw new Error('Wrap config not available')
      }

      logger.info('Selected wrap config:', {
        side: side === 'sell' ? 'SELL (FAOT)' : 'BUY (WXDAI)',
        outcome: outcome === 'approval' ? 'PASS (YES)' : 'FAIL (NO)',
        positionId,
        selectedConfig: wrapConfig
      })

      const amountBN = ethers.utils.parseUnits(amount, collateral.decimals)
      const tokenBytes = getTokenBytecode(
        wrapConfig.tokenName,
        wrapConfig.tokenSymbol,
        collateral.decimals,
        wrapConfig.wrappedCollateralTokenAddress
      )

      const wrapValues = {
        amount: amountBN,
        address: WrapperService.address,
        positionId,
        tokenBytes,
      }

      logger.info('Executing wrap with values:', {
        from: walletAddress,
        to: wrapValues.address,
        positionId: positionId,
        amount: formatBigNumber(amountBN, collateral.decimals),
        tokenName: wrapConfig.tokenName,
        tokenSymbol: wrapConfig.tokenSymbol,
        wrappedAddress: wrapConfig.wrappedCollateralTokenAddress
      })

      await CTService?.safeTransferFrom(
        walletAddress,
        wrapValues.address,
        wrapValues.positionId,
        wrapValues.amount,
        wrapValues.tokenBytes
      )

      // After successful wrap, show the swap iframe
      setShowSwap(true)
    } catch (error) {
      logger.error('Wrap failed:', {
        error: error instanceof Error ? error.message : String(error),
        errorObject: error
      })
    }
  }

  return (
    <Container>
      <SpotMarketCard>
        <Title>Spot Market</Title>
        
        {DEBUG_MODE && (
          <DebugInfo>
            Token Approval Status: {allowanceFinished ? '✅ Approved' : '❌ Not Approved'}
            {shouldDisplayAllowance && ' (Approval Required)'}
          </DebugInfo>
        )}
        
        <BuySellTabs>
          <Tab active={side === 'buy'} onClick={() => setSide('buy')}>Buy</Tab>
          <Tab active={side === 'sell'} isSell onClick={() => setSide('sell')}>Sell</Tab>
        </BuySellTabs>

        <OutcomeSection>
          <OutcomeLabel>
            <span>Outcome</span>
            <span>Slippage: 0.3%</span>
          </OutcomeLabel>
          <OutcomeButtons>
            <OutcomeButton 
              active={outcome === 'approval'} 
              onClick={() => setOutcome('approval')}
            >
              Pass
            </OutcomeButton>
            <OutcomeButton 
              active={outcome === 'refusal'} 
              isFail
              onClick={() => setOutcome('refusal')}
            >
              Fail
            </OutcomeButton>
          </OutcomeButtons>
        </OutcomeSection>

        <AmountInput>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
          <button 
            onClick={handleMaxAmount}
            className="px-2 text-sm text-green-500 hover:text-green-600"
            disabled={!walletBalance.gt(ZERO_BN)}
          >
            MAX
          </button>
        </AmountInput>

        {collateral && (
          <div className="text-sm text-gray-500 mb-4">
            Balance: {formatBigNumber(walletBalance, collateral.decimals)} {collateral.symbol}
          </div>
        )}

        {shouldDisplayAllowance && collateral && (
          <SetAllowance
            collateral={collateral}
            error={allowanceError}
            fetching={fetchingAllowance}
            finished={allowanceFinished}
            onUnlock={unlockCollateral}
          />
        )}

        {transactionStatus.isFailure() && (
          <div style={{ color: 'red', margin: '12px 0' }}>
            {(() => {
              const error = transactionStatus.getFailure()
              return typeof error === 'string' ? error : 'Transaction failed'
            })()}
          </div>
        )}

        <SpotMarketButton
          disabled={isDisabled}
          onClick={handleSplit}
        >
          Split Position
        </SpotMarketButton>

        {showConfirmation && transactionStatus.isSuccess() && !showSwap && (
          <ButtonContainer>
            <Button onClick={handleWrap}>
              Wrap
            </Button>
          </ButtonContainer>
        )}

        {showSwap && (
          <SwapFrame
            ref={iframeRef}
            src="http://18.229.197.237:3002/iframe/swap?inputCurrency=0x38eeff6a964ac441b900deb6bf25c85be85a32a0&outputCurrency=ETH&exactAmount=0.01"
            title="Sushiswap Widget"
            allow="clipboard-write; clipboard-read"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        )}
      </SpotMarketCard>
    </Container>
  )
} 