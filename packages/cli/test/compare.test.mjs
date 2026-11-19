import { mock, test, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

mock.module('autocannon', {
  defaultExport: {
    printResult: (result) => `mock autocannon result for ${result.url}`
  }
});

const { default: main } = await import('../compare.mjs');

let tmpDir;

afterEach(async () => {
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
});

function clientResult (url, rps) {
  return {
    url,
    duration: 10,
    requests: { average: rps, mean: rps, stddev: 1, total: rps * 10 },
    throughput: { average: rps * 100, mean: rps * 100, stddev: 1, total: rps * 1000 },
    latency: { average: 1000 / rps, mean: 1000 / rps, stddev: 1 },
    statusCodeStats: { 200: { count: rps * 10 } }
  };
}

async function writeResults (path, clientResults) {
  await writeFile(path, JSON.stringify({ clientResults }));
  return path;
}

test('compare accepts absolute result paths', async (t) => {
  tmpDir = await mkdtemp(join(tmpdir(), 'expf-test-'));
  const logSpy = t.mock.method(console, 'log', () => {});

  const resultA = await writeResults(join(tmpDir, 'a.json'), [clientResult('http://localhost:3000/', 1000)]);
  const resultB = await writeResults(join(tmpDir, 'b.json'), [clientResult('http://localhost:3000/', 2000)]);

  await main({}, resultA, resultB);

  const logs = logSpy.mock.calls.map((call) => call.arguments.join(' '));
  assert.ok(logs.some((l) => l.startsWith('Comparison: B Wins')));
});

test('compare resolves relative result paths against --cwd', async (t) => {
  tmpDir = await mkdtemp(join(tmpdir(), 'expf-test-'));
  const logSpy = t.mock.method(console, 'log', () => {});

  await writeResults(join(tmpDir, 'a.json'), [clientResult('http://localhost:3000/', 1000)]);
  await writeResults(join(tmpDir, 'b.json'), [clientResult('http://localhost:3000/', 2000)]);

  await main({ cwd: tmpDir }, 'a.json', 'b.json');

  const logs = logSpy.mock.calls.map((call) => call.arguments.join(' '));
  assert.ok(logs.some((l) => l.startsWith('Comparison: B Wins')));
});

test('compare accepts result paths containing spaces', async (t) => {
  tmpDir = await mkdtemp(join(tmpdir(), 'expf test '));
  const logSpy = t.mock.method(console, 'log', () => {});

  const resultA = await writeResults(join(tmpDir, 'result a.json'), [clientResult('http://localhost:3000/', 1000)]);
  const resultB = await writeResults(join(tmpDir, 'result b.json'), [clientResult('http://localhost:3000/', 2000)]);

  await main({}, resultA, resultB);

  const logs = logSpy.mock.calls.map((call) => call.arguments.join(' '));
  assert.ok(logs.some((l) => l.startsWith('Comparison: B Wins')));
});
