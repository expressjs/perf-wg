export async function requests () {
  return (await import('@expressjs/perf-requests/post-json')).default;
}

export function server () {
  return import('@expressjs/perf-servers-express-body-parser');
}

if (import.meta.main || import.meta.filename === process.argv[1]) {
  await server();
}
