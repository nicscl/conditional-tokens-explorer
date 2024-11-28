# Gnosis Conditional Tokens Subgraph

This is a subgraph implementation for [Gnosis Conditional Tokens](https://github.com/gnosis/hg-subgraph), a framework for creating and trading conditional tokens.

## Overview

The Gnosis Conditional Tokens Subgraph indexes and provides query access to conditional token data on various networks (mainnet, rinkeby, xdai, etc). It tracks:

- Conditions: Representing questions/outcomes
- Collections: Groups of conditions
- Positions: Token positions based on conditions
- Users: Participants trading positions

## Key Features

- Indexes conditional token events and state
- Tracks condition preparation and resolution
- Monitors position splits, merges and transfers
- Maps relationships between conditions, collections and positions
- Provides GraphQL API for querying data

## Setup Instructions (Docker)

1. Clone the repository:
```bash
git clone https://github.com/gnosis/hg-subgraph
cd hg-subgraph
```

2. Start the required services using Docker Compose:
```bash
docker-compose up -d
```
This will start:
- IPFS node
- PostgreSQL database
- Graph Node
- Ganache test network

3. Install dependencies:
```bash
npm install
```

4. Generate code and deploy locally:
```bash
npm run codegen
npm run create-local
npm run deploy-local
```

## Testing

Run the test suite:
```bash
npm test
```

This will:
- Start required services
- Deploy contracts to Ganache
- Run the test scenarios

## Deployment

Deploy to different networks:

```bash
# Rinkeby
npm run publish-graph:rinkeby

# Mainnet 
npm run publish-graph:mainnet

# xDai
npm run publish-graph:gnosis
```

## Key Components

### Schema

The GraphQL schema defines the data model with key entities:

- Condition: Questions and their outcomes
- Collection: Groups of conditions
- Position: Token positions held by users
- User: Participants trading positions

### Mappings

Event handlers in src/mapping.ts process blockchain events:

- ConditionPreparation: New conditions
- PositionSplit/Merge: Position changes
- TransferSingle/Batch: Token transfers

### Configuration

The subgraph.yaml template configures:

- Contract addresses
- Event handlers
- Entity mappings

## Useful Commands

```bash
# Regenerate ABIs
npm run refresh-abi

# Update subgraph config
npm run render-subgraph-config-local

# Clean and rebuild
npm run codegen && npm run build

# Deploy fresh instance
npm run test-fresh-deploy
```

## GraphQL Examples

Query condition data:
```graphql
{
  condition(id: "...") {
    id
    oracle
    questionId
    outcomeSlotCount
    resolved
    payoutNumerators
  }
}
```

Get user positions:
```graphql
{
  user(id: "...") {
    id
    userPositions {
      balance
      position {
        id
        collateralToken
        collection {
          conditions {
            id
          }
        }
      }
    }
  }
}
}
```

## Resources

- [Conditional Tokens Contracts](https://github.com/gnosis/conditional-tokens-contracts)
- [Graph Node](https://github.com/graphprotocol/graph-node)
- [Graph CLI Documentation](https://thegraph.com/docs/en/developer/create-subgraph-hosted/)

# Gnosis Conditional Tokens Subgraph

This is a subgraph implementation for [Gnosis Conditional Tokens](https://github.com/gnosis/hg-subgraph)...
