# Node Settings
ARG NODE_VERSION="lts"
ARG OS="bookworm"
ARG RUNNER_TYPE="vanilla"

FROM node:${NODE_VERSION}-${OS}

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      linux-perf \
      jq && \
    rm -rf /var/lib/apt/lists/*

COPY .npmrc /root/.npmrc

# Pointing at a local registry proxy
RUN sed -i 's/127.0.0.1/host.docker.internal/' /root/.npmrc

# Setup @mmarchini/observe
RUN <<-EOF
  npm install -g @mmarchini/observe@^3.0.0
  chown -R node:node /usr/local/lib/node_modules
  chown -R node:node /usr/local/bin/observe
EOF

USER node
WORKDIR /home/node

COPY .npmrc /home/node/.npmrc

# Setup FlameGraph tools
RUN git clone https://github.com/brendangregg/FlameGraph.git

VOLUME ["/home/node/repo"]
VOLUME ["/home/node/results"]
EXPOSE 3000 9229

# Copy utilities directly from runner-base
COPY packages/runner-local-docker/metadata-bundle.mjs metadata.mjs
COPY packages/runner-local-docker/overrides.mjs overrides.mjs
COPY packages/runner-local-docker/scripts/start.sh start.sh

# Set runtime type for this container
ENV RUNTIME_TYPE=vanilla

ENTRYPOINT ["./start.sh"]
