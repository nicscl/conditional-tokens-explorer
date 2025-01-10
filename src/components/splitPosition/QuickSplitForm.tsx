import React, { useCallback, useState } from 'react'
import styled from 'styled-components'
import { BigNumber } from 'ethers/utils'
import { TransactionReceipt } from 'ethers/providers'

import { Button } from 'components/buttons/Button'
import { ButtonType } from 'components/buttons/buttonStylingTypes'
import { CenteredCard } from 'components/common/CenteredCard'
import { SetAllowance } from 'components/common/SetAllowance'
import { InputAmount } from 'components/form/InputAmount'
import { ButtonContainer } from 'components/pureStyledComponents/ButtonContainer'
import { CardTextSm } from 'components/pureStyledComponents/CardText'
import { TitleValue } from 'components/text/TitleValue'
import { NULL_PARENT_ID, ZERO_BN } from 'config/constants'
import { Web3ContextStatus, useWeb3ConnectedOrInfura } from 'contexts/Web3Context'
import { useActiveAddress } from 'hooks/useActiveAddress'
import { useAllowanceState } from 'hooks/useAllowanceState'
import { useAllowance } from 'hooks/useAllowance'
import { useCollateral } from 'hooks/useCollateral'
import { QuickSplitConfig } from 'config/splitConfig'
import { getLogger } from 'util/logger'
import { Remote } from 'util/remoteData'
import { SplitFromType, SplitStatus } from 'util/types'

const logger = getLogger('QuickSplitForm')

interface Props {
  config: QuickSplitConfig
}

export const QuickSplitForm: React.FC<Props> = ({ config }) => {
  const {
    _type: status,
    CPKService,
    CTService,
    address: walletAddress,
    connect,
    isUsingTheCPKAddress,
  } = useWeb3ConnectedOrInfura()

  const activeAddress = useActiveAddress()
  const [amount, setAmount] = useState(ZERO_BN)
  const [transactionStatus, setTransactionStatus] = useState<Remote<SplitStatus>>(
    Remote.notAsked<SplitStatus>()
  )

  const { collateral } = useCollateral(config.tokenAddress)
  const allowanceMethods = useAllowance(config.tokenAddress)
  const {
    allowanceError,
    allowanceFinished,
    cleanAllowanceError,
    fetchingAllowance,
    shouldDisplayAllowance,
    unlockCollateral: unlock,
  } = useAllowanceState(allowanceMethods, amount)

  const onSubmit = useCallback(async () => {
    try {
      if (status === Web3ContextStatus.Connected && activeAddress && walletAddress && CPKService) {
        setTransactionStatus(Remote.loading())

        // Create partition based on outcomes
        const partition = config.outcomes.map((_, index) => new BigNumber(1 << index))

        if (isUsingTheCPKAddress()) {
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

        setTransactionStatus(Remote.success({ positionIds, collateral: config.tokenAddress }))
      } else if (status === Web3ContextStatus.Infura) {
        connect()
      }
    } catch (error) {
      logger.error(error)
      setTransactionStatus(Remote.failure(error instanceof Error ? error : new Error(String(error))))
    }
  }, [
    status,
    activeAddress,
    walletAddress,
    CPKService,
    CTService,
    amount,
    config,
    connect,
    isUsingTheCPKAddress,
  ])

  const isSubmitDisabled = amount.isZero() || !allowanceFinished

  return (
    <CenteredCard>
      <CardTextSm>Quick Split Position</CardTextSm>
      <TitleValue
        title="Condition"
        value={config.description}
      />
      <TitleValue
        title="Token"
        value={collateral?.symbol || ''}
      />
      <TitleValue
        title="Outcomes"
        value={config.outcomes.join(', ')}
      />
      {collateral && (
        <InputAmount
          amount={amount}
          collateral={collateral}
          onAmountChange={setAmount}
          position={null}
          splitFrom={SplitFromType.collateral}
        />
      )}
      {shouldDisplayAllowance && collateral && (
        <SetAllowance
          collateral={collateral}
          error={allowanceError}
          fetching={fetchingAllowance}
          finished={allowanceFinished}
          onUnlock={unlock}
        />
      )}
      <ButtonContainer>
        <Button
          buttonType={ButtonType.primary}
          disabled={isSubmitDisabled}
          onClick={onSubmit}
        >
          Split Position
        </Button>
      </ButtonContainer>
    </CenteredCard>
  )
} 