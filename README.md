# Performance Working Group

## Charter

### Mission Statement
The Express Performance Working Group establishes a framework for evaluating performance changes in Express, providing consistent measurement criteria, tooling, and guidance to ensure performance-related decisions are made with data and context.

### Core Philosophy
We focus on **evaluation, not prescription**. Rather than dictating how to write fast code, we:
- Define how Express evaluates performance work
- Measure whether changes are meaningful
- Ensure performance PRs are evaluated consistently and in context

### Responsibilities

#### Performance Evaluation Framework
- Establish evaluation criteria (latency, throughput, memory usage)
- Define what constitutes "meaningful" performance changes
- Create standards for testing under various conditions (concurrency, payload size, middleware stack)

#### Tooling & Infrastructure
- Tooling: [see Perf CLI Readme.md](./packages/cli/README.md)
- Provide environments and tools to make measurements possible
- Help contributors run performance tests and interpret results
- Support dependency version overrides for testing performance across different Express versions
- Maintain two categories of tests:
  - Focused unit benchmarks (in package repos)
  - E2E load tests of realistic applications (in express repo)

#### Key Questions We Answer
- Does this proposed change meaningfully improve performance under realistic load?
- By how much? (p95 latency, req/sec, CPU usage)
- Under what conditions?

#### Ecosystem Collaboration
- Work with Node.js core on unlocking performance improvements
- Maintain relationships with monitoring providers through OSS programs
- Support public benchmark maintenance

## Current Initiatives

