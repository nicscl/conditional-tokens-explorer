FROM node:18-alpine

ENV PATH="./node_modules/.bin:${PATH}"

COPY create_subgraph.sh ./
COPY setup-migration.sh ./
COPY create-gnosis-account.sh ./
COPY .env ./

# Install system dependencies
RUN apk --update add \
    bash \
    git \
    python3 \
    make \
    g++ \
    libsecret-dev \
    pkgconfig \
    libc6-compat \
    jq && \
    rm -rf /var/cache/apk/*

# Verify libsecret configuration
RUN pkg-config --libs-only-l libsecret-1

# Install ganache-cli globally
RUN npm install -g ganache-cli

# Make the scripts executable
RUN chmod +x create_subgraph.sh && \
    chmod +x create-gnosis-account.sh && \
    chmod +x setup-migration.sh

# Clone and setup hg-subgraph with all required dependencies
RUN git clone https://github.com/nicscl/hg-subgraph.git && \
    cd hg-subgraph && \
    npm install && \
    npm install @realitio/realitio-contracts@2.1.2 && \
    cd -

CMD ["bash"]