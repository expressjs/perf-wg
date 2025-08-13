import { readFileSync } from 'fs';
import { config } from './config.mjs';
import { formatTable } from './utils.mjs';

/**
 * Compare performance results between latest and candidate versions
 */
export function compareResults(testSubfolder, latestFile, candidateFile) {
  console.log(`\n--- Comparing results for: ${testSubfolder} ---`);
  console.log(`Latest result file: ${latestFile}`);
  console.log(`Candidate result file: ${candidateFile}`);
  
  const latest = JSON.parse(
    readFileSync(`${config.tempDir}-latest-${testSubfolder}/${latestFile}`, 'utf8')
  );
  const candidate = JSON.parse(
    readFileSync(`${config.tempDir}-candidate-${testSubfolder}/${candidateFile}`, 'utf8')
  );

  const latestTime = latest.serverResults.executionTimeMs;
  const candidateTime = candidate.serverResults.executionTimeMs;

  console.log(`\n## 📊 Performance Comparison (Node.js ${config.NODE_VERSION})\n`);

  // Prepare table data
  const tableData = [];

  // Execution time comparison
  const timeDiff = latestTime - candidateTime;
  const timeRatio = latestTime / candidateTime; // Lower is better, so latest/candidate
  const timeDiffFormatted = timeDiff > 0 ? `+${timeDiff.toFixed(2)} ms` : `${timeDiff.toFixed(2)} ms`;
  const timeStatus = timeDiff > 0 ? '✅ Improved' : timeDiff < 0 ? '❌ Regressed' : '✅ Unchanged';
  
  tableData.push([
    'Execution Time',
    `${latestTime.toFixed(2)} ms`,
    `${candidateTime.toFixed(2)} ms`,
    timeDiffFormatted,
    `×${timeRatio.toFixed(2)}`,
    timeStatus,
  ]);

  // Check if both have autocannon data
  const hasLatestAutocannon = hasAutocannonData(latest);
  const hasCandidateAutocannon = hasAutocannonData(candidate);

  if (hasLatestAutocannon && hasCandidateAutocannon) {
    addAutocannonComparisons(tableData, latest, candidate);
  }

  // Output markdown table
  const headers = [
    'Metric',
    'Latest',
    'Candidate',
    'Difference',
    'Ratio',
    'Status',
  ];

  let output = formatTable(headers, tableData);

  if (!hasLatestAutocannon || !hasCandidateAutocannon) {
    output += '\n*Note: Autocannon data not available for comparison*\n';
  }

  console.log(output);
  return { output };
}

/**
 * Check if result has autocannon data
 */
function hasAutocannonData(result) {
  return result.clientResults &&
         result.clientResults.latency &&
         result.clientResults.requestsPerSecond;
}

/**
 * Add autocannon-specific comparisons to table data
 */
function addAutocannonComparisons(tableData, latest, candidate) {
  // Latency comparison
  const latestLatency = latest.clientResults.latency.averageMs;
  const candidateLatency = candidate.clientResults.latency.averageMs;
  const latencyDiff = latestLatency - candidateLatency;
  const latencyRatio = latestLatency / candidateLatency; // Lower is better
  const latencyDiffFormatted = latencyDiff > 0 ? `+${latencyDiff.toFixed(2)} ms` : `${latencyDiff.toFixed(2)} ms`;
  const latencyStatus = latencyDiff > 0 ? '✅ Improved' : latencyDiff < 0 ? '❌ Regressed' : '✅ Unchanged';

  tableData.push([
    'Average Latency',
    `${latestLatency.toFixed(2)} ms`,
    `${candidateLatency.toFixed(2)} ms`,
    latencyDiffFormatted,
    `×${latencyRatio.toFixed(2)}`,
    latencyStatus,
  ]);

  // Requests per second comparison
  const latestRps = latest.clientResults.requestsPerSecond;
  const candidateRps = candidate.clientResults.requestsPerSecond;
  const rpsDiff = candidateRps - latestRps;
  const rpsRatio = candidateRps / latestRps; // Higher is better
  const rpsDiffFormatted = rpsDiff > 0 ? `+${rpsDiff.toFixed(2)} rps` : `${rpsDiff.toFixed(2)} rps`;
  const rpsStatus = rpsDiff > 0 ? '✅ Improved' : rpsDiff < 0 ? '❌ Regressed' : '✅ Unchanged';

  tableData.push([
    'Requests/Second',
    `${latestRps.toFixed(2)} rps`,
    `${candidateRps.toFixed(2)} rps`,
    rpsDiffFormatted,
    `×${rpsRatio.toFixed(2)}`,
    rpsStatus,
  ]);

  // Errors comparison (if available)
  if (latest.clientResults.errors !== undefined &&
      candidate.clientResults.errors !== undefined) {
    const latestErrors = latest.clientResults.errors;
    const candidateErrors = candidate.clientResults.errors;
    const errorsDiff = candidateErrors - latestErrors;
    const errorsRatio = latestErrors > 0 ? latestErrors / candidateErrors : 'N/A'; // Lower is better
    const errorsDiffFormatted = errorsDiff > 0 ? `+${errorsDiff}` : `${errorsDiff}`;
    const errorsStatus = errorsDiff < 0 ? '✅ Improved' : errorsDiff > 0 ? '❌ Regressed' : '✅ Unchanged';

    tableData.push([
      'Errors',
      latestErrors.toString(),
      candidateErrors.toString(),
      errorsDiffFormatted,
      typeof errorsRatio === 'number' ? `×${errorsRatio.toFixed(2)}` : errorsRatio,
      errorsStatus,
    ]);
  }
}
