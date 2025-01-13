import React from 'react'
import styled from 'styled-components'

interface SubBalance {
  label: string
  value: number
}

interface Props {
  token: string
  balance: number
  wrappedBalance?: number
  subBalances?: SubBalance[]
}

interface MainBalanceProps {
  hasSubBalances?: boolean
}

const BalanceContainer = styled.div`
  background: ${props => props.theme.colors.lightBackground};
  border-radius: 8px;
  padding: 12px;
`

const MainBalance = styled.div<MainBalanceProps>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${props => props.hasSubBalances ? '8px' : '0'};
`

const SubBalances = styled.div`
  border-top: 1px solid ${props => props.theme.colors.border};
  padding-top: 8px;
  margin-top: 8px;
  font-size: 0.875rem;
`

const SubBalanceRow = styled.div`
  display: flex;
  justify-content: space-between;
  color: ${props => props.theme.colors.textColor};
  opacity: 0.8;
  
  &:not(:last-child) {
    margin-bottom: 4px;
  }
`

export const TokenBalance: React.FC<Props> = ({ token, balance, wrappedBalance, subBalances }) => {
  return (
    <BalanceContainer>
      <MainBalance hasSubBalances={!!subBalances?.length}>
        <span>{token}</span>
        <span>{balance.toFixed(2)}</span>
      </MainBalance>
      
      {wrappedBalance !== undefined && wrappedBalance > 0 && (
        <SubBalances>
          <SubBalanceRow>
            <span>Wrapped Balance</span>
            <span>{wrappedBalance.toFixed(2)}</span>
          </SubBalanceRow>
        </SubBalances>
      )}

      {subBalances && subBalances.length > 0 && (
        <SubBalances>
          {subBalances.map((subBalance, index) => (
            <SubBalanceRow key={index}>
              <span>{subBalance.label}</span>
              <span>{subBalance.value.toFixed(2)}</span>
            </SubBalanceRow>
          ))}
        </SubBalances>
      )}
    </BalanceContainer>
  )
} 