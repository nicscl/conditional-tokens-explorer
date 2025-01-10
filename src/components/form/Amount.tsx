import { BigNumber } from 'ethers/utils'
import React, { InputHTMLAttributes } from 'react'

import { BigNumberInputWrapper } from 'components/form/BigNumberInputWrapper'
import { TitleControlButton } from 'components/pureStyledComponents/TitleControl'
import { TitleValue } from 'components/text/TitleValue'
import { Web3ContextStatus, useWeb3ConnectedOrInfura } from 'contexts/Web3Context'
import { formatBigNumber } from 'util/tools'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  amount: BigNumber
  balance: BigNumber
  decimals: number
  isFromAPosition?: boolean
  max: string
  onAmountChange: (value: BigNumber) => void
  onUseWalletBalance: () => void
  tokenSymbol?: string
}

export const Amount = ({
  amount,
  autoFocus,
  balance,
  decimals,
  disabled,
  isFromAPosition = false,
  max,
  onAmountChange,
  onKeyUp,
  onUseWalletBalance,
  tokenSymbol,
}: Props) => {
  const { _type: status } = useWeb3ConnectedOrInfura()

  const isDisconnected = status !== Web3ContextStatus.Connected

  return (
    <TitleValue
      title="Amount"
      titleControl={
        isDisconnected || !balance ? (
          <TitleControlButton disabled>Not Connected To Wallet</TitleControlButton>
        ) : (
          <TitleControlButton disabled={disabled} onClick={onUseWalletBalance}>
            Use Max Balance (${formatBigNumber(balance, decimals)})
          </TitleControlButton>
        )
      }
      value={
        <BigNumberInputWrapper
          autoFocus={autoFocus}
          decimals={decimals}
          disabled={disabled}
          max={max}
          onChange={onAmountChange}
          onKeyUp={onKeyUp}
          tokenSymbol={tokenSymbol}
          value={amount}
        />
      }
    />
  )
} 