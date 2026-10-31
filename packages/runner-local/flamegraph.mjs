import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function createProfiler () {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 6)) {
    throw new Error('--flamegraph requires Node.js 22.6.0 or newer');
  }
  if (process.platform === 'win32') {
    throw new Error('--flamegraph requires Unix signals (Linux or macOS)');
  }

  let flame;
  try {
    flame = (await import('@platformatic/flame')).default;
  } catch (cause) {
    throw new Error('Cannot load @platformatic/flame. Install optional dependencies with npm install --include=optional.', { cause });
  }

  const directory = await mkdtemp(join(tmpdir(), 'expf-flame-'));
  return {
    start (test, cwd) {
      // Manual mode lets us save profiles on shutdown and await HTML generation
      // in the parent, instead of leaving it to detached child processes.
      return flame.startProfiling(
        fileURLToPath(new URL('./profiled-server.mjs', import.meta.url)),
        [test, directory],
        {
          autoStart: false,
          cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            FLAME_AUTO_START: 'false',
            // flame launches `node` from PATH; use the same runtime as expf.
            PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH || ''}`
          }
        }
      ).process;
    },
    async results () {
      const files = await readdir(directory);
      const profile = files.find(file => /^cpu-profile-.*\.pb$/.test(file));
      if (!profile) {
        throw new Error('The server did not produce a CPU profile');
      }
      const html = join(directory, 'flamegraph.html');
      await flame.generateFlamegraph(join(directory, profile), html);
      return { flamegraph: await readFile(html, 'utf8') };
    },
    async cleanup () {
      await rm(directory, { recursive: true, force: true });
    }
  };
}
