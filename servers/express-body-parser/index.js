const start = process.hrtime();
const express = require('express');
const expressVersion = require('express/package.json').version;

const app = express();
app.use(express.json());
app.use(express.urlencoded());
app.use(express.text());
app.use(express.raw());
app.post(expressVersion.startsWith('4.') ? '*' : '*path', (req, res) => {
  res.status(200).json({
    hello: 'body!',
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body
  });
});
app.use((req, res) => {
  console.log('404:', req.method, req.url.toString());
  res.status(404).json({
    what: 'world?',
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query
  });
});
app.use((err, req, res) => {
  console.log(err);
  console.log('500:', req.url.toString());
  res.status(500).json({
    goodbye: 'cruel world!',
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`startup: ${process.hrtime(start)}`);
});
