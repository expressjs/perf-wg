import { mock, test, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdtemp, rm, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

mock.module('@pkgjs/nv', {
  defaultExport: async () => [{ version: '22.0.0' }]
});

mock.module('autocannon', {
  defaultExport: {
    printResult: () => 'mock autocannon result'
  }
});

const mockRunnerPath = import.meta.resolve('./fixtures/mock-runner.mjs');
const loadModule = await import('../load.mjs');
const { default: main } = loadModule;

let tmpDir;

afterEach(async () => {
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
});

test('--output writes results to the specified file', async (t) => {
  tmpDir = await mkdtemp(join(tmpdir(), 'expf-test-'));
  const outputFile = join(tmpDir, 'result.json');

  const ac = new AbortController();

  await main({
    output: outputFile,
    test: '@expressjs/perf-load-example',
    runner: mockRunnerPath,
    abortController: ac,
    write: true
  });

  const fileContents = await readFile(outputFile, 'utf-8');
  const parsed = JSON.parse(fileContents);

  assert.ok(parsed.clientResults, 'results should contain clientResults');
  assert.strictEqual(parsed.clientResults.length, 1);
  assert.strictEqual(parsed.clientResults[0].url, 'http://localhost:3000/');
  assert.strictEqual(parsed.clientResults[0]['2xx'], 1000);
});

test('--no-write prints results to console instead of writing to file', async (t) => {
  const logSpy = t.mock.method(console, 'log');

  const ac = new AbortController();

  await main({
    test: '@expressjs/perf-load-example',
    runner: mockRunnerPath,
    abortController: ac,
    write: false
  });

  const logCalls = logSpy.mock.calls.map(call => call.arguments.join(' '));

  assert.ok(
    logCalls.some(call => call.includes('http://localhost:3000/')),
    'console.log should contain the benchmark URL'
  );
  assert.ok(
    logCalls.some(call => call.includes('mock autocannon result')),
    'console.log should contain autocannon results'
  );
  assert.ok(
    !logCalls.some(call => call.includes('written to:')),
    'console.log should NOT contain "written to:" when --no-write is set'
  );
});

// The config path is resolved relative to the root of the repo
const configFile = 'packages/cli/test/fixtures/expf.config.json';

test('--config options are passed to the runner', async (t) => {
  tmpDir = await mkdtemp(join(tmpdir(), 'expf-test-'));
  const outputFile = join(tmpDir, 'result.json');

  const ac = new AbortController();

  // Flags which were not passed on the command line are undefined
  await main({
    config: configFile,
    output: outputFile,
    test: '@expressjs/perf-load-example',
    runner: mockRunnerPath,
    abortController: ac,
    duration: undefined,
    repoRef: undefined,
    parallel: undefined,
    forceRebuild: undefined
  });

  const parsed = JSON.parse(await readFile(outputFile, 'utf-8'));
  assert.deepStrictEqual(parsed.options, {
    duration: 5,
    repoRef: 'config-ref',
    parallel: true,
    forceRebuild: true
  });
});

test('flags take precedence over --config options', async (t) => {
  tmpDir = await mkdtemp(join(tmpdir(), 'expf-test-'));
  const outputFile = join(tmpDir, 'result.json');

  const ac = new AbortController();

  await main({
    config: configFile,
    output: outputFile,
    test: '@expressjs/perf-load-example',
    runner: mockRunnerPath,
    abortController: ac,
    duration: '10',
    repoRef: 'flag-ref',
    parallel: false,
    forceRebuild: false
  });

  const parsed = JSON.parse(await readFile(outputFile, 'utf-8'));
  assert.deepStrictEqual(parsed.options, {
    duration: 10,
    repoRef: 'flag-ref',
    parallel: false,
    forceRebuild: false
  });
});

test('duration defaults to 60 seconds', async (t) => {
  tmpDir = await mkdtemp(join(tmpdir(), 'expf-test-'));
  const outputFile = join(tmpDir, 'result.json');

  const ac = new AbortController();

  await main({
    output: outputFile,
    test: '@expressjs/perf-load-example',
    runner: mockRunnerPath,
    abortController: ac
  });

  const parsed = JSON.parse(await readFile(outputFile, 'utf-8'));
  assert.strictEqual(parsed.options.duration, 60);
});