| Initiative | Champion | Status | Links |
|------------|----------|--------|-------|
| Setup Charter | [@wesleytodd](https://github.com/wesleytodd) | In progress | [#3](https://github.com/expressjs/perf-wg/issues/3) |

## Members

The Performance WG is made up of volunteers, you do not need to be a member to participate, but once you participate
please open a PR to add youself here.

Two teams exist for mentioning the group and managing access:

- @expressjs/perf-wg: everyone participating in the WG has write access to this repo
- @expressjs/perf-wg-captains: the repository captians as per Express project guidelines

### Team Members

- [Wes Todd](https://github.com/wesleytodd) (Captain)
- [Chris de Almeida](https://github.com/ctcpip)
- [Jean Burellier](https://github.com/sheplu)
- [Sebastian Beltran](https://github.com/bjohansebas)
- [Ulises Gascón](https://github.com/ulisesGascon)
- [Murat Kirazkaya](https://github.com/GroophyLifefor)
- [Luke Lucas](https://github.com/O4FDev)

## Meetings

The Performance Working Group meets bi-weekly (see [meeting issues](https://github.com/expressjs/perf-wg/issues?q=is%3Aissue%20state%3Aopen%20label%3Ameeting)). The meeting is open to the public. The agenda and meeting notes
are published in this repository. You can find the calendar entries in the [OpenJS Foundation calendar](https://openjsf.org/collaboration).

## Offline Discussions

The Performance Working Group uses [GitHub issues](https://github.com/expressjs/perf-wg/issues) for offline discussion.
The discussions are open to the public and anyone may participate. Also, the group uses the channel `#express-perf-wg`
in the [OpenJS Foundation Slack](https://openjsf.org/collaboration) for realtime discussions.

## How to Run the Load Tests

### Requirements
- Node.js v22 or higher
- Docker (for containerized runners)

### Quick Start

1. **Install dependencies**
   ```bash
   node --run setup
   ```

2. **Run basic test with vanilla Node.js**
   ```bash
   node --run test:load
   ```

### CLI Usage

#### Basic Commands

```bash
# Run with default vanilla Node.js runner
node --run load -- --test="@expressjs/perf-load-example"

# Run with specific runner
node --run load -- --test="@expressjs/perf-load-example" --runner="@expressjs/perf-runner-nsolid"

# Run with overrides
node --run load -- --test="@expressjs/perf-load-example" --overrides='{"express":"5.0.0"}'

# Run with specific runner and overrides
node --run load -- --test="@expressjs/perf-load-example" --runner="@expressjs/perf-runner-nsolid" --overrides='{"express":"5.0.0"}'


# Compare results
node --run compare -- result-A.json result-B.json
```

#### Runner-Specific Examples

```bash
# Vanilla Node.js (baseline performance)
node --run load -- --test="@expressjs/perf-load-example" --runner="@expressjs/perf-runner-vanilla"

# N|Solid with built-in monitoring
node --run load -- --test="@expressjs/perf-load-example" --runner="@expressjs/perf-runner-nsolid"

# Node.js with Datadog APM (when available)
node --run load -- --test="@expressjs/perf-load-example" --runner="@expressjs/perf-runner-datadog"

# Node.js with New Relic APM (when available)
node --run load -- --test="@expressjs/perf-load-example" --runner="@expressjs/perf-runner-newrelic"
```

### Programmatic Usage

#### Basic Import and Usage

```javascript
// Import specific runner
import vanillaRunner from '@expressjs/perf-runner-vanilla';
import nsolidRunner from '@expressjs/perf-runner-nsolid';

// Run single test
const results = await vanillaRunner({
  test: '@expressjs/perf-load-example',
  overrides: { express: '5.0.0' }
});

console.log(`Requests/sec: ${results.clientResults.requests.mean}`);
```

#### Performance Comparison Script

```javascript
import vanillaRunner from '@expressjs/perf-runner-vanilla';
import nsolidRunner from '@expressjs/perf-runner-nsolid';

async function compareRuntimes() {
  const testConfig = {
    test: '@expressjs/perf-load-example',
    overrides: { express: 'latest' }
  };

  console.log('Running performance comparison...');

  // Run tests in parallel
  const [vanillaResults, nsolidResults] = await Promise.all([
    vanillaRunner(testConfig),
    nsolidRunner(testConfig)
  ]);

  // Compare results
  const vanillaRPS = vanillaResults.clientResults.requests.mean;
  const nsolidRPS = nsolidResults.clientResults.requests.mean;
  const overhead = ((vanillaRPS - nsolidRPS) / vanillaRPS * 100).toFixed(2);

  console.log('Performance Comparison:');
  console.log(`Vanilla Node.js: ${vanillaRPS.toFixed(0)} req/sec`);
  console.log(`N|Solid:        ${nsolidRPS.toFixed(0)} req/sec`);
  console.log(`Overhead:       ${overhead}%`);
}

compareRuntimes().catch(console.error);
```

#### Advanced Configuration

```javascript
import { createRunner } from '@expressjs/perf-runner-shared';

// Create custom runner configuration
const customRunner = createRunner({
  type: 'custom',
  runtime: 'node.js',
  apm: 'custom-monitoring',
  capabilities: ['profiling', 'tracing'],
  env: {
    RUNTIME_TYPE: 'custom',
    CUSTOM_CONFIG: 'enabled'
  }
});

// Use with abort controller for cancellation
const controller = new AbortController();
const results = await customRunner({
  test: '@expressjs/perf-load-example',
  signal: controller.signal
});
```

### Available Runners

| Runner | Description | Use Case | Status |
|--------|-------------|----------|--------|
| `@expressjs/perf-runner-vanilla` | Standard Node.js runtime | Baseline performance measurements | Available |
| `@expressjs/perf-runner-nsolid` | N|Solid runtime with built-in monitoring | Enterprise monitoring capabilities | Available |
| `@expressjs/perf-runner-datadog` | Node.js + Datadog APM agent | Datadog APM overhead analysis | Coming soon |
| `@expressjs/perf-runner-newrelic` | Node.js + New Relic APM agent | New Relic APM overhead analysis | Coming soon |

### Performance Analysis Examples

#### CLI-based Comparison

```bash
# Step 1: Run baseline test
node --run load -- --test="@expressjs/perf-load-example" --runner="@expressjs/perf-runner-vanilla"
# Output: results/vanilla-result-123456789.json

# Step 2: Run N|Solid test  
node --run load -- --test="@expressjs/perf-load-example" --runner="@expressjs/perf-runner-nsolid"
# Output: results/nsolid-result-123456790.json

# Step 3: Compare results
node --run compare -- results/vanilla-result-123456789.json results/nsolid-result-123456790.json
```

#### Programmatic Analysis

```javascript
import fs from 'node:fs/promises';

async function runPerformanceAnalysis() {
  // Test configuration
  const tests = [
    { name: 'Express Hello World', test: '@expressjs/perf-load-example' },
    { name: 'Express with Query', test: '@expressjs/perf-load-extended-query' }
  ];

  const runners = [
    { name: 'Vanilla', runner: vanillaRunner },
    { name: 'N|Solid', runner: nsolidRunner }
  ];

  const results = {};

  // Run all combinations
  for (const test of tests) {
    results[test.name] = {};
    
    for (const { name, runner } of runners) {
      console.log(`Running ${test.name} with ${name}...`);
      
      const result = await runner({ test: test.test });
      results[test.name][name] = {
        requestsPerSec: result.clientResults.requests.mean,
        latencyP95: result.clientResults.latency.p95,
        memoryUsage: result.serverMetadata.memory
      };
    }
  }

  // Save comprehensive report
  await fs.writeFile('performance-report.json', JSON.stringify(results, null, 2));
  console.log('Performance analysis complete. Results saved to performance-report.json');
}

### Runner Development

To create a new runner, extend the shared runner infrastructure:

```javascript
// packages/runner-custom/index.mjs
import { createRunner } from '@expressjs/perf-runner-shared';

export default createRunner({
  type: 'custom',
  runtime: 'node.js',
  apm: 'custom-apm',
  capabilities: ['custom-profiling'],
  env: {
    RUNTIME_TYPE: 'custom',
    CUSTOM_SETTING: 'enabled'
  }
});
```

## Code of Conduct

The [Express Project's CoC](https://github.com/expressjs/.github/blob/master/CODE_OF_CONDUCT.md) applies to this repo.
