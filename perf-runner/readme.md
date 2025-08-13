# Performance Runner Proposal

> **Proposal Status**: Under Review  
> **Working Group**: OpenJS Express Performance Testing Working Group  

## Overview

This proposal outlines a standardized approach to performance testing for JavaScript packages using containerized test runners. The perf-runner tool aims to provide consistent, reproducible performance testing across different Node.js versions and environments.

## Motivation

Performance testing in JavaScript ecosystems often lacks standardization, making it difficult to compare results across different projects, environments, and Node.js versions. This proposal introduces a Docker-based solution that addresses these challenges by providing:

- Consistent testing environments
- Multi-version Node.js support
- Automated CI/CD integration
- Standardized reporting formats

## Build

```
docker build -t <docker-hub-username>/perf-runner:latest -f /Dockerfile perf-runner
```

## Publish

```
docker push <docker-hub-username>/perf-runner:latest
```

## Proposed Usage

### Steps

1. Setup CI workflow to run the Docker image
2. Write first performance test
3. Write a template and use it in performance test

#### Setup CI Workflow

- You should put a valid PAT (Personal Access Token) in your repository secrets as `COMMENTTOKEN` to allow the bot(or a real account) to comment on PRs.

<kbd>expf-testing.yml</kbd>

```yaml
name: Performance Test

on:
  pull_request:
    branches:
      - master # or your main branch
  push:
    branches:
      - master # or your main branch

jobs:
  perf-test:
    runs-on: ubuntu-latest

    strategy:
      fail-fast: false
      matrix:
        node-version: [18, 19, 20, 21, 22, 23, 24] # Add or remove Node.js versions as needed

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}

      - name: Build
        run: npm install

      - name: Pull perf-runner image
        run: docker pull <docker-hub-username>/perf-runner:latest

      - name: Run perf-runner tests on Node.js ${{ matrix.node-version }}
        env:
          NODE_VERSION: ${{ matrix.node-version }}
          PACKAGE_NAME: body-parser           # Replace with your (NPM) package name
          TEST_DIR: 'expf-tests'              # Replace with your test directory name (expf-tests recommended as a standard)
          REPOSITORY_OWNER: ${{ github.repository_owner }}
          REPOSITORY: ${{ github.event.repository.name }}
          PR_ID: ${{ github.event.pull_request.number || '' }}
          COMMENTTOKEN: ${{ secrets.COMMENTTOKEN }}
        run: |
          docker run --rm \
            -v ${{ github.workspace }}:/app \
            -e NODE_VERSION=$NODE_VERSION \
            -e PACKAGE_NAME=$PACKAGE_NAME \
            -e TEST_DIR=$TEST_DIR \
            -e PR_ID=$PR_ID \
            -e COMMENTTOKEN=$COMMENTTOKEN \
            -e REPOSITORY_OWNER=$REPOSITORY_OWNER \
            -e REPOSITORY=$REPOSITORY \
            muratkirazkaya/perf-runner:latest \
            bash -c "source /root/.nvm/nvm.sh && \
                    nvm install $NODE_VERSION && \
                    nvm use $NODE_VERSION && \
                    npm install -g autocannon && \
                    node run-tests.mjs"
```

- Replace `<docker-hub-username>` with your Docker Hub username.
- main branch is `master` in this example, you can change it to your main branch name.
- `PACKAGE_NAME` is the name of the package you want to test.
- `TEST_DIR` is the directory where your performance tests are located. It is recommended to use `expf-tests` as a standard directory name.

### Write First Performance Test

- Create a new folder in the `expf-tests` directory. 
- - Each **folder** in `expf-tests` means it's a performance test.
- - And each **file** in `expf-tests` means it's a template for that performance test.
- Each test should have a package.json to seperate test dependencies.

- Create a `package.json` file in the new folder with the following content:

<kbd>/expf-tests/test-sample/package.json</kbd>
```json
{
  "name": "perf-test-lib---test-sample",
  "version": "1.0.0",
  "main": "run-test.mjs",
  "type": "module",
  "dependencies": {
    "autocannon": "^8.0.0",
    "express": "^5.1.0"
  }
}
```

<kbd>/expf-tests/test-sample/run-test.mjs</kbd>
```javascript
import autocannon from "autocannon";
import { argv } from 'process';

const label = argv[2];

async function run() {
  console.log(`Running performance test with label: ${label}`);

  // Start server
  const test = await import('./start-server.mjs');
  const {
    server,
    url
  } = await test.default(label);

  try {
    const result = await autocannon({
      url,
      connections: 10,
      duration: 5,
    });

    console.log(autocannon.printResult(result));
    console.log('Raw Data');
    console.log('---start:expf-autocanon-data---');
    console.log(JSON.stringify(result, null, 2));
    console.log('---end:expf-autocanon-data---');

  } catch (err) {
    console.error("Autocannon error:", err);
  } finally {
    server.close();
  }
}

run();
```

- But as you can see, this way not looking good, we can improve it with a template.

### Write a Template and Use It in Performance Test

- Create a `template.mjs` file in the `expf-tests` directory:
- I'll use autocannon as an example template, you can change it to your own test library.

<kbd>/expf-tests/autocannon.mjs</kbd>
```javascript
import autocannon from 'autocannon';
import { argv } from 'process';
import { pathToFileURL } from 'url';

class PerfTestTemplate {
  constructor(label, config) {
    this.label = label;
    this.server = null;
    this.config = config;
    this.url = `http://localhost:${config.port}`;
    this.lib = null;

    console.log(`Running performance test with label: ${label}`);
  }

  async loadLib() {
    if (this.label === 'candidate') {
      this.lib = await import(pathToFileURL('/app/index.js').href);
    } else if (this.label === 'latest') {
      this.lib = await import('perf-test-lib');
    } else {
      throw new Error(`Unknown label: ${this.label}`);
    }
  }

  async startServer(serverFactory) {
    await this.loadLib();
    this.server = serverFactory(this.lib);
    await new Promise((resolve) => this.server.listen(this.config.port, resolve));
    console.log(`Server is running at ${this.url}`);
  }

  async run() {
    try {
      const result = await autocannon({
        url: this.url,
        connections: 10,
        duration: 5,
      });

      console.log(autocannon.printResult(result));
      return result;
    } catch (err) {
      console.error('Autocannon error:', err);
    }
  }

  async report(result) {
    console.log('Raw Data');
    console.log('---start:expf-autocanon-data---');
    console.log(JSON.stringify(result, null, 2));
    console.log('---end:expf-autocanon-data---');
  }

  async stop() {
    if (this.server) {
      this.server.close(() => {
        console.log('Server closed');
      });
    } else {
      console.warn('No server to close');
    }
  }

  static async runTest(serverFactory, config = { port: 3000 }) {
    const label = argv[2];
    const test = new PerfTestTemplate(label, config);

    try {
      await test.startServer(serverFactory);
      const data = await test.run();
      await test.report(data);
      await test.stop();
    } catch (error) {
      console.error('Test execution error:', error);
      await test.stop();
      process.exit(1);
    }
  }
}

export { PerfTestTemplate };
```

Then
<kbd>/expf-tests/test-sample/run-test.mjs</kbd>
```javascript
import { PerfTestTemplate } from './templates/autocannon.mjs';

function createSimpleServer(lib) {
  return lib.http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello, world!\n');
  });
}

PerfTestTemplate.runTest(createSimpleServer);
```

- Now you can use the `PerfTestTemplate` class to create your performance tests easily.

