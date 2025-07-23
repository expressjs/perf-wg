#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import process from 'process';

const execAsync = async (cmd, opts) => {
  console.log(`Executing: ${cmd}`);
  return promisify(exec)(cmd, opts);
};

/**
 * Environment validation
 */
function validateEnvironment() {
  if (!process.env.TEST) {
    console.error('$TEST is required.');
    process.exit(1);
  }
}

/**
 * Write metadata file
 */
async function writeMetadata() {
  try {
    const { stdout } = await execAsync('node ../metadata.mjs');
    await writeFile('../results/metadata.json', stdout);
    console.log('Metadata written successfully');
  } catch (error) {
    console.error('Failed to write metadata:', error.message);
    throw error;
  }
}

/**
 * Setup repository
 */
async function setupRepository() {
  const REPO_DIR = '/home/node/repo';
  
  if (existsSync(REPO_DIR)) {
    console.log('Using local benchmarks');
    process.chdir(REPO_DIR);
    return;
  }
  
  if (!process.env.REPO || !process.env.REF) {
    console.error('$REPO and $REF are required.');
    process.exit(1);
  }
  
  console.log('Setting up benchmark repository...');
  process.chdir(REPO_DIR);
  
  try {
    await execAsync('git init');
    await execAsync(`git remote add origin "${process.env.REPO}"`);
    await execAsync(`git fetch origin --depth=1 "${process.env.REF}"`);
    await execAsync(`git checkout "${process.env.REF}"`);
    
    // Install dependencies
    console.log('Installing dependencies...');
    try {
      await execAsync('npm install --no-optional --no-audit --no-fund', { timeout: 120000 });
      console.log('Dependencies installed successfully');
    } catch (error) {
      console.error('Failed to install dependencies:', error.message);
      // Continue anyway, might still work
    }
    
    console.log('Repository setup complete');
  } catch (error) {
    console.error('Repository setup failed:', error.message);
    throw error;
  }
}

/**
 * Cross-platform spinner implementation
 */
