#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const execAsync = async (cmd, opts) => {
  const id = Math.random().toString(36).substring(2, 15);
  console.log(`/- ${id} Executing: ${cmd}`);
  const std = promisify(exec)(cmd, opts);
  const { stdout, stderr } = await std;
  if (stdout) console.log(`|- ${id} STDOUT: ${stdout?.trim()}`);
  if (stderr) console.error(`|- ${id} STDERR: ${stderr?.trim()}`);
  console.log(`\\- ${id} Execute Finished`);
  return std;
};
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Check if running in an interactive terminal
 */
function isInteractiveTerminal() {
  return process.stdout.isTTY && process.stdin.isTTY;
}

/**
 * Check if Docker daemon is running
 */
async function isDockerRunning() {
  try {
    await execAsync('docker stats --no-stream', { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Start Docker daemon (platform-specific)
 */
async function startDocker() {
  console.log('Docker is not running. Attempting to start...');

  const platform = process.platform;

  if (platform === 'darwin') {
    try {
      await execAsync('open /Applications/Docker.app');
    } catch (error) {
      console.log(
        'Could not auto-start Docker on macOS. Please start Docker Desktop manually.'
      );
    }
  } else if (platform === 'win32') {
    try {
      await execAsync(
        'start "" "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"'
      );
    } catch (error) {
      console.log(
        'Could not auto-start Docker on Windows. Please start Docker Desktop manually.'
      );
    }
  } else {
    try {
      await execAsync('sudo systemctl start docker');
    } catch (error) {
      console.log(
        'Could not start Docker service. Please start Docker manually.'
      );
    }
  }
}

/**
 * Wait for Docker to be ready
 */
async function waitForDocker() {
  console.log('Waiting for Docker to launch...');

  while (!(await isDockerRunning())) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    process.stdout.write('.');
  }
  console.log('\nDocker is ready!');
}

/**
 * Clean up results folder
 */
async function cleanupResults(resultsDir) {
  try {
    await mkdir(resultsDir, { recursive: true });

    if (existsSync(resultsDir)) {
      const files = await import('fs').then((fs) =>
        fs.promises.readdir(resultsDir)
      );
      await Promise.all(
        files.map((file) =>
          rm(path.join(resultsDir, file), { force: true, recursive: true })
        )
      );
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Convert path to Docker-compatible format
 */
function toDockerPath(localPath) {
  if (process.platform === 'win32') {
    // Docker Desktop on Windows expects paths like /host_mnt/c/Users/...
    // But we can also just use the Windows path directly and let Docker handle it
    return localPath.replace(/\\/g, '/');
  }
  return localPath;
}

/**
 * Run Docker container interactively
 */
async function runInteractive(options) {
  const { cwd, repo, ref, test } = options;

  const dockerCwd = toDockerPath(cwd);
  const dockerResults = toDockerPath(path.join(cwd, 'results'));

  return new Promise((resolve, reject) => {
    const container = spawn(
      'docker',
      [
        'run',
        '--rm',
        '-it',
        '--env',
        `REPO=${repo}`,
        '--env',
        `REF=${ref}`,
        '--env',
        `TEST=${test}`,
        '--volume',
        `${dockerCwd}:/home/node/repo`,
        '--volume',
        `${dockerResults}:/home/node/results`,
        '-p',
        '3000:3000',
        '-p',
        '9229:9229',
        'perf-runner:latest',
      ],
      {
        stdio: 'inherit',
      }
    );

    container.on('close', (code) => {
      resolve(code);
    });

    container.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Run Docker container in detached mode
 */
async function runDetached(options) {
  const { cwd, repo, ref, test } = options;

  const dockerCwd = toDockerPath(cwd);
  const dockerResults = toDockerPath(path.join(cwd, 'results'));

  return new Promise((resolve, reject) => {
    // Start container in detached mode
    const startContainer = spawn(
      'docker',
      [
        'run',
        '--rm',
        '-d',
        '--env',
        'NO_SPIN=1',
        '--env',
        `REPO=${repo}`,
        '--env',
        `REF=${ref}`,
        '--env',
        `TEST=${test}`,
        '--volume',
        `${dockerCwd}:/home/node/repo`,
        '--volume',
        `${dockerResults}:/home/node/results`,
        '-p',
        '3000:3000',
        '-p',
        '9229:9229',
        'perf-runner:latest',
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let containerId = '';

    startContainer.stdout.on('data', (data) => {
      containerId = data.toString().trim();
    });

    startContainer.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Failed to start container with exit code ${code}`));
        return;
      }

      console.log(`Container started: ${containerId}`);

      // Handle SIGINT to stop container gracefully
      const handleSigint = async () => {
        try {
          await execAsync(`docker kill --signal="SIGINT" "${containerId}"`);
        } catch (error) {
          // Ignore errors when killing container
        }
        process.exit(0);
      };

      process.on('SIGINT', handleSigint);

      // Follow logs
      const logs = spawn('docker', ['logs', '--follow', containerId], {
        stdio: ['ignore', 'inherit', 'inherit'],
      });

      // Monitor container status
      const checkStatus = setInterval(async () => {
        const clear = (code) => {
          clearInterval(checkStatus);
          logs.kill('SIGINT'); // or 'SIGTERM'
          process.removeListener('SIGINT', handleSigint);
          setTimeout(() => process.exit(code), 100);
        };

        try {
          const { stdout } = await execAsync(
            `docker container inspect -f '{{.State.Running}}' "${containerId}"`
          );
          if (stdout.trim() === 'true') {
            // stop container - it is still running
            console.log(`Container is stopping (${containerId})`);
            await execAsync(`docker stop "${containerId}"`);
            clear(0);
          } else {
            
            console.log(`Container exited (${containerId})`);
            clear(0);
            resolve(0);
          }
        } catch (error) {
          console.log(`catch - Container exited(${containerId})`);
          clear(1);
          resolve(1);
        }
      }, 1000);
    });

    startContainer.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Main function
 */
async function main() {
  try {
    // Parse arguments
    const cwd = process.argv[2] || path.resolve(__dirname, '../../../');
    const repo = process.argv[3] || 'https://github.com/expressjs/perf-wg.git';
    const ref = process.argv[4] || 'master';
    const test = process.argv[5] || '@expressjs/perf-servers/node-http';

    console.log('Starting Docker run process...');
    console.log('Configuration:');
    console.log(`  CWD: ${cwd}`);
    console.log(`  REPO: ${repo}`);
    console.log(`  REF: ${ref}`);
    console.log(`  TEST: ${test}`);
    console.log('');

    // Check if Docker is running
    if (!(await isDockerRunning())) {
      await startDocker();
      await waitForDocker();
    } else {
      console.log('Docker is already running!');
    }

    // Clean up active containers
    const activeContainers = await execAsync(
      'docker ps --filter "ancestor=perf-runner:latest" --format "{{.ID}}"'
    );
    const containerIds = activeContainers.stdout.trim().split('\n').filter(Boolean);
    if (containerIds.length > 0) {
      console.log('Stopping active containers:', containerIds.join(', '));
      await Promise.all(
        containerIds.map((id) => execAsync(`docker stop ${id}`))
      );
    } else {
      console.log('No active containers found.');
    }

    // Clean up results folder
    await cleanupResults(path.join(cwd, 'results'));

    const options = { cwd, repo, ref, test };

    // Run container based on terminal type
    if (isInteractiveTerminal()) {
      console.log('Running in interactive mode...');
      const exitCode = await runInteractive(options);
      return Promise.resolve(exitCode);
    } else {
      console.log('Running in detached mode...');
      const exitCode = await runDetached(options);
      console.log('returning to ', exitCode)
      return Promise.resolve(exitCode);
    }
  } catch (error) {
    console.error('Error:', error.message);

    if (error.message?.trim() === "Failed to start container with exit code 125") {
      const output = await execAsync('docker ps --filter "ancestor=perf-runner:latest" --format "{{.ID}}"');
      const containerId = output.stdout.trim();

      console.log("/- Recommended Solution: ")
      console.log("|- Run: `docker ps`")
      console.log("|- Find the container with the name 'perf-runner' and take Container ID")
      console.log("|- Run: `docker stop <container-id>` to stop it")
      console.log(`\\- May it can be \`docker stop ${containerId}\` for you`)
    }

    process.exit(1);
  }
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}


export default main;
