export async function requests () {
  return (await import('@expressjs/perf-requests/get-query')).default;
}

export async function server () {
  const start = process.hrtime();
  const express = (await import('express')).default;

  const app = express();
  app.set('query parser', (q) => {
    return new URLSearchParams(q);
  });
  app.get('*path', (req, res) => {
    res.status(200).json({
      hello: 'world!',
      url: req.url,
      headers: req.headers,
      query: req.query
    });
  });

  app.listen(process.env.PORT || 3000, () => {
    console.log(`startup: ${process.hrtime(start)}`);
  });
}

if (import.meta.main || import.meta.filename === process.argv[1]) {
  await server();
}
