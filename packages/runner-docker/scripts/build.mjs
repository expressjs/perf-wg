#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import process from 'process';

const execAsync = async (cmd, opts) => {
  console.log(`Executing: ${cmd}`);
  return promisify(exec)(cmd, opts);
};

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
    // macOS
    try {
      await execAsync('open /Applications/Docker.app');
      console.log('Started Docker Desktop on macOS. Please wait for it to initialize...');
    } catch (error) {
      console.log('Could not auto-start Docker on macOS. Please start Docker Desktop manually.');
    }
  } else if (platform === 'win32') {
    // Windows
    try {
      await execAsync('start "" "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"');
      console.log('Started Docker Desktop on Windows. Please wait for it to initialize...');
    } catch (error) {
      console.log('Could not auto-start Docker on Windows. Please start Docker Desktop manually.');
      console.log('You can start Docker Desktop from the Start menu or by running:');
      console.log('  "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"');
    }
  } else {
    // Linux - usually runs as a service
    try {
      await execAsync('sudo systemctl start docker');
      console.log('Started Docker service on Linux.');
    } catch (error) {
      console.log('Could not start Docker service. Please start Docker manually or check your installation.');
      console.log('You may need to run: sudo systemctl start docker');
    }
  }
}

/**
 * Wait for Docker to be ready
 */
async function waitForDocker() {
  console.log('Waiting for Docker to launch...');
  
  while (!(await isDockerRunning())) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.stdout.write('.');
  }
  console.log('\nDocker is ready!');
}

/**
 * Build the Docker image
 */
async function buildImage() {
  console.log('Building Docker image...');
  
  return new Promise((resolve, reject) => {
    const build = spawn('docker', ['build', '.', '--tag', 'perf-runner:latest'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    build.on('close', (code) => {
      if (code === 0) {
        console.log('Docker image built successfully!');
        resolve();
      } else {
        reject(new Error(`Docker build failed with exit code ${code}`));
      }
    });
    
    build.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Starting Docker build process...');
    
    // Check if Docker is running
    if (!(await isDockerRunning())) {
      await startDocker();
      await waitForDocker();
    } else {
      console.log('Docker is already running!');
    }
    
    // Build the image
    await buildImage();
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if this script is executed directly
main();

export default main;
