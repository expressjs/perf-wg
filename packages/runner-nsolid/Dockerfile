# N|Solid Settings
ARG NODE_VERSION="jod"
ARG OS="latest"
ARG RUNNER_TYPE="nsolid"

FROM nodesource/nsolid:${NODE_VERSION}-${OS}

# Switch to root to install packages
USER root

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      linux-perf \
      jq \
      git && \
    rm -rf /var/lib/apt/lists/*

# Create perf symlink if it doesn't exist
RUN if [ ! -f /usr/bin/perf ] && [ -f /usr/bin/perf_5.10 ]; then \
      ln -s /usr/bin/perf_5.10 /usr/bin/perf; \
    fi

USER node
WORKDIR /home/node

COPY .npmrc /home/node/.npmrc

# Setup @mmarchini/observe
RUN <<-EOF
  npm install -g @mmarchini/observe@^3.0.0
  chown -R node:node /usr/local/lib/node_modules
  chown -R node:node /usr/local/bin/observe
EOF

# Setup FlameGraph tools
RUN git clone https://github.com/brendangregg/FlameGraph.git

VOLUME ["/home/node/repo"]
VOLUME ["/home/node/results"]
EXPOSE 3000 9229 1337

# Copy utilities directly from runner-base
COPY packages/runner-local-docker/metadata-bundle.mjs metadata.mjs
COPY packages/runner-local-docker/overrides.mjs overrides.mjs
COPY packages/runner-local-docker/scripts/start.sh start.sh

# Set runtime type for this container
ENV RUNTIME_TYPE=nsolid

ENTRYPOINT ["./start.sh"]
