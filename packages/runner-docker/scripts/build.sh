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

rollup metadata.mjs --file metadata-bundle.mjs --plugin @rollup/plugin-node-resolve

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
TAG="expf-runner:${NODE_VERSION}-${NODE_BASE}"

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
  docker build . --build-arg NODE_VERSION=${NODE_VERSION} --build-arg NODE_BASE=${NODE_BASE} --tag "$TAG"
  docker tag $TAG "expf-runner:latest"
else
  echo "Using existing container: $TAG"
fi
