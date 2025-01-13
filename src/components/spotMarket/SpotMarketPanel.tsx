import React, { useState, useMemo, useCallback } from 'react'
import styled from 'styled-components'
import { BigNumber } from 'ethers/utils'
import { Modal } from 'components/common/Modal'
import { StatusInfoInline, StatusInfoType } from 'components/statusInfo/StatusInfoInline'
import { spotMarketConfigs } from 'config/spotMarketConfig'
import { useWeb3ConnectedOrInfura } from 'contexts/Web3Context'
import { useActiveAddress } from 'hooks/useActiveAddress'
import { usePositionsList } from 'hooks/usePositionsList'
import { ZERO_BN } from 'config/constants'
import { Remote } from 'util/remoteData'
import { getLogger } from 'util/logger'
import { ethers } from 'ethers'
import { PositionSearchOptions, WrappedCollateralOptions } from 'util/types'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getTokenBytecode } = require('1155-to-20-helper/src')

const logger = getLogger('SpotMarketPanel')

const Panel = styled.div`
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
`

const BuySellContainer = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
`

const BuySellButton = styled.button<{ active: boolean }>`
  padding: 4px 12px;
  background: ${props => props.active ? '#fff' : 'transparent'};
  border: 1px solid #ccc;
  cursor: pointer;
  
  &:hover {
    background: ${props => !props.active && '#f5f5f5'};
  }
`

const OutcomeContainer = styled.div`
  margin-bottom: 12px;
`

const OutcomeLabel = styled.div`
  font-size: 14px;
  margin-bottom: 4px;
`

const OutcomeButtons = styled.div`
  display: flex;
  gap: 4px;
`

const OutcomeButton = styled.button<{ active: boolean }>`
  flex: 1;
  padding: 8px;
  background: ${props => props.active ? '#fff' : '#f5f5f5'};
  border: 1px solid #ccc;
  cursor: pointer;
  
  &:hover {
    background: ${props => !props.active && '#eee'};
  }
`

const AmountContainer = styled.div`
  margin-bottom: 12px;
`

const AmountLabel = styled.div`
  font-size: 14px;
  margin-bottom: 4px;
`

const AmountInputContainer = styled.div`
  display: flex;
  align-items: center;
  border: 1px solid #ccc;
  border-radius: 4px;
`

const AmountButton = styled.button`
  padding: 8px 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  
  &:hover {
    background: #f5f5f5;
  }
`

const AmountInput = styled.input`
  flex: 1;
  padding: 8px;
  border: none;
  text-align: center;
  
  &:focus {
    outline: none;
  }
`

const BalanceContainer = styled.div`
  margin-bottom: 12px;
`

const BalanceLabel = styled.div`
  font-size: 14px;
  margin-bottom: 4px;
`

const BalanceRow = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
`

const ActionButton = styled.button<{ isBuy: boolean }>`
  width: 100%;
  padding: 12px;
  background: ${props => props.isBuy ? '#4CAF50' : '#f44336'};
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  &:hover:not(:disabled) {
    opacity: 0.9;
  }
`

const StepModal = styled(Modal)`
  width: 100%;
  max-width: 500px;
  padding: 24px;
`

const StepIndicator = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  gap: 8px;
`

const StepDot = styled.div<{ active: boolean }>`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${props => props.active ? props.theme.colors.primary : props.theme.colors.border};
  color: ${props => props.active ? 'white' : props.theme.colors.textColor};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
`

const StepLine = styled.div`
  height: 2px;
  width: 40px;
  background: ${props => props.theme.colors.border};
`

const StepActions = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
`

const StepButton = styled.button<{ primary?: boolean }>`
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid ${props => props.primary ? props.theme.colors.primary : props.theme.colors.border};
  background: ${props => props.primary ? props.theme.colors.primary : 'transparent'};
  color: ${props => props.primary ? 'white' : props.theme.colors.textColor};
  cursor: pointer;
  
  &:hover {
    opacity: 0.8;
  }
`

const StepContent = styled.div`
  margin: 20px 0;
`

const StepTitle = styled.h3`
  font-size: 18px;
  margin-bottom: 16px;
  text-align: center;
`

