import React, { useState } from 'react'
import styled from 'styled-components'

import { Button } from 'components/buttons/Button'
import { ButtonType } from 'components/buttons/buttonStylingTypes'
import { InlineLoading } from 'components/statusInfo/InlineLoading'
import { PageTitle } from 'components/text/PageTitle'
import { useWeb3ConnectedOrInfura } from 'contexts/Web3Context'
import { Form } from 'pages/SplitPosition/Form'
import { QuickSplitForm } from 'components/splitPosition/QuickSplitForm'
import { quickSplitConfigs } from 'config/splitConfig'

const ModeSwitcher = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
`

export const SplitPosition = () => {
  const { networkConfig } = useWeb3ConnectedOrInfura()
  const [mode, setMode] = useState<'quick' | 'advanced'>('quick')

  const tokens = networkConfig.getTokens()
  const configs = quickSplitConfigs[networkConfig.networkId] || []

  return (
    <>
      <PageTitle>Split Position</PageTitle>
      <ModeSwitcher>
        <Button
          buttonType={mode === 'quick' ? ButtonType.primary : ButtonType.primaryInverted}
          onClick={() => setMode('quick')}
        >
          Quick Mode
        </Button>
        <Button
          buttonType={mode === 'advanced' ? ButtonType.primary : ButtonType.primaryInverted}
          onClick={() => setMode('advanced')}
        >
          Advanced Mode
        </Button>
      </ModeSwitcher>

      {mode === 'quick' && configs.length > 0 && (
        configs.map((config, index) => (
          <QuickSplitForm key={index} config={config} />
        ))
      )}

      {mode === 'quick' && configs.length === 0 && (
        <div>No quick split configurations available for this network.</div>
      )}

      {mode === 'advanced' && !tokens && <InlineLoading />}
      {mode === 'advanced' && tokens && <Form tokens={tokens} />}
    </>
  )
}
