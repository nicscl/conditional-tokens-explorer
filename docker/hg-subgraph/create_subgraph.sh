#!/bin/bash

set -e # exit when any command fails

waitport() {
    while ! nc -z $1 $2 ; do sleep 1 ; done
}

ganache-cli -d -i 50 &
PID=$!

cd hg-subgraph/
#sed -i 's/localhost/ganache/g' ops/render-subgraph-conf.js
#sed -i 's/localhost/ganache/g' node_modules/@gnosis.pm/conditional-tokens-contracts/truffle.js

waitport localhost 8545

echo "Run migrate"
# Debug: Show realitio-contracts folder structure
echo "Checking realitio-contracts structure:"
if [ -d "node_modules/@realitio/realitio-contracts" ]; then
    echo "realitio-contracts exists, showing contents:"
    ls -la node_modules/@realitio/realitio-contracts/
else
    echo "realitio-contracts directory not found!"
fi

# Original symlink code commented out for now
# if [ -d "node_modules/@realitio/realitio-contracts/truffle" ]; then
#     echo "Linking realitio package.json to truffle directory"
#     ln -sf ../package.json node_modules/@realitio/realitio-contracts/truffle/
# fi

echo "Debugging realitio-contracts installation:"
echo "----------------------------------------"
echo "1. Checking main package directory:"
ls -la node_modules/@realitio/realitio-contracts/

echo -e "\n2. Checking for truffle directory:"
if [ -d "node_modules/@realitio/realitio-contracts/truffle" ]; then
    echo "✓ Truffle directory exists"
    ls -la node_modules/@realitio/realitio-contracts/truffle/
else
    echo "✗ Truffle directory does not exist"
fi

echo -e "\n3. Checking package.json location:"
if [ -f "node_modules/@realitio/realitio-contracts/package.json" ]; then
    echo "✓ Found package.json in main directory"
else
    echo "✗ No package.json in main directory"
fi

echo -e "\n4. Full path status:"
pwd
echo "----------------------------------------"

echo -e "\n5. Creating symlink for package.json in truffle directory:"
if [ -d "node_modules/@realitio/realitio-contracts/truffle" ]; then
    echo "Creating symlink from parent package.json to truffle directory..."
    ln -sf ../package.json node_modules/@realitio/realitio-contracts/truffle/
    echo "✓ Symlink created"
else
    echo "✗ Cannot create symlink - truffle directory not found"
fi

echo "----------------------------------------"

echo "Searching for files containing port 7545 in realitio directory:"
find node_modules/@realitio -type f -exec grep -l "7545" {} \;

echo "Updating Truffle configuration to use port 8545"
sed -i 's/7545/8545/g' truffle-config.js
sed -i 's/7545/8545/g' node_modules/@realitio/realitio-contracts/truffle/truffle.js

# Add these lines to debug truffle.js configuration
echo "Current truffle.js configuration:"
cat node_modules/@realitio/realitio-contracts/truffle/truffle.js

echo "Contents of truffle-config.js:"
cat truffle-config.js

echo "Contents of realitio truffle.js:"
cat node_modules/@realitio/realitio-contracts/truffle/truffle.js

echo "Contents of realitio truffle-config.js (if exists):"
cat node_modules/@realitio/realitio-contracts/truffle/truffle-config.js 2>/dev/null || echo "File does not exist"

npm run migrate
echo "Run render subgraph"
npm run refresh-abi && npm run render-subgraph-config-local
echo "Setup the right CT address"
sed -i -E "s/(address: '0x[a-zA-Z0-9]+')/address: '0xA57B8a5584442B467b4689F1144D269d096A3daF'/g" subgraph.yaml
echo "Apply codegen"
./node_modules/.bin/graph codegen

waitport graph-node 8000

echo "Creating gnosis/hg at http://graph-node:8020"
./node_modules/.bin/graph create --node http://graph-node:8020 gnosis/hg

echo "Deploying gnosis/hg at local"
./node_modules/.bin/graph deploy --node http://graph-node:8020 --ipfs http://ipfs:5001 gnosis/hg

kill $PID