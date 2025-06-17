import core from '@actions/core';

export default async function main () {
  const cwd = core.getInput('cwd');
  core.info(`cwd: ${cwd}`);
  core.setOutput('cwd', cwd);
}

main().catch((error) => {
  console.error(error);
  core.setFailed(error.message);
});