export const SpotMarketPanel: React.FC = () => {
  const {
    _type: status,
    CTService,
    WrapperService,
    address: walletAddress,
    networkConfig,
  } = useWeb3ConnectedOrInfura()

  const activeAddress = useActiveAddress()

  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [outcome, setOutcome] = useState<'approval' | 'refusal'>('approval')
  const [amount, setAmount] = useState<string>('0.00')
  const [showStepModal, setShowStepModal] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [transfer, setTransfer] = useState<Remote<any>>(Remote.notAsked())

  // Get config for current network
  const spotConfig = useMemo(() => {
    if (!networkConfig) return null
    return spotMarketConfigs[networkConfig.networkId]?.[0] || null
  }, [networkConfig])

  // Get positions from the hook
  const { data: positions, refetchPositions } = usePositionsList({
    CollateralValue: { type: null, value: [] },
    FromCreationDate: null,
    ToCreationDate: null,
    TextToSearch: { type: PositionSearchOptions.All, value: '' },
    WrappedCollateral: WrappedCollateralOptions.All
  })

  // Find positions for currency token
  const currencyPositions = useMemo(() => {
    if (!positions || !spotConfig) return { yes: null, no: null }
    
    const yesPosition = positions.find(p => p.id === spotConfig.currencyPositions.yes)
    const noPosition = positions.find(p => p.id === spotConfig.currencyPositions.no)
    
    return { yes: yesPosition || null, no: noPosition || null }
  }, [positions, spotConfig])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value)
    }
  }

  const handleIncreaseAmount = () => {
    const currentAmount = parseFloat(amount) || 0
    setAmount((currentAmount + 1).toFixed(2))
  }

  const handleDecreaseAmount = () => {
    const currentAmount = parseFloat(amount) || 0
    if (currentAmount > 0) {
      setAmount((currentAmount - 1).toFixed(2))
    }
  }

  const handleAction = () => {
    setShowStepModal(true)
    setCurrentStep(1)
  }

  const handleStepNext = async () => {
    if (!spotConfig || !walletAddress || !CTService || !WrapperService) return

    try {
      switch (currentStep) {
        case 1: // Split
          setTransfer(Remote.loading())
          const amountBN = new BigNumber(parseFloat(amount) * 10 ** 18)
          await CTService.splitPosition(
            spotConfig.tokenAddress,
            ethers.constants.HashZero,
            spotConfig.conditionId,
            [new BigNumber(1), new BigNumber(2)],
            amountBN
          )
          setTransfer(Remote.success(null))
          await refetchPositions()
          setCurrentStep(2)
          break

        case 2: // Wrap
          setTransfer(Remote.loading())
          const position = outcome === 'approval' ? currencyPositions.yes : currencyPositions.no
          const tokenName = outcome === 'approval' ? 'FUTA_Y' : 'FUTA_N'
          if (position) {
            const tokenBytes = getTokenBytecode(tokenName, tokenName, 18)
            await CTService.safeTransferFrom(
              walletAddress,
              WrapperService.address,
              position.id,
              new BigNumber(amount),
              tokenBytes
            )
          }
          setTransfer(Remote.success(null))
          await refetchPositions()
          setCurrentStep(3)
          break

        case 3: // Trade
          setShowStepModal(false)
          setCurrentStep(1)
          break
      }
    } catch (err) {
      setTransfer(Remote.failure(err instanceof Error ? err : new Error(String(err))))
      logger.error(err)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="text-center">
            <h3 className="text-lg font-medium mb-4">Split WXDAI</h3>
            <p>
              {amount} WXDAI → {amount} WXDAI_{outcome === 'approval' ? 'YES' : 'NO'}
            </p>
          </div>
        )
      case 2:
        return (
          <div className="text-center">
            <h3 className="text-lg font-medium mb-4">Wrap Position</h3>
            <p>
              {amount} WXDAI_{outcome === 'approval' ? 'YES' : 'NO'} → {amount} {outcome === 'approval' ? 'FUTA_Y' : 'FUTA_N'}
            </p>
          </div>
        )
      case 3:
        return (
          <div className="text-center">
            <h3 className="text-lg font-medium mb-4">Trade</h3>
            <p>Opening trading interface...</p>
          </div>
        )
      default:
        return null
    }
  }

  if (!spotConfig) {
    return (
      <Panel>
        <StatusInfoInline status={StatusInfoType.warning}>
          No spot market configuration available for this network
        </StatusInfoInline>
      </Panel>
    )
  }

  return (
    <Panel>
      <BuySellContainer>
        <BuySellButton active={side === 'buy'} onClick={() => setSide('buy')}>Buy</BuySellButton>
        <BuySellButton active={side === 'sell'} onClick={() => setSide('sell')}>Sell</BuySellButton>
      </BuySellContainer>

      <OutcomeContainer>
        <OutcomeLabel>Outcome</OutcomeLabel>
        <OutcomeButtons>
          <OutcomeButton active={outcome === 'approval'} onClick={() => setOutcome('approval')}>
            Pass
            <div>75.0%</div>
          </OutcomeButton>
          <OutcomeButton active={outcome === 'refusal'} onClick={() => setOutcome('refusal')}>
            Fail
            <div>25.0%</div>
          </OutcomeButton>
        </OutcomeButtons>
      </OutcomeContainer>

      <AmountContainer>
        <AmountLabel>Amount</AmountLabel>
        <AmountInputContainer>
          <AmountButton onClick={handleDecreaseAmount}>-</AmountButton>
          <AmountInput 
            type="text" 
            value={amount} 
            onChange={handleAmountChange}
          />
          <AmountButton onClick={handleIncreaseAmount}>+</AmountButton>
        </AmountInputContainer>
      </AmountContainer>

      <BalanceContainer>
        <BalanceLabel>Available WXDAI</BalanceLabel>
        <BalanceRow>
          <div>WXDAI:</div>
          <div>{currencyPositions.yes?.userBalanceERC1155.toString() || '0.00'}</div>
        </BalanceRow>
        <BalanceRow>
          <div>Regular WXDAI:</div>
          <div>{currencyPositions.yes?.userBalanceERC1155.toString() || '0.00'}</div>
        </BalanceRow>
        <BalanceRow>
          <div>WXDAI_{outcome === 'approval' ? 'YES' : 'NO'}:</div>
          <div>
            {(outcome === 'approval' 
              ? currencyPositions.yes?.userBalanceERC1155.toString() 
              : currencyPositions.no?.userBalanceERC1155.toString()) || '0.00'}
          </div>
        </BalanceRow>
      </BalanceContainer>

      <ActionButton 
        isBuy={side === 'buy'}
        onClick={handleAction}
        disabled={!parseFloat(amount)}
      >
        {side === 'buy' ? 'Buy' : 'Sell'} FAO_{outcome === 'approval' ? 'YES' : 'NO'}
      </ActionButton>

      {/* Step Modal */}
      <Modal 
        isOpen={showStepModal}
        onRequestClose={() => setShowStepModal(false)}
        title="Confirm Transaction"
        style={{ content: { width: '500px', padding: '24px' } }}
      >
        <div className="flex items-center justify-center mb-6 gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
            currentStep === 1 ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}>1</div>
          <div className="h-0.5 w-10 bg-gray-200" />
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
            currentStep === 2 ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}>2</div>
          <div className="h-0.5 w-10 bg-gray-200" />
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
            currentStep === 3 ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}>3</div>
        </div>
        
        {renderStepContent()}
        
        {transfer.isLoading() && (
          <div className="text-center mt-4">
            <StatusInfoInline status={StatusInfoType.working}>
              Processing transaction...
            </StatusInfoInline>
          </div>
        )}
        
        {transfer.isFailure() && (
          <div className="text-center mt-4">
            <StatusInfoInline status={StatusInfoType.error}>
              {transfer.getFailure()?.toString() || 'Transaction failed'}
            </StatusInfoInline>
          </div>
        )}
        
        <div className="flex justify-between gap-3 mt-5">
          <button 
            className="flex-1 py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50"
            onClick={() => setShowStepModal(false)}
          >
            Cancel
          </button>
          <button 
            className="flex-1 py-3 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            onClick={handleStepNext}
            disabled={transfer.isLoading()}
          >
            {currentStep === 3 ? 'Finish' : 'Next Step'}
          </button>
        </div>
      </Modal>
    </Panel>
  )
} 