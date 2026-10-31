import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startServer } from '../server.mjs';

async function fixture (t, source) {
  const cwd = await mkdtemp(join(tmpdir(), 'expf-server-test-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const script = join(cwd, 'server.mjs');
  await writeFile(script, source);
  return { cwd, test: pathToFileURL(script).href };
}

const source = `
  import { writeFileSync } from 'node:fs';
  import { fileURLToPath } from 'node:url';
  if (process.argv[1] !== fileURLToPath(import.meta.url)) throw new Error('Incorrect argv');
  writeFileSync('cwd.txt', process.cwd());
  function benchmarkHotspot () {
    let result = 0;
    for (let i = 0; i < 20000000; i++) result += Math.sqrt(i);
    return result;
  }
  console.log('startup:', benchmarkHotspot());
  setInterval(benchmarkHotspot, 10);
`;

test('unprofiled servers return empty server results and close idempotently', { timeout: 10000 }, async t => {
  const { cwd, test } = await fixture(t, source);
  const server = await startServer(cwd, { test });
  t.after(() => server.close());
  assert.deepEqual(await server.results(), {});
  await server.close();
  assert.equal(server.status, 'stopped');
});

test('a server exiting before startup rejects instead of hanging', { timeout: 10000 }, async t => {
  const { cwd, test } = await fixture(t, 'process.exit(1);');
  await assert.rejects(startServer(cwd, { test }), /Server exited before startup/);
});

const [major, minor] = process.versions.node.split('.').map(Number);
const profilingSupported = process.platform !== 'win32' && (major > 22 || (major === 22 && minor >= 6));

test('profiling embeds a complete HTML report without changing the server cwd', {
  timeout: 30000,
  skip: !profilingSupported
}, async t => {
  const { cwd, test } = await fixture(t, source);
  const server = await startServer(cwd, { test, flamegraph: true });
  t.after(() => server.close());
  const results = await server.results();
  assert.match(results.flamegraph, /<!doctype html>/i);
  const embedded = results.flamegraph.match(/const profileData = new Uint8Array\(\[([\d,]+)\]\)/);
  assert.ok(embedded, 'HTML should embed the pprof samples');
  const profile = Buffer.from(embedded[1].split(',').map(Number));
  assert.ok(profile.includes(Buffer.from('benchmarkHotspot')), 'profile should contain the server workload');
  assert.equal(await readFile(join(cwd, 'cwd.txt'), 'utf8'), cwd);
  assert.deepEqual((await readdir(cwd)).sort(), ['cwd.txt', 'server.mjs']);
  assert.equal(server.status, 'stopped');
  assert.equal((await server.results()).flamegraph, results.flamegraph);
});

test('aborting a profiled server closes it without generating an incomplete report', {
  timeout: 10000,
  skip: !profilingSupported
}, async t => {
  const { cwd, test } = await fixture(t, source);
  const controller = new AbortController();
  const server = await startServer(cwd, { test, flamegraph: true, signal: controller.signal });
  t.after(() => server.close());
  controller.abort();
  assert.deepEqual(await server.results(), {});
  assert.equal(server.status, 'stopped');
});

test('a profiled server failing before startup rejects and cleans up', {
  timeout: 10000,
  skip: !profilingSupported
}, async t => {
  const { cwd, test } = await fixture(t, 'process.exit(1);');
  await assert.rejects(startServer(cwd, { test, flamegraph: true }), /Server exited before startup/);
  assert.deepEqual(await readdir(cwd), ['server.mjs']);
});
