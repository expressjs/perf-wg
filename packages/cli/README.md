# Performance Testing CLI

An opinionated CLI for performance testing in the Express project.

*WARNING:* this is a WIP and is subject to change before we finalize the api


Local setup:

```
$ cd ../../ # the root of the perf-wg repo
$ node --run setup
$ node --run test:load
$ node --run test:load:node
$ node --run compare <path to result a> <path to result b>
```

```
$ expf load [flags]

  Run a load test.

  Flags:

    --cwd
    --runner=docker
    --repo=https://github.com/expressjs/perf-wg.git
    --repo-ref=master
    --test=example
```

```
$ expf compare [flags] <resultA> <resultB>

  Compare two test results

  Flags:

    --cwd
```
