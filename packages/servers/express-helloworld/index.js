const start = process.hrtime();
const express = require('express');

const app = express();
app.get('*path', (req, res) => {
  res.status(200).json({
    hello: 'world!',
    url: req.url,
    headers: req.headers
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`startup: ${process.hrtime(start)}`);
});
