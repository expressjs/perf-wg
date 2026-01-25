import {
  rename,
  access,
  writeFile,
  rm,
  realpath,
  constants as fsConstants
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
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
  const pkgUrl = pathToFileURL(pkgPath).href;
  const pkg = (await import(pkgUrl, {
    with: {
      type: 'json'
    }
  })).default;

  // Apply overrides and uws dependencies
  const needsModification = opts.overrides || opts.uws;
  if (needsModification) {
    await rename(pkgPath, pkgBakPath);
    // Imports are immutable
    const _pkg = {
      ...pkg
    };

    // Apply overrides
    if (opts.overrides) {
      _pkg.overrides = {
        ...(pkg.overrides ?? {}),
        ...opts.overrides
      };
    }

    // Add uwebsockets-express dependencies when --uws is enabled
    if (opts.uws) {
      // Use explicit version from overrides if provided, otherwise auto-detect
      let uwsExpressVersion = opts.overrides?.['uwebsockets-express'];
      
      if (!uwsExpressVersion) {
        // Determine uwebsockets-express version based on express version
        const expressVersion = opts.overrides?.express || pkg.dependencies?.express || '';
        // Handle semver ranges like ^4, ~4, 4.x, 4.21.2, etc.
        const isExpress4 = /^[~^]?4|^4\./.test(expressVersion);
        uwsExpressVersion = isExpress4 ? '1.3.13' : '2.0.0';
      }
      
      _pkg.dependencies = {
        ...(pkg.dependencies ?? {}),
        'uWebSockets.js': 'uNetworking/uWebSockets.js#v20.51.0',
        'uwebsockets-express': uwsExpressVersion
      };

      // Remove uwebsockets-express from overrides to avoid conflict with dependency
      if (_pkg.overrides?.['uwebsockets-express']) {
        delete _pkg.overrides['uwebsockets-express'];
      }
    }

    await writeFile(pkgPath, JSON.stringify(_pkg, null, 2));
  }

  // node --run setup || npm run setup
  try {
    const nodePath = await realpath(process.execPath);
    await pExecFile(nodePath, ['--run', 'setup'], { cwd });
  } catch (e) {
    console.error(e);
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
