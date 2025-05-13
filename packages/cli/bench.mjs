export function help () {
  return `$ expf bench

  Run a benchmark test

  Flags:

    --cwd
    --repo=https://github.com/expressjs/perf-wg.git
    --repo-ref=master
    --test=example`;
}

export default function main (_opts = {}) {
  if (_opts.help) {
    console.log(help());
    return;
  }
  return new Promise(async (resolve, reject) => {
    throw new Error('not yet implemented');
  });
};
