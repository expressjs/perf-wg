/**
 * Configuration and environment variable handling
 */

export const config = {
  // Required environment variables
  PACKAGE_NAME: process.env.PACKAGE_NAME,
  NODE_VERSION: process.env.NODE_VERSION,
  
  // Optional environment variables
  TEST_DIR: process.env.TEST_DIR || 'expf-tests',
  RESULT_UPLOAD_URL: process.env.RESULT_UPLOAD_URL,
  PATH_PREFIX: process.env.PATH_PREFIX || '/app',
  
  // PR-related configuration
  PR_ID: process.env.PR_ID || '',
  GITHUB_TOKEN: process.env.COMMENTTOKEN || '',
  REPOSITORY_OWNER: process.env.REPOSITORY_OWNER || '',
  REPOSITORY: process.env.REPOSITORY || '',
  
  // Derived values
  get isPR() {
    return !!this.PR_ID;
  },
  
  get tempDir() {
    return '/tmp/perf-test';
  }
};

/**
 * Validate required configuration
 */
export function validateConfig() {
  console.log('PR', {
    isPR: config.isPR,
    PR_ID: config.PR_ID,
    REPOSITORY_OWNER: config.REPOSITORY_OWNER,
    REPOSITORY: config.REPOSITORY,
    GITHUB_TOKEN: config.GITHUB_TOKEN
      ? config.GITHUB_TOKEN.slice(0, 4) + '... (hidden)'
      : '-NOT FOUND (undefined or null)-',
  });

  if (!config.PACKAGE_NAME) {
    throw new Error('PACKAGE_NAME env var not set!');
  }
  
  if (!config.NODE_VERSION) {
    throw new Error('NODE_VERSION env var not set!');
  }

  if (config.isPR) {
    if (!config.GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN env var must be set for PR runs!');
    }

    if (!config.REPOSITORY_OWNER) {
      throw new Error('REPOSITORY_OWNER env var must be set for PR runs!');
    }

    if (!config.REPOSITORY) {
      throw new Error('REPOSITORY env var must be set for PR runs!');
    }
  }
}
