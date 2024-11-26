cat > node_modules/@realitio/realitio-contracts/truffle/truffle-config.js << 'EOL'
module.exports = {
  networks: {
    development: {
      host: 'ganache',
      port: 8545,
      network_id: 50,
    },
    local: {
      host: 'ganache',
      port: 8545,
      network_id: 50,
    },
  },
  compilers: {
    solc: {
      version: '0.4.25', // Default compiler version
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
      overrides: {
        // Use Solidity 0.5.12 for realitio-gnosis-proxy contracts
        'node_modules/realitio-gnosis-proxy/contracts/**/*.sol': {
          version: '0.5.12',
          settings: {},
        },
        // Use Solidity 0.4.25 for @realitio/realitio-contracts
        'node_modules/@realitio/realitio-contracts/**/*.sol': {
          version: '0.4.25',
          settings: {},
        },
        // Use Solidity 0.4.25 for @realitio/realitio-contracts
        'node_modules/@realitio/realitio-contracts/*.sol': {
          version: '0.4.25',
          settings: {},
        },
      },
    },
  },
};
EOL