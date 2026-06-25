export function help() {
  return 'mock runner for testing';
}

export default async function mockRunner(_opts) {
  return {
    clientResults: [{
      url: 'http://localhost:3000/',
      '2xx': 1000,
      non2xx: 0,
      errors: 0,
      requests: { sent: 1000 },
      latency: { average: 10, max: 50, min: 1, stddev: 5 },
      throughput: { average: 100 },
      duration: 10
    }]
  };
}
