import { useApolloClient } from '@apollo/react-hooks'
import { useEffect, useMemo, useState } from 'react'

import { queryGetOmenMarketsByConditionID } from 'queries/OMENMarkets'
import {
  GetOmenMarketsByConditionID_condition,
  GetOmenMarketsByConditionID as MaybeConditionWithMarket,
  GetOmenMarketsByConditionID_condition_fixedProductMarketMakers as OmenMarketFromTheGraph,
} from 'types/generatedGQLForOMEN'
import { getOmenMarketURL } from 'util/tools'

type ValidOmenMarket = OmenMarketFromTheGraph & {
  __typename: "FixedProductMarketMaker"
  id: string
  question: {
    __typename: "Question"
    title: string
  }
}

type ConditionWithMarket = {
  condition: GetOmenMarketsByConditionID_condition
}

const hasCondition = (data: MaybeConditionWithMarket) => !!data.condition
const hasTitle = (data: OmenMarketFromTheGraph) => !!(data.question && data.question.title)

export type OmenMarketWithURL = ValidOmenMarket & { url: string }

export const useOmenMarkets = (conditionsIds: string[]) => {
  const client = useApolloClient()
  const [queryResult, setQueryResult] = useState<Maybe<OmenMarketWithURL[]>>(null)
  const [error, setError] = useState<Maybe<Error>>(null)
  const [loading, setLoading] = useState(false)

  const queryAllOmenMarkets = useMemo(() => {
    return conditionsIds.map((id) => {
      return client.query<MaybeConditionWithMarket>({
        query: queryGetOmenMarketsByConditionID,
        context: { clientName: 'Omen' },
        variables: {
          id,
        },
      })
    })
  }, [conditionsIds, client])

  useEffect(() => {
    let cancelled = false

    setLoading(true)

    Promise.all(queryAllOmenMarkets)
      .then((data) => {
        if (!cancelled) {
          const dataFiltered = data
            .map((result) => result.data)
            .filter((data: MaybeConditionWithMarket): data is ConditionWithMarket =>
              hasCondition(data)
            )
            .map((data) => data.condition)
            .filter((data) => data.fixedProductMarketMakers.length > 0)
            .map((data) => data.fixedProductMarketMakers)
            .flat(1)
            .filter((data: OmenMarketFromTheGraph): data is OmenMarketFromTheGraph => hasTitle(data))
            .map((market) => {
              return { ...market, url: getOmenMarketURL(market.id) } as OmenMarketWithURL
            })
          setQueryResult(dataFiltered)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [queryAllOmenMarkets])

  return {
    data: queryResult || [],
    error,
    loading,
  }
}
