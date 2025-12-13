FROM debian:bullseye-slim

WORKDIR /runner

# Install dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        git \
        ca-certificates \
        bash \
    && rm -rf /var/lib/apt/lists/*

# Install NVM (just the tool, no Node yet)
ENV NVM_DIR=/root/.nvm

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Copy all performance runner files
COPY run-tests.mjs .
COPY src/ ./src/

# Default command
CMD ["bash"]
