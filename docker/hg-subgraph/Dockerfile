FROM node:12-alpine

ENV PATH="./node_modules/.bin:${PATH}"

COPY create_subgraph.sh ./

# Install system dependencies
RUN apk --update add \
    bash \
    git \
    python3 \
    make \
    g++ \
    libsecret-dev \
    pkgconfig && \
    rm -rf /var/cache/apk/*

# Verify libsecret configuration
RUN pkg-config --libs-only-l libsecret-1

# Install ganache-cli globally
RUN npm install -g ganache-cli

# Make the script executable
RUN chmod +x create_subgraph.sh

# Clone and setup hg-subgraph
RUN git clone https://github.com/nicscl/hg-subgraph.git && \
    cd hg-subgraph && \
    npm install && cd -

ENTRYPOINT [ "./create_subgraph.sh" ]