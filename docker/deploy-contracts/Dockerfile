FROM node:10-buster

WORKDIR ganache

ENV PATH="./node_modules/.bin:${PATH}"

COPY prepare_db.sh ERC20.bin ./

# Install system dependencies
RUN apt-get update && apt-get install -y jq && \
    rm -rf /var/lib/apt/lists/*

# Install eth-cli
RUN npm install eth-cli@2.0.1

# Clone and setup realitio
RUN git clone https://github.com/realitio/realitio-contracts.git realitio && \
    cd realitio && \
    git checkout ada36fd5031e863526a1d580cc6638937b3500fb && \
    npm install && cd ..

# Clone and setup conditional-tokens-contracts
RUN git config --global http.lowSpeedLimit 1000 && \
    git config --global http.lowSpeedTime 2147483647 && \
    git config --global http.postBuffer 2147483647 && \
    git config --global core.compression 0 && \
    git config --global http.timeout 2147483647 && \
    git clone https://github.com/gnosis/conditional-tokens-contracts.git && \
    cd conditional-tokens-contracts && \
    # git checkout 7ad77eb4cba295b12de4d9f5977d641eeb2044ae && \
    npm config set fetch-timeout 2147483647 && \
    npm config set fetch-retries 5 && \
    npm config set network-timeout 2147483647 && \
    npm install --fetch-timeout=2147483647 && cd ..

# Clone and setup realitio-gnosis-proxy
RUN git clone https://github.com/fvictorio/realitio-gnosis-proxy && \
    cd realitio-gnosis-proxy && \
    git checkout 040dce3e9c0c8edbb36767e7b029bbe6ccf1af4a && \
    yarn && cd ..

# Clone and setup 1155-to-20
RUN git clone https://github.com/nicscl/1155-to-20 && \
    cd 1155-to-20 && \
    # git checkout 5989e00be9ba9bb135c6cb49a3674db2a9fb43b1 && \
    yarn install --ignore-engines && cd ..

# Make script executable
RUN chmod +x prepare_db.sh

ENTRYPOINT [ "/bin/sh" ]