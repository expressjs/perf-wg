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
node metadata.mjs > /home/node/results/metadata.json

# We can mount the path for local dev,
# If not, require a repo and ref
REPO_DIR=/home/node/repo
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

# Run server setup
echo "Running setup..."
node --run setup || npm run setup

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
node \
  --interpreted-frames-native-stack \
  --perf-basic-prof-only-functions \
  --inspect=0.0.0.0:9229 \
  "$MAIN" \
  &> /home/node/results/output.txt &
SERVER_PID=$!

# Start perf
perf record -F 99 -g -o /home/node/results/perf.data -p $SERVER_PID &> /home/node/results/perf.txt &
PERF_PID=$!

on_sigint()
{
  echo
  echo "Capture ending heap snapshot"
  npx -q @mmarchini/observe heap-snapshot -p ${SERVER_PID} --file /home/node/results/end.heapsnapshot

  echo "Closing server"
  kill -2 "$SERVER_PID" || true
  wait "$PERF_PID" || true
  local EX=$?

  echo "Generating flamegraph"
  perf script -i /home/node/results/perf.data | /home/node/FlameGraph/stackcollapse-perf.pl | /home/node/FlameGraph/flamegraph.pl --colors=js > /home/node/results/profile.svg

  EXIT_CODE=${EX:-0}
}
trap on_sigint SIGINT

echo "Starting server (server ${SERVER_PID}, perf ${PERF_PID})"
while true; do
  # Server process ehelloworldxited
  if ! [ -d "/proc/${SERVER_PID}" ]; then
    echo "Exited prematurely (pid ${SERVER_PID}, code ${EXIT_CODE-unknown})"
    wait $SERVER_PID || true
    cat /home/node/results/output.txt
    EXIT_CODE=1
    break
  fi
  if grep -q "startup: " <(head /home/node/results/output.txt); then
    echo "Capture starting heap snapshot"
    npx -q @mmarchini/observe heap-snapshot -p ${SERVER_PID} --file /home/node/results/start.heapsnapshot
    break
  fi
done

echo -ne "Running..."
while true; do
  if [ -n "$EXIT_CODE" ]; then
    echo "Exiting (${EXIT_CODE})"
    exit "${EXIT_CODE-0}"
  fi
  spinner
done
