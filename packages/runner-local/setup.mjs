import {
  rename,
  access,
  writeFile,
  rm,
  realpath,
  constants as fsConstants
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const pExecFile = promisify(execFile);

async function restore (cwd) {
  const pkgPath = join(cwd, 'package.json');
  const pkgBakPath = join(cwd, 'package.json.bak');
  try {
    await access(pkgBakPath, fsConstants.R_OK | fsConstants.W_OK);
    console.log('package.json.bak exists, restoring original');
    await rm(pkgPath);
    await rename(pkgBakPath, pkgPath, fsConstants.COPYFILE_FICLONE);
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
  }
  return { pkgPath, pkgBakPath };
}

export async function setup (cwd, opts = {}) {
  // Ensure we have the right node version
  if (process.version !== `v${opts.node}`) {
    // TODO: install node with nvm?
    throw Object.assign(new Error(`Incorrect node.js version`), {
      wanted: opts.node,
      found: process.version.replace(/^v/, '')
    });
  }

  // Setup the repo if asked
  if (!opts.repo) {
    console.log('Using local repo.');
  } else {
    // TODO: clone repo into tmp dir
    throw new Error('cloning repo not yet implemented');
  }

  // Restore backup if necessary
  const { pkgPath, pkgBakPath } = await restore(cwd);

  // Read in package.json contets
  const pkg = await import(pkgPath, {
    with: {
      type: 'json'
    }
  });

  // Apply overrides
  if (opts.overrides) {
    await rename(pkgPath, pkgBakPath);
    pkg.overrides = {
      ...(pkg.overrides ?? {}),
      ...opts.overrides
    };
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2));
  }

  // node --run setup || npm run setup
  try {
    const nodePath = await realpath(process.execPath);
    await pExecFile(nodePath, ['--run', 'setup'], { cwd });
  } catch (e) {
    const npmPath = await realpath(join(dirname(process.execPath), 'npm'));
    await pExecFile(npmPath, ['run', 'setup'], { cwd });
  }

  return { cwd };
}

export async function cleanup (cwd) {
  await restore(cwd);
  await rm(join(cwd, 'package-lock.json'), {
    force: true
  });
  await rm(join(cwd, 'node_modules'), {
    force: true,
    recursive: true
  });
}
