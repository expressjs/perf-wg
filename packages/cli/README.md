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
    --node=lts_latest
    --overrides='{"express":"5.0.0"}'  # Override dependency versions for testing
    --flamegraph                     # Include a CPU flamegraph (local runner)
```

```
$ expf compare [flags] <resultA> <resultB>

  Compare two test results

  Flags:

    --cwd
```

## Examples

### CPU Flamegraphs

```bash
npm run load -- --node="$(node -p 'process.versions.node')" --flamegraph --output=results/profiled.json
```

This uses `@platformatic/flame` to profile the server and automatically writes
`results/profiled.json` and `results/profiled.flamegraph.html`. Open the HTML file
directly in a browser. The JSON also keeps the HTML in `serverResults.flamegraph`
for the comparison dashboard. Use `--write` without `--output` to save both files in
the test package's `results` directory. The repository disables writing by default.
`--no-write` skips both unless `--output` is provided.
Requires the local runner, Node.js >=22.6.0, Linux or macOS, and optional dependencies
installed. Profiling is disabled by default because it adds overhead.
See [CPU flamegraphs](../../README.md#cpu-flamegraphs) for viewing reports.

### Testing with Different Express Versions

You can use the `--overrides` flag to test performance with different versions of Express or other dependencies:

```bash
# Test with Express 5.0.0
npm run load -- --test="@expressjs/perf-load-example" --overrides='{"express":"5.0.0"}'

# Test with Express 4.x latest
npm run load -- --test="@expressjs/perf-load-simple-query" --overrides='{"express":"^4"}'

# Override multiple dependencies
npm run load -- --test="@expressjs/perf-load-extended-query" --overrides='{"express":"5.0.0","qs":"^6.13.0"}'
```

## Version Comparison Testing

The Performance WG tools support testing across different dependency versions to evaluate performance impacts of upgrades. This is particularly useful for:

- Evaluating performance changes between Express major versions (e.g., v4 vs v5)
- Testing performance impact of dependency updates
- Validating that security patches don't introduce performance regressions

The `--overrides` flag accepts a JSON object where keys are package names and values are version specifiers (following npm's semver syntax). The system will:
1. Apply the overrides to both direct dependencies and nested dependencies
2. Generate a new package-lock.json for reproducibility
3. Include the lock file in the test results for full transparency

## Running Tests

The CLI has a unit test suite using Node's built-in `node:test` runner. Run from the CLI package directory:

```bash
cd packages/cli
npm test
```

Or from the project root via workspaces:

```bash
npm test --workspace=@expressjs/perf-cli
```

Tests cover CLI command behavior using mocked runners and dependencies — no real servers or network calls are needed.
