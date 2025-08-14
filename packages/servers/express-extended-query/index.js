const start = process.hrtime();
const express = require('express');

const app = express();
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
