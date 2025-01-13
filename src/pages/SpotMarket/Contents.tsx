import React from 'react'
import { CenteredCard } from 'components/common/CenteredCard'
import { SpotMarketPanel } from 'components/spotMarket/SpotMarketPanel'
import { PageTitle } from 'components/text/PageTitle'

export const Contents: React.FC = () => {
  return (
    <>
      <PageTitle>Spot Market</PageTitle>
      <CenteredCard>
        <SpotMarketPanel />
      </CenteredCard>
    </>
  )
} 