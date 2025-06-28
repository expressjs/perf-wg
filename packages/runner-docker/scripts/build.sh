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

docker build . --tag perf-runner:latest
