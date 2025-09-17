import { parseArgs } from 'node:util';

let data = '';
for await (const chunk of process.stdin) {
  data += chunk;
}
let pkg = {};
let overrides = {};
try {
  pkg = JSON.parse(data);
  const args = parseArgs({ allowPositionals: true });
  overrides = JSON.parse(args.positionals[0]);
} catch (e) {
  console.error(e, data);
}

for (const [dep, spec] of Object.entries(overrides)) {
  if (pkg.dependencies[dep]) {
    pkg.dependencies[dep] = spec;
  }
}

pkg.overrides = {
  ...(pkg.overrides ?? {}),
  ...overrides
};

process.stdout.write(JSON.stringify(pkg, null, 2) + '\n');
