import gql from 'graphql-tag'

export const queryGetOmenMarketsByConditionID = gql`
  query GetOmenMarketsByConditionID($id: ID!) {
    condition(id: $id) {
      id
      # Let's check what fields are available by querying just the ID first
      # We can use GraphQL Playground or introspection to see the available fields
    }
  }
`
