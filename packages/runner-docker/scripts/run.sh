#! /bin/bash
SOURCE=${BASH_SOURCE[0]:-$0}
while [ -L "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
  DIR=$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )
  SOURCE=$(readlink "$SOURCE")
  [[ $SOURCE != /* ]] && SOURCE=$DIR/$SOURCE # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
done
DIR=$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )

IS_TERM=false
if [ -t 1 ]; then
  IS_TERM=true
fi

CWD=${1:-$(realpath $DIR/../../../)}
REPO=${2:-"https://github.com/expressjs/perf-wg.git"}
REF=${3:-"master"}
TEST=${4:-"@expressjs/perf-servers/node-http"}
TAG=${5:-"perf-runner:latest"}

# Start docker daemon if not running
if (! docker stats --no-stream >/dev/null 2>&1 ); then
  # On Mac OS this would be the terminal command to launch Docker
  open /Applications/Docker.app
 # Wait until Docker daemon is running and has completed initialisation
  while (! docker stats --no-stream ); do
    # Docker takes a few seconds to initialize
    echo "Waiting for Docker to launch..."
    sleep 1
  done
fi

# Clean up results folder
mkdir -p "$CWD/results"
rm "$CWD/results/*" 2> /dev/null || true

# If we are in an interactive terminal, run directly with -it
if [ $IS_TERM == true ]; then
  docker run --rm -it \
    --env "REPO=$REPO" \
    --env "REF=$REF" \
    --env "TEST=$TEST" \
    --volume "$CWD:/home/node/repo" \
    --volume "$CWD/results:/home/node/results" \
    -p 3000:3000 \
    -p 9229:9229 \
    ${TAG}
else
  # If we are not in an interactive terminal, we have
  # to run a more complicated setup
  ID=$(docker run --rm -d \
    --env NO_SPIN=1 \
    --env "REPO=$REPO" \
    --env "REF=$REF" \
    --env "TEST=$TEST" \
    --volume "$CWD:/home/node/repo" \
    --volume "$CWD/results:/home/node/results" \
    -p 3000:3000 \
    -p 9229:9229 \
    ${TAG})

  on_sigint()
  {
    docker kill --signal="SIGINT" "$ID" >/dev/null 2>&1
  }
  trap on_sigint SIGINT
  docker logs --follow "$ID" &
  while true
  do
    if [ "$(docker container inspect -f '{{.State.Running}}' "$ID" 2>/dev/null)" != "true" ]; then
      echo "Container exited (${ID})"
      exit;
    fi
    sleep 1
  done
fi
