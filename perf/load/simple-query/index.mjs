import { pathToFileURL } from 'node:url';

export async function requests () {
  return (await import('@expressjs/perf-requests/get-query')).default;
}

export function server () {
  return import('@expressjs/perf-servers-express-helloworld');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await server();
}
