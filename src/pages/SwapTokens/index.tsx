import React from 'react'
import styled from 'styled-components'

import { PageTitle } from 'components/text/PageTitle'
import { BaseCard } from 'components/pureStyledComponents/BaseCard'
import { InlineLoading } from 'components/statusInfo/InlineLoading'
import { Web3ContextStatus, useWeb3Context } from 'contexts/Web3Context'

const Wrapper = styled.div`
  padding: 0 20px;
`

const SwapFrame = styled.iframe`
  border: none;
  width: 100%;
  height: 640px;
  border-radius: 8px;
`

const Contents = styled(BaseCard)`
  margin: 0 auto;
  max-width: 420px;
  padding: 0;
  overflow: hidden;
`

export const SwapTokens: React.FC = () => {
  const { status } = useWeb3Context()
  const isConnected = status._type === Web3ContextStatus.Connected

  return (
    <Wrapper>
      <PageTitle>Swap Tokens</PageTitle>
      <Contents>
        {!isConnected && <InlineLoading message="Please connect to your wallet..." />}
        {isConnected && (
          <SwapFrame
            src="http://18.229.197.237:3001/swap?inputCurrency=ETH&outputCurrency=0x38EEFf6a964ac441B900DEB6bF25C85BE85A32a0"
            title="Sushiswap Widget"
            allow="clipboard-write; clipboard-read"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        )}
      </Contents>
    </Wrapper>
  )
} 