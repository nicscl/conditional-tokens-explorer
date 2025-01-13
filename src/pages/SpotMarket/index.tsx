import React, { useState, useCallback, useMemo } from 'react'
import styled from 'styled-components'
import { BigNumber } from 'ethers/utils'
import { utils } from 'ethers'
import { useWeb3ConnectedOrInfura, Web3ContextStatus } from 'contexts/Web3Context'
import { useActiveAddress } from 'hooks/useActiveAddress'
import { NULL_PARENT_ID, ZERO_BN } from 'config/constants'
import { Remote } from 'util/remoteData'
import { getLogger } from 'util/logger'
import { quickSplitConfigs } from 'config/splitConfig'
import { NetworkIds } from 'util/types'
import { useCollateral } from 'hooks/useCollateral'
import { useAllowance } from 'hooks/useAllowance'
import { useAllowanceState } from 'hooks/useAllowanceState'
import { SetAllowance } from 'components/common/SetAllowance'
import { ERC20Service } from 'services/erc20'
import { formatBigNumber } from 'util/tools'
import { toChecksumAddress } from 'web3-utils'
import { InputAmount } from 'components/form/InputAmount'

const logger = getLogger('SpotMarket')

const Container = styled.div`
  padding: 20px;
`

const Card = styled.div`
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

const Tab = styled.button<{ active: boolean }>`
  padding: 12px 24px;
  border: none;
  background: none;
  color: ${props => props.active ? '#22c55e' : '#666'};
  border-bottom: 2px solid ${props => props.active ? '#22c55e' : 'transparent'};
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

const OutcomeButton = styled.button<{ active: boolean }>`
  padding: 16px;
  border-radius: 8px;
  border: 1px solid ${props => props.active ? '#22c55e' : '#ddd'};
  background: ${props => props.active ? 'rgba(34, 197, 94, 0.1)' : 'white'};
  color: ${props => props.active ? '#22c55e' : '#666'};
  cursor: pointer;
`

const AmountSection = styled.div`
  margin-bottom: 24px;
`

const AmountInput = styled.div`
  display: flex;
  align-items: center;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 4px;
`

const AmountButton = styled.button`
  padding: 8px 12px;
  border: none;
  background: none;
  color: #666;
  cursor: pointer;
  
  &:hover {
    color: #333;
  }
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

const SplitButton = styled.button`
  width: 100%;
  padding: 16px;
  border: none;
  border-radius: 8px;
  background: #22c55e;
  color: white;
  font-weight: 500;
  cursor: pointer;
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  &:hover:not(:disabled) {
    background: #16a34a;
  }
`

const Modal = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
`

const ModalContent = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  width: 100%;
  max-width: 400px;
  margin: 24px;
`

const ModalTitle = styled.h3`
  font-size: 20px;
  margin-bottom: 24px;
  text-align: center;
`

const ModalButtons = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 24px;
`

const ModalButton = styled.button<{ primary?: boolean }>`
  padding: 12px;
  border-radius: 8px;
  border: 1px solid ${props => props.primary ? '#22c55e' : '#ddd'};
  background: ${props => props.primary ? '#22c55e' : 'white'};
  color: ${props => props.primary ? 'white' : '#666'};
  cursor: pointer;
  
  &:hover {
    opacity: 0.9;
  }
`

const WalletBalance = styled.button`
  background: none;
  border: none;
  color: #22c55e;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  
  &:hover {
    background: rgba(34, 197, 94, 0.1);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const ButtonContainer = styled.div`
  margin-top: 24px;
  display: flex;
  justify-content: center;
`

const Button = styled.button<{ disabled?: boolean }>`
  padding: 12px 24px;
  border-radius: 8px;
  border: none;
  background: ${props => props.disabled ? '#ddd' : '#22c55e'};
  color: white;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  font-size: 16px;
  font-weight: 500;
  
  &:hover {
    background: ${props => props.disabled ? '#ddd' : '#1ea550'};
  }
