# N|Solid Settings
ARG NODE_VERSION="iron"
ARG NODE_BASE="latest"
ARG RUNNER_TYPE="nsolid"

FROM nodesource/nsolid:${NODE_VERSION}-${NODE_BASE}

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
ENV RUNTIME_TYPE=nsolid

# N|Solid specific environment variables
ENV NSOLID_APPNAME="express-benchmark"
ENV NSOLID_TAGS="benchmark,performance"

ENTRYPOINT ["./start.sh"]
