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

echo "Configuration update complete!"