import React from 'react'
import { Route, Switch } from 'react-router-dom'

import { PrepareCondition } from '../prepare-condition'
import { SplitConditionContainer } from '../split-condition'
import { ConditionsList } from 'pages/conditions-list'
import { ConditionsDetailContainer } from 'pages/condition-detail'
import { PositionsList } from 'pages/positions-list'
import { PositionDetailContainer } from 'pages/position-detail'
import { ReportPayoutsContainer } from '../report-payouts'
import { RedeemPosition } from '../redeem-position/Index'

export const Connected = () => {
  return (
    <Switch>
      <Route component={PrepareCondition} exact path="/" />
      <Route component={SplitConditionContainer} exact path="/split" />
      <Route component={ConditionsList} exact path="/conditions" />
      <Route component={ConditionsDetailContainer} exact path="/conditions/:conditionId" />
      <Route component={PositionsList} exact path="/positions" />
      <Route component={PositionDetailContainer} exact path="/positions/:positionId" />
      <Route component={ReportPayoutsContainer} exact path="/report" />
      <Route component={RedeemPosition} exact path="/redeem" />
    </Switch>
  )
}
