import { mock, test, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdtemp, mkdir, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
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

test('--config accepts an absolute path', async (t) => {
  tmpDir = await mkdtemp(join(tmpdir(), 'expf-test-'));
  const configFile = join(tmpDir, 'expf.config.json');
  const outputFile = join(tmpDir, 'result.json');
  await writeFile(configFile, JSON.stringify({ output: outputFile }));

  const ac = new AbortController();

  await main({
    config: configFile,
    test: '@expressjs/perf-load-example',
    runner: mockRunnerPath,
    abortController: ac
  });

  const parsed = JSON.parse(await readFile(outputFile, 'utf-8'));
  assert.ok(parsed.clientResults, 'results should be written to the output from the config file');
});

test('default results directory is next to the test when its path contains spaces', async (t) => {
  tmpDir = await mkdtemp(join(tmpdir(), 'expf-test-'));
  const testDir = join(tmpDir, 'my load test');
  await mkdir(testDir);

  const ac = new AbortController();

  await main({
    test: pathToFileURL(join(testDir, 'index.mjs')).href,
    runner: mockRunnerPath,
    abortController: ac,
    write: true
  });

  const files = await readdir(join(testDir, 'results'));
  assert.strictEqual(files.length, 1);
  assert.match(files[0], /^result-\d+\.json$/);
});
