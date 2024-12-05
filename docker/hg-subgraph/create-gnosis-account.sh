#!/bin/bash

# Navigate to the subgraph directory
cd hg-subgraph

# Install Web3
npm install web3

# Create a new account using Web3
echo "Creating new account for Gnosis Chain..."
cat > create-account.js << 'EOL'
const Web3 = require('web3');
const web3 = new Web3('https://dimensional-twilight-feather.xdai.quiknode.pro/a791b8561d89ae46154ef37cee61445c7b22f13a/');

async function createAccount() {
    try {
        const account = web3.eth.accounts.create();
        const chainId = await web3.eth.getChainId();
        
        const result = {
            chainId: chainId,
            networkName: chainId === 100 ? 'Gnosis Chain' : 'Unknown Network',
            address: account.address,
            privateKey: account.privateKey
        };
        
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

createAccount();
EOL

# Execute the script and store full output
FULL_OUTPUT=$(node create-account.js)
if [ $? -ne 0 ]; then
    echo "Failed to create account"
    exit 1
fi

# Parse the JSON output using temporary files to handle potential parsing issues
echo "$FULL_OUTPUT" > temp_account.json

if ! jq empty temp_account.json 2>/dev/null; then
    echo "Error: Invalid JSON output"
    cat temp_account.json
    rm temp_account.json
    exit 1
fi

CHAIN_ID=$(jq -r '.chainId' temp_account.json)
NETWORK_NAME=$(jq -r '.networkName' temp_account.json)
ACCOUNT_ADDRESS=$(jq -r '.address' temp_account.json)
PRIVATE_KEY=$(jq -r '.privateKey' temp_account.json)

# Clean up temporary file
rm temp_account.json

# Display the results
echo "Network Information:"
echo "Chain ID: $CHAIN_ID"
echo "Network: $NETWORK_NAME"
echo "Created new account:"
echo "Address: $ACCOUNT_ADDRESS"
echo "Private key: $PRIVATE_KEY"

# Save credentials to a file for later use
echo "{\"address\":\"$ACCOUNT_ADDRESS\",\"privateKey\":\"$PRIVATE_KEY\"}" > gnosis-credentials.json

# Verify we're on Gnosis Chain
if [ -z "$CHAIN_ID" ] || [ "$CHAIN_ID" != "100" ]; then
    echo "Error: Not connected to Gnosis Chain (Chain ID 100)"
    exit 1
fi

echo "Successfully created account on Gnosis Chain"
echo "IMPORTANT: Please fund this address with xDAI before proceeding with migration"
echo "You can get xDAI from the Gnosis Chain faucet"
echo "Once funded, run setup-migration.sh to continue the deployment process" 