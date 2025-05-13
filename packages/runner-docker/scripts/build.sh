#! /bin/bash

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

if [ -z "$(docker images -q ${3} 2> /dev/null)" ]; then
  docker build . --build-arg NODE_VERSION=${1} --build-arg NODE_BASE=${2} --tag ${3}
else
  echo "Using existing container: $3"
fi
