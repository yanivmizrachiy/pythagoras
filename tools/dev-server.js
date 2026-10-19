#!/usr/bin/env node
/**
 * שרת פיתוח מקומי ללא תלויות — לתצוגה מקדימה של החוברת, ולעריכת המלל במקום.
 *
 * החוברת מרכיבה את עצמה עם fetch(), ולכן חייבת http(s) — פתיחה כ-file:// לא תעבוד.
 *
 *   node tools/dev-server.js          →  http://localhost:8080
 *   PORT=3000 node tools/dev-server.js
 *
 * מצב עריכת מלל (אופציונלי, מקומי בלבד — לעולם לא נכלל בפרודקשן):
 *   פתחו כל עמוד עם ?edit=1  →  http://localhost:8080/עמוד-9.html?edit=1
 *   לוחצים על טקסט, כותבים, ושומרים. הנוסחאות מוצגות כקוד \(x\) כדי שאפשר לערוך אותן.
 *   השמירה מדויקת (מחליפה רק את הטקסט של האלמנט שנערך) ושומרת גיבוי .bak לצד הקובץ.
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

// ─────────────────────────────────────────────────────────────────────────────
// מצב עריכת מלל — לוגיקה משותפת להגשה ולשמירה.
// בוחרים אלמנטי "עלה־טקסט" (ללא תגיות בנים) של פרוזה: כותרות, שאלות, הערות, פתרונות.
// הבחירה דטרמיניסטית לחלוטין על בתים גולמיים, כך שאותו אינדקס N מצביע על אותו
// אלמנט גם בהגשה וגם בשמירה — בלי לפרסר את כל ה-HTML ובלי תלות חיצונית.
// ─────────────────────────────────────────────────────────────────────────────
const EDIT_TAGS = 'h1|h2|h3|h4|p|div|span|li|figcaption';
const EDITABLE_RE = new RegExp('<(' + EDIT_TAGS + ')\\b([^>]*)>([^<>]+)<\\/\\1>', 'g');
const BLOCK_CLASS_EXACT = new Set([
  'page-number', 'answer-box', 'box-sm', 'box-md', 'box-lg',
  'bullet-num', 'bullet-large', 'solution-space',
]);
const BLOCK_CLASS_PREFIX = [/^pyt-tri/, /^mjx/, /^answer-box/];

function editableClass(attrs) {
  const m = /class="([^"]*)"/.exec(attrs);
  if (!m) return false; // חייבים מחלקה — כדי לא להפוך divים מבניים לעריכים
  const classes = m[1].trim().split(/\s+/).filter(Boolean);
  if (!classes.length) return false;
  for (const c of classes) {
    if (BLOCK_CLASS_EXACT.has(c)) return false;
    if (BLOCK_CLASS_PREFIX.some((re) => re.test(c))) return false;
  }
  return true;
}

function hasEditableContent(text) {
  return /[֐-׿0-9A-Za-z]/.test(text); // יש בו עברית/ספרה/אות — לא רק סימון
}

/** עובר על כל ההתאמות העריכות לפי הסדר ומחזיר [{index, start, end, open, inner}] */
function scanEditable(html) {
  const hits = [];
  let m;
  EDITABLE_RE.lastIndex = 0;
  while ((m = EDITABLE_RE.exec(html)) !== null) {
    const [, , attrs, inner] = m;
    if (!editableClass(attrs)) continue;
    if (!hasEditableContent(inner)) continue;
    const innerStart = m.index + m[0].length - ('</' + m[1] + '>').length - inner.length;
    hits.push({
      index: hits.length,
      openTagEnd: m.index + ('<' + m[1] + attrs).length, // מיקום ה-'>' של תג הפתיחה
      innerStart,
      innerEnd: innerStart + inner.length,
      inner,
    });
  }
  return hits;
}

function htmlEscapeText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** מכין HTML של עמוד למצב עריכה: משבית MathJax, מסמן אלמנטים עריכים, ומזריק את עורך־הטקסט. */
function toEditMode(html) {
  const hits = scanEditable(html);
  // מזריקים data-ed לפי הסדר ההפוך כדי לא לשבש אינדקסים
  let out = html;
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    out = out.slice(0, h.openTagEnd) + ' data-ed="' + h.index + '"' + out.slice(h.openTagEnd);
  }
  // משביתים את טוען ה-MathJax כדי שה-\(...\) יישאר טקסט נייד לעריכה
  out = out.replace(/<script\b[^>]*\bid=["']MathJax-script["'][^>]*>\s*<\/script>/i,
    '<!-- MathJax disabled in edit mode -->');
  // מזריקים את עורך־הטקסט לפני סוף ה-body
  const inject = '\n<link rel="stylesheet" href="/tools/editor-client.css">\n' +
    '<script src="/tools/editor-client.js" defer></script>\n';
  if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, inject + '</body>');
  else out += inject;
  return out;
}

