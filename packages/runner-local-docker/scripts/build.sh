#! /bin/bash

# Always required to run
if [ -z "$1" ]; then
  echo "Node version is required. (\$1)"
  exit 1;
fi;
if [ -z "$2" ]; then
  echo "Node base os is required. (\$2)"
  exit 1;
fi;
if [ -z "$3" ]; then
  echo "Runner type is required. (\$3)"
  exit 1;
fi;

# cd to the root of the repo
SOURCE=${BASH_SOURCE[0]:-$0}
while [ -L "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
  DIR=$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )
  SOURCE=$(readlink "$SOURCE")
  [[ $SOURCE != /* ]] && SOURCE=$DIR/$SOURCE # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
done
DIR=$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )
cd "${DIR}/../../.."

# Build metadata bundle (from runner-base directory)
pushd ./packages/runner-local-docker
pwd
rollup metadata.mjs --file metadata-bundle.mjs --plugin @rollup/plugin-node-resolve
popd

# Start docker daemon if not running
if (! docker stats --no-stream >/dev/null 2>&1 ); then
  # On Mac OS this would be the terminal command to launch Docker
  open /Applications/Docker.app
 #Wait until Docker daemon is running and has completed initialisation
while (! docker stats --no-stream ); do
  # Docker takes a few seconds to initialize
  echo "Waiting for Docker to launch..."
  sleep 1
done
fi

NODE_VERSION=$1
NODE_BASE=$2
RUNNER_TYPE=$3
TAG="expf-runner-${RUNNER_TYPE}:${NODE_VERSION}-${NODE_BASE}"

# Check if runner directory exists (relative to packages dir)
RUNNER_DIR="packages/runner-${RUNNER_TYPE}"
if [ ! -d "$RUNNER_DIR" ]; then
  echo "Runner directory not found: $RUNNER_DIR"
  exit 1
fi

FORCE=
while test $# -gt 0; do
  case "$1" in
    -f|--force)
      FORCE="true"
      ;;
    *)
      ;;
  esac
  shift
done

if [ -n "$FORCE" ] || [ -z "$(docker images -q $TAG 2> /dev/null)" ]; then
  echo "Building container: $TAG"
  docker build -f "packages/runner-${RUNNER_TYPE}/Dockerfile" . \
    --build-arg NODE_VERSION=${NODE_VERSION} \
    --build-arg OS=${NODE_BASE} \
    --build-arg RUNNER_TYPE=${RUNNER_TYPE} \
    --tag "$TAG"
  docker tag $TAG "expf-runner-${RUNNER_TYPE}:latest"
else
  echo "Using existing container: $TAG"
fi
