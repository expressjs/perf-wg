const start = process.hrtime();
const path = require('node:path');
const express = require('express');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.listen(process.env.PORT || 3000, () => {
  console.log(`startup: ${process.hrtime(start)}`);
});
