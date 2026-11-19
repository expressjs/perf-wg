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

const { default: main, pairResults } = await import('../compare.mjs');

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

async function writeResults (name, clientResults) {
  await writeFile(join(tmpDir, name), JSON.stringify({ clientResults }));
  return name;
}

test('pairResults matches results by url regardless of order', () => {
  const a = [clientResult('http://localhost:3000/', 1), clientResult('http://localhost:3000/foo', 2)];
  const b = [clientResult('http://localhost:3000/foo', 3), clientResult('http://localhost:3000/', 4)];

  const pairs = pairResults(a, b);

  assert.deepStrictEqual(pairs.map((p) => p.label), ['http://localhost:3000/', 'http://localhost:3000/foo']);
  assert.strictEqual(pairs[0].a, a[0]);
  assert.strictEqual(pairs[0].b, b[1]);
  assert.strictEqual(pairs[1].a, a[1]);
  assert.strictEqual(pairs[1].b, b[0]);
});

test('pairResults matches repeated urls in order', () => {
  const a = [clientResult('http://localhost:3000/', 1), clientResult('http://localhost:3000/', 2)];
  const b = [clientResult('http://localhost:3000/', 3), clientResult('http://localhost:3000/', 4)];

  const pairs = pairResults(a, b);

  assert.strictEqual(pairs.length, 2);
  assert.strictEqual(pairs[0].a, a[0]);
  assert.strictEqual(pairs[0].b, b[0]);
  assert.strictEqual(pairs[1].a, a[1]);
  assert.strictEqual(pairs[1].b, b[1]);
});

test('pairResults accepts a single result object', () => {
  const a = clientResult('http://localhost:3000/', 1);
  const b = clientResult('http://localhost:3000/', 2);

  const pairs = pairResults(a, b);

  assert.strictEqual(pairs.length, 1);
  assert.strictEqual(pairs[0].a, a);
  assert.strictEqual(pairs[0].b, b);
});

test('pairResults handles missing results', (t) => {
  t.mock.method(console, 'warn', () => {});

  assert.deepStrictEqual(pairResults(undefined, [clientResult('http://localhost:3000/', 1)]), []);
  assert.deepStrictEqual(pairResults([clientResult('http://localhost:3000/', 1)], undefined), []);
});

test('pairResults warns about and skips unmatched results', (t) => {
  const warnSpy = t.mock.method(console, 'warn', () => {});
  const a = [clientResult('http://localhost:3000/', 1), clientResult('http://localhost:3000/foo', 2)];
  const b = [clientResult('http://localhost:3000/', 3), clientResult('http://localhost:3000/bar', 4)];

  const pairs = pairResults(a, b);

  assert.deepStrictEqual(pairs.map((p) => p.label), ['http://localhost:3000/']);
  const warnings = warnSpy.mock.calls.map((call) => call.arguments.join(' '));
  assert.ok(warnings.some((w) => w.includes('http://localhost:3000/foo') && w.includes('sample B')));
  assert.ok(warnings.some((w) => w.includes('http://localhost:3000/bar') && w.includes('sample A')));
});

test('compare reports every request in the results', async (t) => {
  tmpDir = await mkdtemp(join(tmpdir(), 'expf-test-'));
  const logSpy = t.mock.method(console, 'log', () => {});
  const urls = ['http://localhost:3000/', 'http://localhost:3000/foo', 'http://localhost:3000/bar'];

  const resultA = await writeResults('a.json', urls.map((url) => clientResult(url, 1000)));
  const resultB = await writeResults('b.json', urls.map((url) => clientResult(url, 2000)));

  await main({ cwd: tmpDir }, resultA, resultB);

  const logs = logSpy.mock.calls.map((call) => call.arguments.join(' '));
  for (const url of urls) {
    assert.ok(logs.some((l) => l.includes(`mock autocannon result for ${url}`)), `should print results for ${url}`);
    assert.ok(logs.some((l) => l.startsWith('Comparison: B Wins') && l.includes(`(${url})`)), `should compare ${url}`);
  }
});

test('compare does not label sections when there is only one request', async (t) => {
  tmpDir = await mkdtemp(join(tmpdir(), 'expf-test-'));
  const logSpy = t.mock.method(console, 'log', () => {});

  const resultA = await writeResults('a.json', [clientResult('http://localhost:3000/', 1000)]);
  const resultB = await writeResults('b.json', [clientResult('http://localhost:3000/', 2000)]);

  await main({ cwd: tmpDir }, resultA, resultB);

  const logs = logSpy.mock.calls.map((call) => call.arguments.join(' '));
  assert.ok(logs.some((l) => l.startsWith('Comparison: B Wins\n')));
});

test('compare rejects when no requests match', async (t) => {
  tmpDir = await mkdtemp(join(tmpdir(), 'expf-test-'));
  t.mock.method(console, 'warn', () => {});

  const resultA = await writeResults('a.json', [clientResult('http://localhost:3000/foo', 1000)]);
  const resultB = await writeResults('b.json', [clientResult('http://localhost:3000/bar', 2000)]);

  await assert.rejects(main({ cwd: tmpDir }, resultA, resultB), /No matching requests found/);
});
