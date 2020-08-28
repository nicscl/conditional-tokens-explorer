import React from 'react'

import { ConditionProvider } from '../../contexts/ConditionContext'
import { PositionProvider } from '../../contexts/PositionContext'

import { Contents } from './Contents'

export const RedeemPosition = () => {
  return (
    <PositionProvider checkForEmptyBalance={true}>
      <ConditionProvider checkForConditionNotResolved={true}>
        <Contents />
      </ConditionProvider>
    </PositionProvider>
  )
}