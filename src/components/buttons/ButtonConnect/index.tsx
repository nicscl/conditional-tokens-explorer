import { darken } from 'polished'
import React from 'react'
import styled from 'styled-components'

import { ChevronRight } from 'components/icons/ChevronRight'
import { useWeb3Context, Web3ContextStatus } from 'contexts/Web3Context'

const Wrapper = styled.button`
  &.buttonConnect {
    align-items: center;
    background: transparent;
    color: ${(props) => props.theme.colors.error};
    cursor: pointer;
    display: flex;
    font-size: 15px;
    font-weight: 400;
    height: 100%;
    line-height: 1.2;
    outline: none;
    padding: 0;
    border: none;

    &[disabled] {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .fill {
      fill: ${(props) => props.theme.colors.error};
    }

    &:hover {
      color: ${(props) => darken(0.15, props.theme.colors.error)};

      .fill {
        fill: ${(props) => darken(0.15, props.theme.colors.error)};
      }
    }
  }
`

const Text = styled.span`
  margin-right: 10px;
`

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string
}

export const ButtonConnect: React.FC<Props> = (props) => {
  const { className, ...restProps } = props
  const { status, connect } = useWeb3Context()

  // Only show button when not connected
  if (status._type === Web3ContextStatus.Connected) {
    return null
  }

  const getButtonText = () => {
    switch (status._type) {
      case Web3ContextStatus.WaitingForUser:
        return 'Connecting...'
      case Web3ContextStatus.Error:
        return 'Connect Wallet'  // Reset to connect wallet on error
      case Web3ContextStatus.WrongNetwork:
        return 'Switch Network'
      default:
        return 'Connect Wallet'
    }
  }

  const isDisabled = status._type === Web3ContextStatus.WaitingForUser || 
                    status._type === Web3ContextStatus.Connecting

  const buttonText = getButtonText()

  return (
    <Wrapper 
      className={`buttonConnect ${className}`} 
      onClick={connect}
      disabled={isDisabled}
      {...restProps}
    >
      <Text>{buttonText}</Text>
      <ChevronRight />
    </Wrapper>
  )
}
