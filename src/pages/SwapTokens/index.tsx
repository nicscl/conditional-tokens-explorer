import React, { useEffect, useRef, useCallback } from 'react'
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

// Events to forward to the iframe
const ETHEREUM_EVENTS = [
  'chainChanged',
  'accountsChanged',
  'connect',
  'disconnect',
  'message'
]

let messageIdCounter = 0
const generateMessageId = () => `${Date.now()}_${messageIdCounter++}`

export const SwapTokens: React.FC = () => {
  const { status } = useWeb3Context()
  const isConnected = status._type === Web3ContextStatus.Connected
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Handle sending Web3 context to iframe
  const sendWeb3Context = useCallback((requestId?: string) => {
    if (isConnected && status._type === Web3ContextStatus.Connected && iframeRef.current?.contentWindow) {
      // Only send serializable data
      iframeRef.current.contentWindow.postMessage({
        type: 'WEB3_CONTEXT',
        id: requestId || generateMessageId(),
        data: {
          address: status.address,
          chainId: status.networkConfig.networkId,
          isConnected: true,
          // Send network info
          network: {
            name: status.networkConfig.getNetworkName(),
            id: status.networkConfig.networkId
          }
        }
      }, '*')
    }
  }, [isConnected, status])

  // Set up ethereum event forwarding
  useEffect(() => {
    if (!window.ethereum) return

    const forwardEvent = (eventName: string) => (...args: any[]) => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({
          type: 'ETHEREUM_EVENT',
          id: generateMessageId(),
          eventName,
          payload: args
        }, '*')
      }
    }

    // Set up listeners for each event
    const listeners = ETHEREUM_EVENTS.map(eventName => {
      const listener = forwardEvent(eventName)
      window.ethereum.on(eventName, listener)
      return { eventName, listener }
    })

    // Cleanup listeners
    return () => {
      listeners.forEach(({ eventName, listener }) => {
        window.ethereum?.removeListener(eventName, listener)
      })
    }
  }, [])

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin in production
      if (event.data?.type === 'REQUEST_WEB3_CONTEXT') {
        sendWeb3Context(event.data?.id)
      }
      // Handle transaction requests from iframe
      else if (event.data?.type === 'REQUEST_TRANSACTION' && window.ethereum) {
        const { method, params } = event.data.data
        const requestId = event.data.id
        window.ethereum
          .request({ method, params })
          .then((result: any) => {
            iframeRef.current?.contentWindow?.postMessage({
              type: 'TRANSACTION_RESPONSE',
              id: requestId,
              result
            }, '*')
          })
          .catch((error: any) => {
            iframeRef.current?.contentWindow?.postMessage({
              type: 'TRANSACTION_RESPONSE',
              id: requestId,
              error: error.message
            }, '*')
          })
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [sendWeb3Context])

  // Send context when connection status changes
  useEffect(() => {
    if (isConnected) {
      // Small delay to ensure iframe is ready
      setTimeout(() => {
        sendWeb3Context(generateMessageId())
      }, 100)
    }
  }, [isConnected, sendWeb3Context])

  return (
    <Wrapper>
      <PageTitle>Swap Tokens</PageTitle>
      <Contents>
        {!isConnected && <InlineLoading message="Please connect to your wallet..." />}
        {isConnected && (
          <SwapFrame
            ref={iframeRef}
            src="http://18.229.197.237:3002/iframe/swap?inputCurrency=ETH&outputCurrency=0x38EEFf6a964ac441B900DEB6bF25C85BE85A32a0"
            title="Sushiswap Widget"
            allow="clipboard-write; clipboard-read"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        )}
      </Contents>
    </Wrapper>
  )
} 