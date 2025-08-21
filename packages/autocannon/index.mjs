import autocannon from 'autocannon';

export function run (opts) {
  return new Promise((resolve, reject) => {
    autocannon(opts, (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result);
    });
  });
}

export default async function main (_opts = {}) {
  const opts = {
    // TODO: maybe we don't want any defaults here?
    // we could move them all up into the cli to keep
    // them centralized in case we have multiple
    // client implementations or runners.
    url: 'http://localhost:3000',
    duration: 60,
    connections: 100,
    ..._opts
  };

  // Override requetst with built in suite of requets
  if (typeof opts.requests === 'string') {
    opts.requests = (await import(opts.requests)).default;
  }

  return run(opts);
}

