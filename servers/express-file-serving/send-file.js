const start = process.hrtime();
const path = require('node:path');
const express = require('express');

const file = path.join(__dirname, 'public', 'index.html');
const app = express();
app.get('/index.html', (req, res) => {
  res.sendFile(file);
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`startup: ${process.hrtime(start)}`);
});
