import express from 'express';

export const displayName = 'Example benchmark';

// Do any setup tasks here. ESM cause TLA :)

export default function main () {
  const app = express();
  let n = 1000;
  while (n--) {
    app.use(function(req, res, next){
      next();
    });
  }
}