function createSpinner() {
  const SPIN = ['⠁', '⠂', '⠄', '⡀', '⢀', '⠠', '⠐', '⠈'];
  let spinIndex = 0;
  
  return async function spinner() {
    if (!process.env.NO_SPIN) {
      process.stdout.write(`\b${SPIN[spinIndex]}`);
      spinIndex = (spinIndex + 1) % SPIN.length;
      await new Promise(resolve => setTimeout(resolve, 100));
    } else {
      process.stdout.write('.');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };
}

/**
 * Get server entry point from package.json
 */
async function getServerMain() {
  try {
    const packageContent = await readFile('package.json', 'utf8');
    const pkg = JSON.parse(packageContent);
    
    if (pkg.exports && pkg.exports.server) {
      return pkg.exports.server;
    }
    
    return pkg.main || 'index.js';
  } catch (error) {
    console.error('Failed to read package.json:', error.message);
    return 'index.js';
  }
}

/**
 * Start server with Node.js
 */
async function startServer() {
  const testPackage = process.env.TEST;
  
  // Navigate to server directory
  try {
    const { stdout } = await execAsync(`node -p "require('node:path').dirname(require.resolve('${testPackage}'))"`);
    const serverDir = stdout.trim();
    process.chdir(serverDir);
    console.log(`Changed to server directory: ${serverDir}`);
  } catch (error) {
    console.error('Failed to resolve test package:', error.message);
    throw error;
  }
  
  // Run server setup
  console.log('Running setup...');
  try {
    await execAsync('node --run setup');
  } catch (error) {
    console.log('No setup script found or setup failed, continuing...');
  }
  
  // Get main file
  const mainFile = await getServerMain();
  console.log(`Starting server with main file: ${mainFile}`);
  
  // Start server
  const serverProcess = spawn('node', [
    '--interpreted-frames-native-stack',
    '--perf-basic-prof-only-functions',
    '--inspect=0.0.0.0:9229',
    mainFile
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });
  
  // Redirect output to file
  const outputFile = await import('fs').then(fs => fs.createWriteStream('/home/node/results/output.txt'));
  serverProcess.stdout.pipe(outputFile);
  serverProcess.stderr.pipe(outputFile);
  
  return serverProcess;
}

/**
 * Start perf recording (Linux only)
 */
async function startPerf(serverPid) {
  if (process.platform !== 'linux') {
    console.log('Perf recording is only available on Linux');
    return null;
  }
  
  try {
    const perfProcess = spawn('perf', [
      'record', '-F', '99', '-g',
      '-o', '/home/node/results/perf.data',
      '-p', serverPid.toString()
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });
    
    // Redirect perf output
    const perfOutputFile = await import('fs').then(fs => fs.createWriteStream('/home/node/results/perf.txt'));
    perfProcess.stdout.pipe(perfOutputFile);
    perfProcess.stderr.pipe(perfOutputFile);
    
    return perfProcess;
  } catch (error) {
    console.error('Failed to start perf recording:', error.message);
    return null;
  }
}

/**
 * Take heap snapshot
 */
async function takeHeapSnapshot(pid, filename) {
  try {
    await execAsync(`npx -q @mmarchini/observe heap-snapshot -p ${pid} --file /home/node/results/${filename}`);
    console.log(`Heap snapshot saved: ${filename}`);
  } catch (error) {
    console.error(`Failed to take heap snapshot: ${error.message}`);
  }
}

/**
 * Generate flamegraph (Linux only)
 */
async function generateFlamegraph() {
  if (process.platform !== 'linux') {
    console.log('Flamegraph generation is only available on Linux');
    return;
  }
  
  try {
    console.log('Generating flamegraph...');
    await execAsync(`
      perf script -i /home/node/results/perf.data | 
      /home/node/FlameGraph/stackcollapse-perf.pl | 
      /home/node/FlameGraph/flamegraph.pl --colors=js > /home/node/results/profile.svg
    `);
    console.log('Flamegraph generated successfully');
  } catch (error) {
    console.error('Failed to generate flamegraph:', error.message);
  }
}

/**
 * Wait for server startup
 */
async function waitForStartup() {
  console.log('Waiting for server startup...');
  
  while (true) {
    try {
      const content = await readFile('/home/node/results/output.txt', 'utf8');
      if (content.includes('startup: ')) {
        console.log('Server startup detected');
        console.log('Running'); // This is what the parent runner waits for
        return true;
      }
    } catch (error) {
      // File might not exist yet, continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

/**
 * Check if process is running
 */
function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  let serverProcess = null;
  let perfProcess = null;
  let exitCode = 0;
  
  const spinner = createSpinner();
  
  // Cleanup function
  const cleanup = async (signal = 'SIGINT') => {
    console.log('\nShutting down...');
    
    if (serverProcess) {
      console.log('Capturing ending heap snapshot...');
      await takeHeapSnapshot(serverProcess.pid, 'end.heapsnapshot');
      
      console.log('Closing server...');
      try {
        serverProcess.kill(signal);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for graceful shutdown
      } catch (error) {
        console.error('Error stopping server:', error.message);
      }
    }
    
    if (perfProcess) {
      try {
        perfProcess.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Error stopping perf:', error.message);
      }
    }
    
    await generateFlamegraph();
    
    console.log(`Exiting (${exitCode})`);
    process.exit(exitCode);
  };
  
  // Handle signals
  process.on('SIGINT', () => cleanup('SIGINT'));
  process.on('SIGTERM', () => cleanup('SIGTERM'));
  
  try {
    // Validate environment
    validateEnvironment();
    
    // Write metadata
    await writeMetadata();
    
    // Setup repository
    await setupRepository();
    
    // Start server
    serverProcess = await startServer();
    console.log(`Server started (PID: ${serverProcess.pid})`);
    
    // Start perf recording
    perfProcess = await startPerf(serverProcess.pid);
    if (perfProcess) {
      console.log(`Perf recording started (PID: ${perfProcess.pid})`);
    }
    
    // Wait for startup
    await waitForStartup();
    
    // Take starting heap snapshot
    console.log('Capturing starting heap snapshot...');
    await takeHeapSnapshot(serverProcess.pid, 'start.heapsnapshot');
    
    // Main loop
    console.log('Server is running... (Press Ctrl+C to stop)');
    process.stdout.write('Running');
    
    while (true) {
      // Check if server process exited
      if (!isProcessRunning(serverProcess.pid)) {
        console.log(`\nServer exited prematurely (PID: ${serverProcess.pid})`);
        exitCode = 1;
        break;
      }
      
      await spinner();
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    exitCode = 1;
  }
  
  await cleanup();
}

// Run if this script is executed directly
main();

export default main;