function safePageFile(urlPath) {
  // רק קובצי עמוד של החוברת (עמוד-*.html) בשורש — לא יוצאים מהתיקייה
  const base = path.basename(urlPath);
  if (!/^עמוד-[0-9]+\.html$/.test(base)) return null;
  const fp = path.join(root, base);
  if (fp !== root && !fp.startsWith(root + path.sep)) return null;
  return fp;
}

// ─────────────────────────────────────────────────────────────────────────────
// שמירת עריכות: מחליפה אך ורק את הטקסט הפנימי של האלמנט שנערך (לפי אינדקס),
// כותבת גיבוי .bak-<timestamp>, ומדלגת בבטחה על כל עריכה שלא תואמת (fail-safe).
// ─────────────────────────────────────────────────────────────────────────────
function applyEdits(fileAbs, edits) {
  let html = fs.readFileSync(fileAbs, 'utf8');
  const results = [];
  // ממיינים לפי אינדקס יורד כדי שהחלפות לא יזיזו מיקומים של עריכות אחרות
  const ordered = [...edits].sort((a, b) => b.ed - a.ed);
  let changed = 0;
  for (const e of ordered) {
    const hits = scanEditable(html); // סורקים מחדש אחרי כל שינוי כדי לשמור דיוק מוחלט
    const h = hits.find((x) => x.index === e.ed);
    if (!h) { results.push({ ed: e.ed, ok: false, reason: 'not-found' }); continue; }
    if (typeof e.before === 'string' && h.inner !== e.before) {
      results.push({ ed: e.ed, ok: false, reason: 'stale' }); continue;
    }
    const next = htmlEscapeText(e.after);
    if (next === h.inner) { results.push({ ed: e.ed, ok: true, noop: true }); continue; }
    html = html.slice(0, h.innerStart) + next + html.slice(h.innerEnd);
    changed++;
    results.push({ ed: e.ed, ok: true });
  }
  if (changed > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(fileAbs + '.bak-' + stamp, fs.readFileSync(fileAbs));
    fs.writeFileSync(fileAbs, html, 'utf8');
  }
  return { changed, results };
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let parsed;
  try { parsed = new URL(req.url, 'http://localhost'); }
  catch { res.writeHead(400).end('400 Bad Request'); return; }
  const urlPath = decodeURIComponent(parsed.pathname);

  // ── API שמירה ──────────────────────────────────────────────────────────────
  if (req.method === 'POST' && urlPath === '/api/save-text') {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 2e6) req.destroy(); });
    req.on('end', () => {
      let payload;
      try { payload = JSON.parse(raw); } catch { return sendJson(res, 400, { error: 'bad-json' }); }
      const fileAbs = safePageFile('/' + (payload.file || ''));
      if (!fileAbs || !fs.existsSync(fileAbs)) return sendJson(res, 404, { error: 'no-such-page' });
      if (!Array.isArray(payload.edits) || !payload.edits.length) return sendJson(res, 400, { error: 'no-edits' });
      try {
        const out = applyEdits(fileAbs, payload.edits);
        sendJson(res, 200, { ok: true, file: path.basename(fileAbs), ...out });
      } catch (err) {
        sendJson(res, 500, { error: String(err && err.message || err) });
      }
    });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end('405 Method Not Allowed');
    return;
  }

  let reqPath = urlPath;
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const filePath = path.join(root, reqPath);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    res.writeHead(403).end('403 Forbidden');
    return;
  }

  // ── מצב עריכה: עמוד חוברת עם ?edit=1 ─────────────────────────────────────────
  const editMode = parsed.searchParams.get('edit') === '1';
  const pageFile = editMode ? safePageFile(reqPath) : null;
  if (editMode && pageFile && fs.existsSync(pageFile)) {
    let html;
    try { html = toEditMode(fs.readFileSync(pageFile, 'utf8')); }
    catch (err) { res.writeHead(500).end('500 ' + err.message); return; }
    res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store, max-age=0' });
    res.end(editMode && req.method === 'HEAD' ? '' : html);
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
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(port, () => {
  console.log('חוברת פיתגורס — שרת פיתוח מקומי');
  console.log(`→ תצוגה:  http://localhost:${port}`);
  console.log(`→ עריכה:  http://localhost:${port}/עמוד-9.html?edit=1  (לכל עמוד: הוסיפו ?edit=1)`);
  console.log('לעצירה: Ctrl+C');
});
