import { BigNumber } from 'ethers/utils'
import React, { useCallback, useState } from 'react'
import styled from 'styled-components'

import { Button } from 'components/buttons'
import { ButtonType } from 'components/buttons/buttonStylingTypes'
import { WrapModal } from 'components/modals/WrapModal'
import { UnwrapModal } from 'components/modals/UnwrapModal'
import { Row } from 'components/pureStyledComponents/Row'
import { ZERO_BN } from 'config/constants'
import { useWeb3ConnectedOrInfura } from 'contexts/Web3Context'
import { TransferOptions } from 'util/types'
import { WrapConfig } from 'config/mergeConfig'

const WrapUnwrapBadge = styled(Button)`
  font-size: 12px;
  height: 20px;
  padding: 0 8px;
  margin-left: 8px;
`

interface Props {
  positionId: string
  balanceERC1155: BigNumber
  balanceERC20: BigNumber
  decimals: number
  symbol: string
  wrap: WrapConfig
  onWrap: (transferValue: TransferOptions) => Promise<void>
  onUnwrap: (transferValue: TransferOptions) => Promise<void>
}

export const QuickWrapUnwrap: React.FC<Props> = ({
  positionId,
  balanceERC1155,
  balanceERC20,
  decimals,
  symbol,
  wrap,
  onWrap,
  onUnwrap,
}) => {
  const [isWrapModalOpen, setIsWrapModalOpen] = useState(false)
  const [isUnwrapModalOpen, setIsUnwrapModalOpen] = useState(false)

  const openWrapModal = useCallback(() => setIsWrapModalOpen(true), [])
  const closeWrapModal = useCallback(() => setIsWrapModalOpen(false), [])
  const openUnwrapModal = useCallback(() => setIsUnwrapModalOpen(true), [])
  const closeUnwrapModal = useCallback(() => setIsUnwrapModalOpen(false), [])

  return (
    <>
      {!balanceERC1155.isZero() && (
        <WrapUnwrapBadge
          buttonType={ButtonType.primary}
          onClick={openWrapModal}
        >
          Wrap
        </WrapUnwrapBadge>
      )}
      {!balanceERC20.isZero() && (
        <WrapUnwrapBadge
          buttonType={ButtonType.primary}
          onClick={openUnwrapModal}
        >
          Unwrap
        </WrapUnwrapBadge>
      )}
      <WrapModal
        balance={balanceERC1155}
        collateralSymbol={symbol}
        decimals={decimals}
        isOpen={isWrapModalOpen}
        onRequestClose={closeWrapModal}
        onWrap={onWrap}
        positionId={positionId}
        tokenWrappedName={wrap.tokenName}
        tokenWrappedSymbol={wrap.tokenSymbol}
        wrappedCollateralTokenAddress={wrap.wrappedCollateralTokenAddress}
      />
      <UnwrapModal
        balance={balanceERC20}
        decimals={decimals}
        isOpen={isUnwrapModalOpen}
        onRequestClose={closeUnwrapModal}
        onUnWrap={onUnwrap}
        positionId={positionId}
        tokenName={wrap.tokenName}
        tokenSymbol={wrap.tokenSymbol}
        wrappedCollateralAddress={wrap.wrappedCollateralTokenAddress}
      />
    </>
  )
} 