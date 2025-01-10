import { BigNumber } from 'ethers/utils'
import React, { useCallback, useMemo, useState } from 'react'
import styled from 'styled-components'

import { Button } from 'components/buttons'
import { Modal, ModalProps } from 'components/common/Modal'
import { Amount } from 'components/form/Amount'
import { ButtonContainer } from 'components/pureStyledComponents/ButtonContainer'
import { Row } from 'components/pureStyledComponents/Row'
import { ZERO_BN } from 'config/constants'
import { useWeb3ConnectedOrInfura } from 'contexts/Web3Context'
import { getLogger } from 'util/logger'
import { TransferOptions } from 'util/types'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getTokenBytecode } = require('1155-to-20-helper/src')

const logger = getLogger('UnwrapModal')

const FirstRow = styled(Row)`
  padding-top: 12px;
`

const ButtonContainerStyled = styled(ButtonContainer)`
  margin-top: 100px;
`

interface Props extends ModalProps {
  balance: BigNumber
  decimals: number
  onUnWrap: (transferValue: TransferOptions) => Promise<void>
  positionId: string
  tokenName: string
  tokenSymbol: string
  wrappedCollateralAddress?: string
  accountTo?: string
}

export const UnwrapModal: React.FC<Props> = ({
  accountTo,
  balance,
  decimals,
  onRequestClose,
  onUnWrap,
  positionId,
  tokenName,
  tokenSymbol,
  wrappedCollateralAddress,
  ...restProps
}) => {
  const { CTService } = useWeb3ConnectedOrInfura()

  const maxBalance = useMemo(() => (balance ? balance : ZERO_BN), [balance])

  const [amount, setAmount] = useState<BigNumber>(ZERO_BN)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const amountChangeHandler = useCallback((value: BigNumber) => {
    setAmount(value)
  }, [])

  const useWalletHandler = useCallback(() => {
    if (maxBalance.gt(ZERO_BN)) {
      setAmount(maxBalance)
    }
  }, [maxBalance])

  const isSubmitDisabled = amount.isZero()

  const onSubmit = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      try {
        setIsSubmitting(true)
        const tokenBytes = getTokenBytecode(tokenName, tokenSymbol, decimals, wrappedCollateralAddress)
        await onUnWrap({ 
          amount, 
          positionId, 
          tokenBytes,
          address: CTService.address 
        })
        if (typeof onRequestClose === 'function') {
          onRequestClose(e)
        }
      } catch (err) {
        logger.error(err)
        setIsSubmitting(false)
      }
    },
    [amount, decimals, onRequestClose, onUnWrap, positionId, tokenName, tokenSymbol, wrappedCollateralAddress, CTService]
  )

  const onPressEnter = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !isSubmitDisabled) {
        onSubmit(e as any)
      }
    },
    [onSubmit, isSubmitDisabled]
  )

  return (
    <Modal
      onRequestClose={onRequestClose}
      style={{ content: { width: '500px' } }}
      title={'Unwrap ERC20'}
      {...restProps}
    >
      <FirstRow>
        <Amount
          amount={amount}
          autoFocus
          balance={maxBalance}
          decimals={decimals}
          isFromAPosition
          max={maxBalance.toString()}
          onAmountChange={amountChangeHandler}
          onKeyUp={onPressEnter}
          onUseWalletBalance={useWalletHandler}
          tokenSymbol={tokenSymbol}
        />
      </FirstRow>
      <ButtonContainerStyled>
        <Button disabled={isSubmitDisabled || isSubmitting} onClick={onSubmit}>
          Unwrap
        </Button>
      </ButtonContainerStyled>
    </Modal>
  )
}
