import { pathToFileURL } from 'node:url';

const [test, directory] = process.argv.slice(2);

// @platformatic/flame preloads its SIGUSR2 handler in manual mode.
process.emit('SIGUSR2');
// Save before the native profiler's own exit hook disposes its samples.
process.prependOnceListener('exit', () => {
  // Preserve the benchmark's working directory while it runs, then save the
  // profiles in a directory belonging only to this run.
  process.chdir(directory);
  process.emit('SIGUSR2');
});
process.once('SIGINT', () => process.exit(0));
process.once('SIGTERM', () => process.exit(0));

// Test packages use argv[1] to determine whether to start their server.
process.argv = [process.execPath, test];
await import(pathToFileURL(test).href);
