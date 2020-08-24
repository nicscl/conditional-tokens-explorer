import { MergePositions } from 'pages/MergePositions'
import React from 'react'
import { Redirect, Route, Switch } from 'react-router-dom'

import { InfoCard } from '../../components/statusInfo/InfoCard'
import { ConditionDetails } from '../ConditionDetails'
import { ConditionsList } from '../ConditionsList'
import { PositionDetails } from '../PositionDetails'
import { PositionsList } from '../PositionsList'
import { PrepareCondition } from '../PrepareCondition'
import { ReportPayoutsContainer } from '../ReportPayouts'
import { SplitPosition } from '../SplitPosition'
import { RedeemPositionContainer } from '../redeem-position'

export const Routes: React.FC = () => {
  return (
    <Switch>
      <Route component={ConditionsList} exact path="/conditions" />
      <Route component={ConditionDetails} exact path="/conditions/:conditionId" />
      <Route component={PositionsList} exact path="/positions" />
      <Route component={PositionDetails} exact path="/positions/:positionId" />
      <Route component={PrepareCondition} path="/prepare" />
      <Route component={SplitPosition} path="/split" />
      <Route component={ReportPayoutsContainer} path="/report" />
      <Route component={RedeemPositionContainer} path="/redeem" />
      <Route component={MergePositions} path="/merge" />
      <Route exact path="/">
        <Redirect to="/conditions" />
      </Route>
      <Route path="*">
        <InfoCard message="Page not found..." title="Error 404" />
      </Route>
    </Switch>
  )
}