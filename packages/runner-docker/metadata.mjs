import process from 'node:process';

import { collectMetadata } from '@expressjs/perf-collect-metadata';

process.stdout.write(JSON.stringify(collectMetadata()));
