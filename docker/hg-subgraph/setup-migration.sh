#!/bin/bash

# Navigate to the subgraph directory
cd hg-subgraph

# Check for credentials file
if [ ! -f "gnosis-credentials.json" ]; then
    echo "Error: gnosis-credentials.json not found!"
    echo "Please run create-gnosis-account.sh first and fund the account with xDAI"
    exit 1
fi

# Load credentials
ACCOUNT_INFO=$(cat gnosis-credentials.json)
ACCOUNT_ADDRESS=$(echo $ACCOUNT_INFO | jq -r '.address')
PRIVATE_KEY=$(echo $ACCOUNT_INFO | jq -r '.privateKey')

echo "Using account: $ACCOUNT_ADDRESS"

# Install other dependencies
echo "Installing dependencies..."
npm install
npm install solc@0.6.0
npm install @truffle/hdwallet-provider

# Store all found truffle-config.js locations
FOUND_CONFIGS=$(find . -name "truffle-config.js")
echo "Found the following truffle-config.js files:"
echo "$FOUND_CONFIGS"

# Create our reference truffle-config.js with the new account
cat > reference-truffle-config.js << EOL
const HDWalletProvider = require('@truffle/hdwallet-provider');
const privateKey = '${PRIVATE_KEY#0x}';

module.exports = {
  networks: {
    local: {
      provider: () => new HDWalletProvider(
        privateKey,
        "https://dimensional-twilight-feather.xdai.quiknode.pro/a791b8561d89ae46154ef37cee61445c7b22f13a/"
      ),
      network_id: 100,
      gas: 12000000,
      gasPrice: 3000000000,
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
cat > node_modules/@realitio/realitio-contracts/truffle/truffle-config.js << EOL
const HDWalletProvider = require('@truffle/hdwallet-provider');
const privateKey = '${PRIVATE_KEY#0x}';

module.exports = {
  networks: {
    local: {
      provider: () => new HDWalletProvider(
        privateKey,
        "https://dimensional-twilight-feather.xdai.quiknode.pro/a791b8561d89ae46154ef37cee61445c7b22f13a/"
      ),
      network_id: 100,
      gas: 12000000,
      gasPrice: 3000000000,
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
if ! npm run migrate; then
    echo "Migration failed!"
    exit 1
fi

# Check if build/contracts directory exists
if [ ! -d "build/contracts" ]; then
    echo "build/contracts directory not found after migration!"
    exit 1
fi

# Update Web3 provider to use the QuickNode endpoint
echo "Updating Web3 provider to use the QuickNode RPC..."
sed -i 's|http://localhost:8545|https://dimensional-twilight-feather.xdai.quiknode.pro/a791b8561d89ae46154ef37cee61445c7b22f13a/|g' ops/render-subgraph-conf.js

# Refresh ABI and render subgraph config
echo "Refreshing ABI and rendering subgraph config..."
if ! npm run refresh-abi; then
    echo "Failed to refresh ABI!"
    exit 1
fi
if ! npm run render-subgraph-config-local; then
    echo "Failed to render subgraph config!"
    exit 1
fi

# Check if subgraph.yaml exists
if [ ! -f "subgraph.yaml" ]; then
    echo "subgraph.yaml not found after configuration!"
    exit 1
fi

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

# Update package.json to add new gnosis/hg deployment scripts
echo "Adding gnosis/hg deployment scripts to package.json..."
sed -i '/\"deploy-local\": /i \    \"create-gnosisHG\": \"graph create --node http:\/\/graph-node:8020 gnosis\/hg\",' package.json
sed -i '/\"deploy-local\": /i \    \"deploy-gnosisHG\": \"graph deploy --node http:\/\/graph-node:8020 --ipfs http:\/\/ipfs:5001 gnosis\/hg --version-label 0.0.1\",' package.json

# Replace the final deployment section
# Instead of using create-local and deploy-local, use the new gnosis/hg commands
echo "Creating Gnosis HG..."
npm run create-gnosisHG
echo "Deploying Gnosis HG..."
npm run deploy-gnosisHG