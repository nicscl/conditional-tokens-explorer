f6a7f6d20cc1:/hg-subgraph# cat truffle-config.js
module.exports = { networks: { local: { host: "ganache", port: 8545, network_id: "50" } }, compilers: { solc: { version: "0.6.9", settings: { optimizer: { enabled: true, runs: 200 } } } } };