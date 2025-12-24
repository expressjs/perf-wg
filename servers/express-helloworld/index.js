const start = process.hrtime();
const expressVersion = require('express/package.json').version;

let app;
if (process.env.USE_UWS) {
  const uWS = require('uWebSockets.js');
  const expressify = require('uwebsockets-express').default;
  const uwsApp = uWS.App();
  app = expressify(uwsApp);
} else {
  const express = require('express');
  app = express();
}

app.get(expressVersion.startsWith('4.') ? '*' : '*path', (req, res) => {
  res.status(200).json({
    hello: 'world!',
    url: req.url,
    headers: req.headers,
    query: req.query
  });
});
app.use((req, res) => {
  console.log('404:', req.url.toString());
  res.status(404).json({
    what: 'world?',
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
    url: req.url,
    headers: req.headers,
    query: req.query
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`startup: ${process.hrtime(start)}`);
});
