import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import os from 'os';
import { performance } from 'perf_hooks';
import { config } from './config.mjs';

/**
 * Run a performance test for a specific configuration
 */
export async function runTest(label, installCommand, testSubfolder) {
  console.log(
    `\n--- Running test for: ${label} - test folder: ${testSubfolder} ---`
  );

  const testTempDir = `${config.tempDir}-${label}-${testSubfolder}`;
  execSync(`rm -rf ${testTempDir} && mkdir -p ${testTempDir}`, {
    stdio: 'inherit',
  });

  process.chdir(testTempDir);
  // Copy test files to the temp directory
  execSync(
    `cp -r ${config.PATH_PREFIX}/${config.TEST_DIR}/${testSubfolder}/* .`,
    {
      stdio: 'inherit',
    }
  );
  // Copy all template files to the templates directory
  execSync('mkdir -p ./templates');
  execSync(`cp ${config.PATH_PREFIX}/${config.TEST_DIR}/*.mjs ./templates/`, {
    stdio: 'inherit',
  });

  execSync('npm i', { stdio: 'inherit' });
  execSync(installCommand, { stdio: 'inherit' });

  const start = performance.now();
  const output = execSync(`node run-test.mjs ${label}`, { encoding: 'utf8' });
  const end = performance.now();

  const result = createResultObject(start, end, output);
  const filename = `result-${label}-${testSubfolder}-${Date.now()}.json`;

  writeFileSync(filename, JSON.stringify(result, null, 2));
  console.log(`Saved result to: ${filename}`);

  if (config.RESULT_UPLOAD_URL) {
    execSync(
      `curl -X POST -H "Content-Type: application/json" -d @${filename} ${config.RESULT_UPLOAD_URL}`
    );
    console.log('Result uploaded.');
  }

  return {
    resultFile: filename,
  };
}

/**
 * Create a result object with performance data
 */
function createResultObject(start, end, output) {
  const result = {
    schemaVersion: '1.0.0',
    timestamp: Date.now(),
    runMetadata: {
      repo: `https://github.com/expressjs/${config.PACKAGE_NAME}`,
      gitRef: process.env.GIT_REF || 'unknown',
      toolSettings: {
        connections: 10,
        duration: 10,
      },
    },
    serverMetadata: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus(),
      totalmem: os.totalmem(),
    },
    clientMetadata: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus(),
    },
    serverResults: {
      executionTimeMs: end - start,
    },
    clientResults: {
      latency: {
        averageMs: 0,
      },
    },
  };

  // Extract autocannon data from output
  const autocannonData = output.match(
    /---start:expf-autocanon-data---([\s\S]*?)---end:expf-autocanon-data---/
  );

  if (!autocannonData) {
    throw new Error('No autocannon data found in output!');
  } else {
    const autocannonOutput = autocannonData[1].trim();
    try {
      const parsedData = JSON.parse(autocannonOutput);
      result.clientResults.latency.averageMs = parsedData.latency.average;
      result.clientResults.requestsPerSecond =
        parsedData.requests.total / (parsedData.duration / 1000);
      result.clientResults.errors = parsedData.errors;
    } catch (error) {
      console.error('Failed to parse autocannon data:', error);
    }
  }

  return result;
}
