#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { argv } from 'node:process';

const { values, positionals } = parseArgs({
  args: argv,
  allowPositionals: true,
  options: {
    help: {
      type: 'boolean'
    },
    cwd: {
      type: 'string'
    },

    repo: {
      type: 'string'
    },
    'repo-ref': {
      type: 'string'
    },

    runner: {
      type: 'string',
      short: 'u'
    },

    test: {
      type: 'string',
      short: 't'
    }
  }
});

async function main() {
  switch (positionals[2]) {
    case 'compare':
      try {
        await (await import('../compare.mjs')).default(values, ...positionals.slice(3));
      } catch (e) {
        console.error('Compare error:', e.message);
        process.exit(1);
      }
      break;
    case 'load':
      try {
        await (await import('../load.mjs')).default(values);
      } catch (e) {
        console.error('Load error:', e.message);
        process.exit(1);
      }
      break;
    case 'bench':
      try {
        await (await import('../bench.mjs')).default(values);
      } catch (e) {
        console.error('Bench error:', e.message);
        process.exit(1);
      }
      break;
    default:
      console.log(`
Express Performance Testing CLI
===============================

${(await import('../load.mjs')).help()}

${(await import('../bench.mjs')).help()}

${(await import('../compare.mjs')).help()}
`
      );
  }
}

// Run the main function
main().catch((error) => {
  console.error('CLI error:', error.message);
  process.exit(1);
});
