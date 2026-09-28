#!/usr/bin/env node
/**
 * שרת פיתוח מקומי ללא תלויות — לתצוגה מקדימה של החוברת.
 *
 * החוברת מרכיבה את עצמה עם fetch(), ולכן חייבת http(s) — פתיחה כ-file:// לא תעבוד.
 *
 *   node tools/dev-server.js          →  http://localhost:8080
 *   PORT=3000 node tools/dev-server.js
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end('400 Bad Request'); return; }

  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  const filePath = path.join(root, urlPath);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    res.writeHead(403).end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, max-age=0',
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(port, () => {
  console.log('חוברת פיתגורס — שרת פיתוח מקומי');
  console.log(`→ http://localhost:${port}`);
  console.log('לעצירה: Ctrl+C');
});
