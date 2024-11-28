# Conditional Tokens Explorer and Factory Developer Guide

## Overview
The Conditional Tokens Explorer and Factory (CTEF) is a decentralized application built on Ethereum that enables users to interact with Gnosis Conditional Tokens. It provides a user interface for creating, managing, and trading conditional tokens - ERC1155 tokens that represent positions in prediction markets or other outcome-dependent scenarios.

## Core Concepts

### Conditional Tokens
- ERC1155 tokens that represent positions in outcome-dependent scenarios
- Can be split, merged, and traded based on different conditions
- Used primarily in prediction markets and conditional outcome scenarios

### Key Components
1. **Conditions**: Represent questions or scenarios with multiple possible outcomes
2. **Positions**: Represent holdings in specific outcomes of conditions
3. **Oracle**: External source that reports the actual outcome (e.g., Reality.eth)
4. **Collateral**: The underlying token used to create positions (e.g., DAI, USDC)

## Technical Architecture

### Frontend
- React with TypeScript
- Web3 integration for blockchain interaction
- Apollo Client for GraphQL queries
- Styled Components for styling

### Backend/Blockchain
- Smart Contracts (Solidity)
- The Graph for indexing blockchain data
- IPFS for decentralized storage
- Reality.eth for oracle services

### Infrastructure
- Docker for containerization
- Ganache for local blockchain
- PostgreSQL for The Graph Node
- IPFS node for decentralized storage

## Development Setup

### Prerequisites
- Docker and Docker Compose
- Node.js (v14.x recommended)
- Git

### Local Development Environment

1. Clone the repository and install dependencies:
```bash
git clone <repository-url>
cd conditional-tokens-explorer
```

2. Create a .env file in the root directory with required environment variables (see .env.example)

3. Start the Docker containers:
```bash
docker-compose up -d --build
```

4. The application will be available at:
- Frontend: http://localhost:3000
- Graph Node: http://localhost:8000
- IPFS: http://localhost:5001

### Key Development Commands

- `docker-compose up -d`: Start all services
- `docker-compose down`: Stop all services
- `docker-compose logs -f`: Follow logs from all services

### Project Structure

- `/src`: Frontend React application
- `/docker`: Docker configuration files
- `/contracts`: Smart contract source code
- `/subgraph`: The Graph subgraph definition

### Development Workflow

1. **Smart Contracts**: Deploy using Truffle through Docker
2. **Subgraph**: Deploy to local Graph Node
3. **Frontend**: Develop React components and interact with contracts

### Testing

- Unit tests: `yarn test`
- Integration tests: Through Docker environment
- Contract tests: Using Truffle

### Deployment

1. Deploy smart contracts to desired network
2. Deploy subgraph to The Graph
3. Build and deploy frontend
4. Configure environment variables

### Common Issues & Solutions

1. **Graph Node Sync**: If the Graph Node fails to sync, try:
```bash
docker-compose down -v
docker-compose up -d
```

2. **Contract Deployment**: Ensure correct network in truffle-config.js

3. **IPFS Connection**: Check IPFS node is running and accessible

### Best Practices

1. Follow TypeScript types strictly
2. Use React hooks for state management
3. Test thoroughly before deploying
4. Keep environment variables secure

### Additional Resources

