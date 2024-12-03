#!/bin/bash

# Navigate to the subgraph directory
cd hg-subgraph

echo "Installing dependencies..."
npm install
npm install solc@0.6.0

# Store all found truffle-config.js locations
FOUND_CONFIGS=$(find . -name "truffle-config.js")
echo "Found the following truffle-config.js files:"
echo "$FOUND_CONFIGS"

# Create our reference truffle-config.js
cat > reference-truffle-config.js << 'EOL'
module.exports = {
  networks: {
    local: {
      host: 'ganache',
      port: 8545,
      network_id: 50,
    },
  },
  compilers: {
    solc: {
      version: '^0.6.0',
    },
  },
  plugins: ['truffle-plugin-networks'],
};
EOL

# Copy our reference config to all found locations
echo "Copying reference config to all locations..."
echo "$FOUND_CONFIGS" | while read -r config_path; do
    if [ -n "$config_path" ]; then
        echo "Updating $config_path"
        cp reference-truffle-config.js "$config_path"
    fi
done

# Clean up the reference file
rm reference-truffle-config.js

# Update the migrate script in package.json to include --network=local for realitio contracts
sed -i 's/realitio-contracts\/truffle -- truffle migrate/realitio-contracts\/truffle -- truffle migrate --network=local/g' package.json

# Update the truffle-config.js in @gnosis.pm/conditional-tokens-contracts to use ^0.5.0
echo "Updating truffle-config.js in @gnosis.pm/conditional-tokens-contracts to use ^0.5.0"
sed -i "s/version: '\^0.6.0'/version: '\^0.5.0'/g" node_modules/@gnosis.pm/conditional-tokens-contracts/truffle-config.js

# Update the truffle-config.js in realitio-gnosis-proxy to use ^0.5.12
echo "Updating truffle-config.js in realitio-gnosis-proxy to use ^0.5.12"
sed -i "s/version: '\^0.6.0'/version: '\^0.5.12'/g" node_modules/realitio-gnosis-proxy/truffle-config.js

# Create truffle directory if it doesn't exist and copy package.json
echo "Setting up realitio-contracts truffle directory..."
mkdir -p node_modules/@realitio/realitio-contracts/truffle
cp node_modules/@realitio/realitio-contracts/package.json node_modules/@realitio/realitio-contracts/truffle/

# Create truffle-config.js for @realitio/realitio-contracts/truffle
echo "Creating truffle-config.js for @realitio/realitio-contracts/truffle..."
cat > node_modules/@realitio/realitio-contracts/truffle/truffle-config.js << 'EOL'
module.exports = {
  networks: {
    local: {
      host: 'ganache',
      port: 8545,
      network_id: 50,
    },
  },
  compilers: {
    solc: {
      version: '^0.4.24',
    },
  },
  plugins: ['truffle-plugin-networks'],
};
EOL

# Update the root truffle-config.js to use ^0.5.12
echo "Updating root truffle-config.js to use ^0.5.12"
sed -i "s/version: '\^0.6.0'/version: '\^0.5.12'/g" truffle-config.js

echo "Configuration update complete!"

# Run the migration
echo "Starting migration..."
npm run migrate

# Update Web3 provider to use ganache instead of localhost
echo "Updating Web3 provider to use ganache..."
sed -i 's|http://localhost:8545|http://ganache:8545|g' ops/render-subgraph-conf.js

# Refresh ABI and render subgraph config
echo "Refreshing ABI and rendering subgraph config..."
npm run refresh-abi && npm run render-subgraph-config-local


# Set up the correct Conditional Tokens address
sed -i -E "s/(address: '0x[a-zA-Z0-9]+')/address: '0xA57B8a5584442B467b4689F1144D269d096A3daF'/g" subgraph.yaml

# Run codegen first
echo "Running codegen..."
./node_modules/.bin/graph codegen

# Fix the type issue in conditions.ts AFTER build
echo "Fixing type casting in conditions.ts..."
sed -i 's/Category\.load(question\.category)/Category.load(question.category as string)/g' src/conditions.ts

# Build
echo "Building..."
npm run build

# Update graph node and IPFS endpoints in package.json
echo "Updating endpoints in package.json..."
sed -i 's/localhost:8020/graph-node:8020/g' package.json
sed -i 's/localhost:5021/ipfs:5021/g' package.json
sed -i 's/localhost:5001/ipfs:5001/g' package.json

# Change all network references from mainnet to xdai
sed -i 's/network: development/network: xdai/g' subgraph.yaml

# Update the deploy-local script in package.json to include --version-label 0.0.1
echo "Updating deploy-local --version-label to 0.0.1"
sed -i 's/"deploy-local": "graph deploy --node http:\/\/graph-node:8020 --ipfs http:\/\/ipfs:5001 gnosis\/conditional-tokens-gc"/"deploy-local": "graph deploy --node http:\/\/graph-node:8020 --ipfs http:\/\/ipfs:5001 gnosis\/conditional-tokens-gc   --version-label 0.0.1"/g' package.json

# Deploy
echo "Creating Local..."
npm run create-local
echo "Deploying Local..."
npm run deploy-local