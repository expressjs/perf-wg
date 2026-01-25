const start = process.hrtime();

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

app.set('query parser', 'extended');
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