- [Gnosis Conditional Tokens Documentation](https://docs.gnosis.io/conditionaltokens/)
- [The Graph Documentation](https://thegraph.com/docs/)
- [Reality.eth Documentation](https://reality.eth.link/)

### Contributing

1. Fork the repository
2. Create feature branch
3. Submit pull request
4. Follow code style guidelines

### Support

- GitHub Issues
- Developer Discord
- Documentation Wiki


# Conditional Tokens Explorer and Factory Developer Guide

## Overview
The Conditional Tokens Explorer and Factory (CTEF) is a decentralized application built on Ethereum that enables users to interact with Gnosis Conditional Tokens. It provides a user interface for creating, managing, and trading conditional tokens - ERC1155 tokens that represent positions in prediction markets or other outcome-dependent scenarios.

## Core Concepts

### Conditional Tokens
- ERC1155 tokens that represent positions in outcome-dependent scenarios
- Can be split, merged, and traded based on different conditions
- Used primarily in prediction markets and conditional outcome scenarios

### Key Components
1. **Conditions**: Represent questions or scenarios with multiple possible outcomes
2. **Positions**: Represent holdings in specific outcomes of conditions
3. **Oracle**: External source that reports the actual outcome (e.g., Reality.eth)
4. **Collateral**: The underlying token used to create positions (e.g., DAI, USDC)

## Technical Architecture

### Frontend
- React with TypeScript
- Web3 integration for blockchain interaction
- Apollo Client for GraphQL queries
- Styled Components for styling

### Backend/Blockchain
- Smart Contracts (Solidity)
- The Graph for indexing blockchain data
- IPFS for decentralized storage
- Reality.eth for oracle services

### Infrastructure
- Docker for containerization
- Ganache for local blockchain
- PostgreSQL for The Graph Node
- IPFS node for decentralized storage

## Development Setup

### Prerequisites
- Docker and Docker Compose
- Node.js (v14.x recommended)
- Git

### Local Development Environment

1. Clone the repository and install dependencies:
```bash
git clone <repository-url>
cd conditional-tokens-explorer
```

2. Create a .env file in the root directory with required environment variables (see .env.example)

3. Start the Docker containers:
```bash
docker-compose up -d --build
```

4. The application will be available at:
- Frontend: http://localhost:3000
- Graph Node: http://localhost:8000
- IPFS: http://localhost:5001

### Key Development Commands

- `docker-compose up -d`: Start all services
- `docker-compose down`: Stop all services
- `docker-compose logs -f`: Follow logs from all services

### Project Structure

- `/src`: Frontend React application
- `/docker`: Docker configuration files
- `/contracts`: Smart contract source code
- `/subgraph`: The Graph subgraph definition

### Development Workflow

1. **Smart Contracts**: Deploy using Truffle through Docker
2. **Subgraph**: Deploy to local Graph Node
3. **Frontend**: Develop React components and interact with contracts

### Testing

- Unit tests: `yarn test`
- Integration tests: Through Docker environment
- Contract tests: Using Truffle

### Deployment

1. Deploy smart contracts to desired network
2. Deploy subgraph to The Graph
3. Build and deploy frontend
4. Configure environment variables

### Common Issues & Solutions

1. **Graph Node Sync**: If the Graph Node fails to sync, try:
```bash
docker-compose down -v
docker-compose up -d
```

2. **Contract Deployment**: Ensure correct network in truffle-config.js

3. **IPFS Connection**: Check IPFS node is running and accessible

### Best Practices

1. Follow TypeScript types strictly
2. Use React hooks for state management
3. Test thoroughly before deploying
4. Keep environment variables secure

### Additional Resources

- [Gnosis Conditional Tokens Documentation](https://docs.gnosis.io/conditionaltokens/)
- [The Graph Documentation](https://thegraph.com/docs/)
- [Reality.eth Documentation](https://reality.eth.link/)

### Contributing

1. Fork the repository
2. Create feature branch
3. Submit pull request
4. Follow code style guidelines

### Support

- GitHub Issues
- Developer Discord
- Documentation Wiki


# Conditional Tokens Explorer and Factory Developer Guide

## Overview
The Conditional Tokens Explorer and Factory (CTEF) is a decentralized application built on Ethereum that enables users to interact with Gnosis Conditional Tokens. It provides a user interface for creating, managing, and trading conditional tokens - ERC1155 tokens that represent positions in prediction markets or other outcome-dependent scenarios.

## Core Concepts

### Conditional Tokens
- ERC1155 tokens that represent positions in outcome-dependent scenarios
- Can be split, merged, and traded based on different conditions
- Used primarily in prediction markets and conditional outcome scenarios

### Key Components
1. **Conditions**: Represent questions or scenarios with multiple possible outcomes
2. **Positions**: Represent holdings in specific outcomes of conditions
3. **Oracle**: External source that reports the actual outcome (e.g., Reality.eth)
4. **Collateral**: The underlying token used to create positions (e.g., DAI, USDC)

## Technical Architecture

### Frontend
- React with TypeScript
- Web3 integration for blockchain interaction
- Apollo Client for GraphQL queries
- Styled Components for styling

### Backend/Blockchain
- Smart Contracts (Solidity)
- The Graph for indexing blockchain data
- IPFS for decentralized storage
- Reality.eth for oracle services

### Infrastructure
- Docker for containerization
- Ganache for local blockchain
- PostgreSQL for The Graph Node
- IPFS node for decentralized storage

## Development Setup

### Prerequisites
- Docker and Docker Compose
- Node.js (v14.x recommended)
- Git

### Local Development Environment

1. Clone the repository and install dependencies:
