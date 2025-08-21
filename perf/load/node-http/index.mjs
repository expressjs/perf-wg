export async function requests () {
  return (await import('@expressjs/perf-requests/get-basic-paths')).default;
}

export function server () {
  return import('@expressjs/perf-servers/node-http');
}

if (import.meta.main || import.meta.filename === process.argv[1]) {
  await server();
}
