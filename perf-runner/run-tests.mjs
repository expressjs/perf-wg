import { config, validateConfig } from './src/config.mjs';
import { getTestFolders } from './src/utils.mjs';
import { runTest } from './src/test-runner.mjs';
import { compareResults } from './src/result-processor.mjs';
import { postComment, generatePRComment } from './src/github-api.mjs';

/**
 * Main orchestration function
 */
async function main() {
  // Validate configuration first
  validateConfig();
  
  const testFolders = getTestFolders(`${config.PATH_PREFIX}/${config.TEST_DIR}`);
  const compareList = [];

  for (const testSubfolder of testFolders) {
    console.log(`\n--- Starting parallel tests for: ${testSubfolder} ---`);

    const latestResult = await runTest(
      'latest',
      `npm install ${config.PACKAGE_NAME}@latest`,
      testSubfolder
    );
    
    const candidateResult = await runTest(
      'candidate',
      `npm install ${config.PATH_PREFIX}`,
      testSubfolder
    );

    console.log(
      `\n--- Comparing results for test folder: ${testSubfolder} ---`
    );
    
    const { output } = compareResults(
      testSubfolder,
      latestResult.resultFile,
      candidateResult.resultFile
    );
    
    compareList.push({
      testSubfolder,
      output,
    });
  }

  if (config.isPR) {
    console.log('\n--- Posting PR comment ---');
    
    const message = generatePRComment(compareList);
    console.log(`Posting comment: ${message}`);
    
    await postComment(message);
    console.log('PR comment posted.');
  } else {
    console.log('\n--- No PR comment posted, running in non-PR mode ---');
  }
}

// Run the main function
main().catch(console.error);
