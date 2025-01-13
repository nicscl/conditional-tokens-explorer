import React from 'react'
import styled from 'styled-components'

interface Balances {
  usdc: number
  usdcYes: number
  usdcNo: number
  wUsdcYes: number
  wUsdcNo: number
  fao: number
  faoYes: number
  faoNo: number
  wFaoYes: number
  wFaoNo: number
}

interface Props {
  type: 'USDC' | 'FAO'
  balances: Balances
}

const Container = styled.div`
  background: ${props => props.theme.colors.lightBackground};
  border-radius: 8px;
  padding: 12px;
`

const Title = styled.div`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.textColor};
  margin-bottom: 8px;
`

const BalanceRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  
  &:not(:last-child) {
    border-bottom: 1px solid ${props => props.theme.colors.border};
  }
`

const TokenName = styled.span`
  color: ${props => props.theme.colors.textColor};
`

const Balance = styled.span`
  color: ${props => props.theme.colors.textColor};
`

export const ConditionalTokenBalance: React.FC<Props> = ({ type, balances }) => {
  const getBalances = () => {
    if (type === 'USDC') {
      return [
        { name: 'USDC_YES', balance: balances.usdcYes, wrapped: balances.wUsdcYes },
        { name: 'USDC_NO', balance: balances.usdcNo, wrapped: balances.wUsdcNo }
      ]
    } else {
      return [
        { name: 'FAO_YES', balance: balances.faoYes, wrapped: balances.wFaoYes },
        { name: 'FAO_NO', balance: balances.faoNo, wrapped: balances.wFaoNo }
      ]
    }
  }

  const tokenBalances = getBalances()

  return (
    <Container>
      <Title>Conditional {type} Tokens</Title>
      {tokenBalances.map((token, index) => (
        <BalanceRow key={index}>
          <TokenName>{token.name}</TokenName>
          <Balance>
            {token.balance.toFixed(2)}
            {token.wrapped > 0 && ` (+ ${token.wrapped.toFixed(2)} wrapped)`}
          </Balance>
        </BalanceRow>
      ))}
    </Container>
  )
} 