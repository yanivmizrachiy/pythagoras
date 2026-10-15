const fs = require('node:fs');
const path = require('node:path');

const fail = (msg) => { console.error(`CONTROL_OWNERSHIP_FAIL: ${msg}`); process.exitCode = 1; };
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const sourceTruth = read('SOURCE_OF_TRUTH.md');
const readerJs = read('book-design.js');
const controlsCss = read('ui-controls.css');
const index = read('index.html');

if (!sourceTruth.includes('יש בעלים יחיד לפעולות reader')) fail('SOURCE_OF_TRUTH must lock single reader-control ownership');
if (!sourceTruth.includes('ה-host אינו רשאי להציג סט שני')) fail('SOURCE_OF_TRUTH must forbid a second host control set');

// The embedded reader owns view/navigation/download actions. ui-controls.css is the
// canonical host-control stylesheet loaded by book-design.js; embed mode must hide the
// old outer controls so the user never sees two action sets.
for (const token of [
  'body.reader-embed .mode-area',
  'body.reader-embed .reader-zoom',
  'body.reader-embed #readerFullscreen',
]) {
  if (!controlsCss.includes(token)) fail(`missing embed ownership guard: ${token}`);
}
if (!controlsCss.includes('body.reader-embed .reader-download{display:flex!important')) {
  fail('embed must expose exactly the reader-owned download control');
}

// One generated view-mode segment only: scroll/single/spread are owned by readerTools.
for (const mode of ['scroll', 'single', 'spread']) {
  const matches = readerJs.match(new RegExp(`data-reader-view-button="${mode}"`, 'g')) || [];
  if (matches.length !== 1) fail(`${mode} view control must be generated exactly once (found ${matches.length})`);
}

// The static shell may own color/mono and print actions, but it must not define a
// second scroll/single/spread segment.
if (/data-reader-view-button/.test(index)) fail('index.html must not define a second reader view segment');

if (!process.exitCode) console.log('CONTROL_OWNERSHIP_OK');
