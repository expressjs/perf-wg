# Node Settings
ARG NODE_VERSION="lts"
ARG NODE_BASE="bookworm"
ARG RUNNER_TYPE="vanilla"

FROM node:${NODE_VERSION}-${NODE_BASE}

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      linux-perf=6.1.147-1 \
      jq=1.6-2.1 && \
    rm -rf /var/lib/apt/lists/*

# Setup @mmarchini/observe
RUN <<-EOF
  npm install -g @mmarchini/observe@^3.0.0
  chown -R node:node /usr/local/lib/node_modules
  chown -R node:node /usr/local/bin/observe
EOF

USER node
WORKDIR /home/node

# Setup FlameGraph tools
RUN git clone https://github.com/brendangregg/FlameGraph.git

VOLUME ["/home/node/repo"]
VOLUME ["/home/node/results"]
EXPOSE 3000 9229

# Copy shared utilities directly from runner-shared
COPY runner-shared/metadata-bundle.mjs metadata.mjs
COPY runner-shared/overrides.mjs overrides.mjs
COPY runner-shared/scripts/start.sh start.sh

# Set runtime type for this container
ENV RUNTIME_TYPE=vanilla

ENTRYPOINT ["./start.sh"]
