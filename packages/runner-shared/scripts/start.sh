#! /bin/bash
set -e

# Always require the server to run
if [ -z "$TEST" ]; then
  echo "\$TEST is required."
  exit 1;
fi;

#
# Write out metadata file
#
node metadata.mjs > ./results/metadata.json

# We can mount the path for local dev,
# If not, require a repo and ref
REPO_DIR="./repo"
if [ -d "$REPO_DIR" ]; then
  echo "Using local benchmarks"
  cd "$REPO_DIR"
else
  if [ -z "$REPO" ]; then
    echo "\$REPO is required."
    exit 1;
  fi;

  if [ -z "$REF" ]; then
    echo "\$REF is required."
    exit 1;
  fi;

  #
  # Benchmark repo setup
  #
  cd $REPO_DIR
  git init
  git remote add origin "$REPO"
  git fetch origin --depth=1 "$REF"
  git fetch checkout "$REF"
fi;


# A little spinner
SPIN=( ⠁ ⠂ ⠄ ⡀ ⢀ ⠠ ⠐ ⠈  )
spinner()
{
  if [ -z "$NO_SPIN" ]; then
    for i in "${SPIN[@]}"
    do
      echo -ne "\b$i"
      sleep 0.1
    done
  else
    echo -ne "."
    sleep 1
  fi
}

# cd into server 
cd $(node -p "require('node:path').dirname(require.resolve(\"$TEST\"))")

# Apply overrides to package.json
if [ -f "package.json.bak" ]; then
  echo "package.json.bak exists, restoring original"
  mv -f package.json.bak package.json
fi
if [ -n "$OVERRIDES" ]; then
  cp package.json package.json.bak
  ( rm -f package.json && node ~/overrides.mjs "${OVERRIDES}" > package.json ) < package.json;
fi

# Run server setup
echo "Running setup..."
node --run setup || npm run setup

#
# Configure runtime-specific settings
#
RUNTIME_TYPE=${RUNTIME_TYPE:-"vanilla"}
NODE_OPTIONS=""
RUNTIME_PREFIX=""

echo "Configuring runtime: $RUNTIME_TYPE"

case "$RUNTIME_TYPE" in
  "datadog")
    echo "Setting up Datadog APM..."
    NODE_OPTIONS="--require dd-trace/init"
    export DD_TRACE_ENABLED=true
    export DD_PROFILING_ENABLED=true
    export DD_SERVICE="express-benchmark"
    export DD_ENV="benchmark"
    ;;
  "newrelic")
    echo "Setting up New Relic APM..."
    NODE_OPTIONS="--require newrelic"
    export NEW_RELIC_APP_NAME="express-benchmark"
    export NEW_RELIC_LICENSE_KEY="${NEW_RELIC_LICENSE_KEY:-dummy}"
    export NEW_RELIC_NO_CONFIG_FILE=true
    ;;
  "dynatrace")
    echo "Setting up Dynatrace APM..."
    NODE_OPTIONS="--require @dynatrace/oneagent"
    ;;
  "nsolid")
    echo "Using N|Solid runtime..."
    # N|Solid uses different CLI and doesn't need --require
    RUNTIME_PREFIX="nsolid"
    ;;
  "vanilla"|*)
    echo "Using vanilla Node.js..."
    # No additional configuration needed
    ;;
esac

#
# Start server
#
PKG=$(cat package.json)
if echo $PKG | jq -er ".exports.server" &> /dev/null; then
  PKG_MAIN=$(echo $PKG | jq -r ".exports.server")
else
  PKG_MAIN=$(echo $PKG | jq -r ".main")
fi
MAIN=${PKG_MAIN:-index.js}

# Choose the runtime executable
RUNTIME_CMD=${RUNTIME_PREFIX:-node}

echo "Starting server with $RUNTIME_CMD (runtime: $RUNTIME_TYPE)"
$RUNTIME_CMD $NODE_OPTIONS \
  --interpreted-frames-native-stack \
  --perf-basic-prof-only-functions \
  --inspect=0.0.0.0:9229 \
  "$MAIN" \
  &> ./results/output.txt &
SERVER_PID=$!

# Start perf
perf record -F 99 -g -o ./results/perf.data -p $SERVER_PID &> ./results/perf.txt &
PERF_PID=$!

on_sigint()
{
  echo
  echo "Capture ending heap snapshot"
  npx -q @mmarchini/observe heap-snapshot -p ${SERVER_PID} --file ./results/end.heapsnapshot

  echo "Closing server"
  kill -2 "$SERVER_PID" || true
  wait "$PERF_PID" || true
  local EX=$?

  echo "Generating flamegraph"
  perf script -i ./results/perf.data | ./FlameGraph/stackcollapse-perf.pl | ./FlameGraph/flamegraph.pl --colors=js > ./results/profile.svg

  EXIT_CODE=${EX:-0}
}
trap on_sigint SIGINT

echo "Starting server (server ${SERVER_PID}, perf ${PERF_PID})"
while true; do
  # Server process exited
  if ! [ -d "/proc/${SERVER_PID}" ]; then
    echo "Exited prematurely (pid ${SERVER_PID}, code ${EXIT_CODE-unknown})"
    wait $SERVER_PID || true
    cat ./results/output.txt
    EXIT_CODE=1
    break
  fi
  if grep -q "startup: " <(head ./results/output.txt); then
    echo "Capture starting heap snapshot"
    npx -q @mmarchini/observe heap-snapshot -p ${SERVER_PID} --file ./results/start.heapsnapshot
    break
  fi
done

echo -ne "Running..."
while true; do
  if [ -n "$EXIT_CODE" ]; then

    if [ -f "package.json.bak" ]; then
      echo "restoring original package.json"
      mv -f package.json.bak package.json
    fi

    echo "moving package-lock.json to results"
    mv package-lock.json ./results/package-lock.json

    echo "Exiting (${EXIT_CODE})"
    exit "${EXIT_CODE-0}"
  fi
  spinner
done