`

interface SplitStatus {
  positionIds: Array<{
    positionId: string
    balance: BigNumber
  }>
  collateral: string
}

export const SpotMarket = () => {
  const {
    _type: status,
    CPKService,
    CTService,
    address: walletAddress,
    connect,
    isUsingTheCPKAddress,
    networkConfig,
    provider,
    signer,
  } = useWeb3ConnectedOrInfura()

  const activeAddress = useActiveAddress()
  
  // Get the first quick split config for the current network
  const config = (quickSplitConfigs[networkConfig.networkId as NetworkIds] || [])[0]
  const { collateral } = useCollateral(config?.tokenAddress)
  
  const [side, setSide] = useState('buy')
  const [outcome, setOutcome] = useState('pass')
  const [amount, setAmount] = useState<BigNumber>(ZERO_BN)
  const [showSplitModal, setShowSplitModal] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<Remote<SplitStatus>>(
    Remote.notAsked<SplitStatus>()
  )
  const [walletBalance, setWalletBalance] = useState<BigNumber>(ZERO_BN)

  // Setup allowance
  const allowanceMethods = useAllowance(config?.tokenAddress)
  const {
    allowanceError,
    allowanceFinished,
    cleanAllowanceError,
    fetchingAllowance,
    shouldDisplayAllowance,
    unlockCollateral,
  } = useAllowanceState(allowanceMethods, amount)

  // Fetch wallet balance
  React.useEffect(() => {
    const fetchBalance = async () => {
      if (status === Web3ContextStatus.Connected && config?.tokenAddress && walletAddress && signer) {
        const erc20Service = new ERC20Service(provider, config.tokenAddress, signer)
        const balance = await erc20Service.balanceOf(walletAddress)
        logger.info('Wallet balance updated:', {
          balance: balance.toString(),
          formatted: collateral ? formatBigNumber(balance, collateral.decimals) : 'no collateral'
        })
        setWalletBalance(balance)
      }
    }
    fetchBalance()
  }, [status, config?.tokenAddress, walletAddress, signer, provider, collateral])

  const handleSplit = useCallback(async () => {
    try {
      if (status === Web3ContextStatus.Connected && activeAddress && walletAddress && CPKService && CTService && config && signer) {
        setTransactionStatus(Remote.loading())

        logger.info('SpotMarket config:', {
          config,
          networkId: networkConfig.networkId,
          cpkAddress: CPKService.address,
          ctAddress: CTService.address
        })

        logger.info('SpotMarket starting split with:', {
          amount: amount.toString(),
          tokenAddress: config.tokenAddress,
          conditionId: config.conditionId,
          walletAddress,
          activeAddress,
          usingCPK: isUsingTheCPKAddress()
        })

        // Create partition based on outcomes (YES/NO)
        const partition = config.outcomes.map((_, index) => new BigNumber(1 << index))
        logger.info('SpotMarket created partition:', {
          partition: partition.map(p => p.toString()),
          outcomes: config.outcomes
        })

        if (isUsingTheCPKAddress()) {
          logger.info('SpotMarket using CPK service with params:', {
            address: walletAddress,
            amount: amount.toString(),
            collateralToken: config.tokenAddress,
            conditionId: config.conditionId,
            parentCollectionId: NULL_PARENT_ID,
            partition: partition.map(p => p.toString())
          })

          await CPKService.splitPosition({
            CTService,
            address: walletAddress,
            amount,
            collateralToken: config.tokenAddress,
            conditionId: config.conditionId,
            parentCollectionId: NULL_PARENT_ID,
            partition,
          })
        } else {
          logger.info('SpotMarket using CT service directly with params:', {
            collateralToken: config.tokenAddress,
            parentCollectionId: NULL_PARENT_ID,
            conditionId: config.conditionId,
            partition: partition.map(p => p.toString()),
            amount: amount.toString()
          })

          await CTService.splitPosition(
            config.tokenAddress,
            NULL_PARENT_ID,
            config.conditionId,
            partition,
            amount
          )
        }

        const positionIds = await CTService.getPositionsFromPartition(
          partition,
          NULL_PARENT_ID,
          config.conditionId,
          config.tokenAddress,
          activeAddress
        )
        logger.info('SpotMarket split successful, position IDs:', positionIds)

        setTransactionStatus(Remote.success({ positionIds, collateral: config.tokenAddress }))
        setShowSplitModal(false)

        // Update wallet balance after split
        const erc20Service = new ERC20Service(provider, config.tokenAddress, signer)
        const newBalance = await erc20Service.balanceOf(walletAddress)
        setWalletBalance(newBalance)
        logger.info('Updated wallet balance:', {
          balance: newBalance.toString(),
          formatted: collateral ? formatBigNumber(newBalance, collateral.decimals) : 'no collateral'
        })

      } else if (status === Web3ContextStatus.Infura) {
        connect()
      }
    } catch (error) {
      logger.error('SpotMarket split failed:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      setTransactionStatus(Remote.failure(new Error(errorMessage)))
    }
  }, [
    status,
    activeAddress,
    walletAddress,
    CPKService,
    CTService,
    amount,
    connect,
    isUsingTheCPKAddress,
    config,
    collateral,
    provider,
    signer
  ])

  return (
    <Container>
      <Card>
        <Title>Spot Market</Title>
        
        <BuySellTabs>
          <Tab active={side === 'buy'} onClick={() => setSide('buy')}>Buy</Tab>
          <Tab active={side === 'sell'} onClick={() => setSide('sell')}>Sell</Tab>
        </BuySellTabs>

        <OutcomeSection>
          <OutcomeLabel>
            <span>Outcome</span>
            <span>Slippage: 0.3%</span>
          </OutcomeLabel>
          <OutcomeButtons>
            <OutcomeButton 
              active={outcome === 'pass'} 
              onClick={() => setOutcome('pass')}
            >
              Pass
            </OutcomeButton>
            <OutcomeButton 
              active={outcome === 'fail'} 
              onClick={() => setOutcome('fail')}
            >
              Fail
            </OutcomeButton>
          </OutcomeButtons>
        </OutcomeSection>

        {collateral && (
          <InputAmount
            amount={amount}
            collateral={collateral}
            onAmountChange={setAmount}
            position={null}
            splitFrom="collateral"
          />
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

        <ButtonContainer>
          <Button
            disabled={amount.isZero() || !allowanceFinished}
            onClick={handleSplit}
          >
            Split Position
          </Button>
        </ButtonContainer>

        {transactionStatus.isFailure() && (
          <div style={{ color: 'red', margin: '12px 0' }}>
            {transactionStatus.getFailure() || 'Transaction failed'}
          </div>
        )}
      </Card>
    </Container>
  )
} 