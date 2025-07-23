import { execFile } from 'node:child_process';
import { join, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import ac from '@expressjs/perf-autocannon';

export async function startServer (opts = {}) {
  console.log('Starting server with options:', { cwd: opts.cwd, repo: opts.repo, repoRef: opts.repoRef, test: opts.test });
  
  return new Promise((resolve, reject) => {
    if (opts?.signal.aborted) {
      console.log('Server startup aborted due to signal');
      return reject(opts.signal.reason);
    }

    // Add a timeout to prevent hanging
    const timeout = setTimeout(() => {
      console.log('Server startup timeout after 5 minutes');
      cp.kill('SIGKILL');
      reject(new Error('Server startup timeout'));
    }, 5 * 60 * 1000); // 5 minutes

    const scriptPath = join(import.meta.dirname, 'scripts', 'run.mjs');
    const args = [scriptPath, opts.cwd, opts.repo, opts.repoRef, opts.test];
    
    console.log('Executing server process...');
    console.log('Script path:', scriptPath);
    console.log('Command args:', args);
    console.log('Working directory:', process.cwd());

    const cp = execFile('node', args, { 
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    console.log('Child process spawned with PID:', cp.pid);

    const server = {
      metadata: {
        url: new URL('http://localhost:3000')
      },
      status: 'starting',
      close: () => {
        console.log('Closing server...');
        return new Promise((closeResolve) => {
          clearTimeout(timeout);
          cp.on('exit', () => {
            console.log('Server process exited');
            server.status = 'stopped';
            closeResolve();
          });
          cp.kill('SIGINT');
          server.status = 'closing';
        });
      },
      results: async () => {
        console.log('Collecting server results...');
        // Get results
        const results = await Promise.allSettled([
          readFile(join(opts.cwd, 'results', 'output.txt'), { encoding: 'utf8' }),
          readFile(join(opts.cwd, 'results', 'profile.svg'), { encoding: 'utf8' }),
          readFile(join(opts.cwd, 'results', 'perf.data')),
          readFile(join(opts.cwd, 'results', 'metadata.json'), { encoding: 'utf8' })
        ]);

        console.log('Results collection status:', results.map((r, i) => ({ 
          index: i, 
          status: r.status, 
          hasValue: !!r.value,
          error: r.reason?.message 
        })));

        // System information from inside the container
        if (results[3].value) {
          Object.assign(server.metadata, JSON.parse(results[3].value));
          console.log('Server metadata loaded from container');
        } else {
          console.log('Failed to load server metadata:', results[3].error?.message);
          Object.assign(server.metadata, {
            error: results[3].error
          });
        }
        return {
          output: results[0].value || results[0].error,
          flamegraph: results[1].value || results[1].error,
          rawPerfData: results[2].value || results[2].error
        };
      }
    };

    opts?.signal.addEventListener('abort', () => {
      console.log('Server aborted via signal');
      server.status = 'aborted';
      cp.kill('SIGINT');
      reject(opts.signal.reason);
    });
    
    cp.on('error', (err) => {
      console.error('Server process error:', err);
      clearTimeout(timeout);
      reject(err);
    });
    
    cp.on('spawn', () => {
      console.log('Child process spawned successfully');
    });
    
    cp.on('exit', (code, signal) => {
      console.log(`Child process exited with code ${code} and signal ${signal}`);
      clearTimeout(timeout);
      if (server.status === 'starting') {
        reject(new Error(`Server process exited unexpectedly with code ${code}`));
      }
    });
    
    cp.stdout.on('data', (d) => {
      const output = d.toString('utf8');
      console.log('Server stdout:', output.trim());
      process.stdout.write(d);
      if (server.status === 'starting' && output.includes("Running")) {
        console.log('Server is now running and ready');
        server.status = 'started';
        clearTimeout(timeout);
        resolve(server);
      }
    });
    
    cp.stderr.on('data', (d) => {
      const output = d.toString('utf8');
      console.log('Server stderr:', output.trim());
      process.stderr.write(d);
    });

    // Add a periodic check to see if the process is still running
    const healthCheck = setInterval(() => {
      if (cp.killed) {
        console.log('Child process was killed');
        clearInterval(healthCheck);
      } else {
        console.log('Child process still running, PID:', cp.pid);
      }
    }, 10000); // Check every 10 seconds

    // Clean up health check when process completes
    cp.on('exit', () => {
      clearInterval(healthCheck);
    });
  });
}

export async function startClient (_opts = {}, server) {
  console.log('Starting client with test:', _opts.test);
  
  const opts = {
    ..._opts
  };

  console.log('Loading test requests from:', opts.test);
  const testModule = await import(opts.test);
  const requests = await testModule.requests();
  console.log('Test requests loaded, count:', requests?.length || 'unknown');

  console.log('Initializing autocannon with URL:', server.metadata.url.toString());
  const cannon = ac({
    url: server.metadata.url.toString(),
    requests
  });

  console.log('Client initialized successfully');

  return {
    metadata: {
      cpus: os.cpus(),
      totalmem: os.totalmem(),
      arch: os.arch(),
      machine: os.machine(),
      platform: os.platform(),
      release: os.release(),
      type: os.type(),
      version: os.version(),
      // TODO: autocannon settings
    },
    close: async () => {
      console.log('Closing client...');
      cannon.stop?.();
      console.log('Client closed');
    },
    results: () => {
      console.log('Returning client results');
      return cannon;
    }
  };
}

export default async function runner (_opts = {}) {
  console.log('Starting performance runner with options:', _opts);
  
  // Start up the server, then the client
  const opts = {
    ..._opts
  };

  console.log('Phase 1: Starting server...');
  const server = await startServer(opts);
  console.log('Server started successfully');

  console.log('Phase 2: Starting client...');
  const client = await startClient(opts, server);
  console.log('Client started successfully');

  console.log('Phase 3: Waiting for client results...');
  const clientResults = await client.results();
  console.log('Client results obtained');

  console.log('Phase 4: Collecting server results...');
  const serverResults = await server.results();
  console.log('Server results obtained');

  console.log('Phase 5: Cleaning up...');
  await client.close();
  await server.close();
  console.log('Cleanup completed');

  console.log('Performance run completed successfully');
  return {
    serverMetadata: server.metadata,
    clientMetadata: client.metadata,
    serverResults,
    clientResults
  };
}
