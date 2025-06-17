# Performance Testing CLI

An opinionated CLI for performance testing in the Express project.

*WARNING:* this is a WIP and is subject to change before we finalize the api


Local setup:

```
$ cd ../../ # the root of the perf-wg repo
$ node --run setup
$ node --run test:load
```


```
$ expf load \
  --cwd=.

  # The runner is what starts the server and request processes
  # collects all the information and reports it back to the cli
  --runner=docker \

  # The git repo url to checkout as a source for all the things
  # In the local setup this is mounted from the local filesystem
  --repo=https://github.com/expressjs/perf-wg.git
  --repo-ref=master

  # The test to run. Can be a path relative to the repo or
  # a package name from within the repo which can be imported
  --test=@expressjs/perf-load-example
```
