import process from 'node:process';
import { collectMetadata } from '@expressjs/perf-metadata';

process.stdout.write(JSON.stringify(collectMetadata()));
