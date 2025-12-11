import { parseArgs } from 'node:util';
import { argv } from 'node:process';

const { values, positionals } = parseArgs({
  args: argv,
  allowPositionals: true,
  allowNegative: true,
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
    },

    node: {
      type: 'string',
      short: 'n'
    },

    overrides: {
      type: 'string',
      short: 'o'
    },

    config: {
      type: 'string',
      short: 'c'
    },

    write: {
      type: 'boolean'
    },

    parallel: {
      type: 'boolean',
      default: false
    },

    duration: {
      type: 'string',
      short: 'd'
    },

    'force-rebuild': {
      type: 'boolean'
    }
  }
});

// Convert cli friendly values to JS friendly values
values.repoRef = values['repo-ref'];
delete values['repo-ref'];
values.forceRebuild = values['force-rebuild'];
delete values['force-rebuild'];

switch (positionals[2]) {
  case 'compare':
    try {
      await (await import('../compare.mjs')).default(values, ...positionals.slice(3));
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
    break;
  case 'load':
    try {
      await (await import('../load.mjs')).default(values);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
    break;
  case 'bench':
    try {
      await (await import('../bench.mjs')).default(values);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
    break;
  default:
    console.log(`
Express Performance Testing CLI
===============================

${(await import('../compare.mjs')).help(values)}

${(await import('../load.mjs')).help(values)}

${(await import('../bench.mjs')).help(values)}
`
    );
}
