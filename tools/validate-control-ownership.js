import fs from 'node:fs';

const fail = (msg) => { console.error(`CONTROL_OWNERSHIP_FAIL: ${msg}`); process.exitCode = 1; };
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const sourceTruth = read('SOURCE_OF_TRUTH.md');
const readerJs = read('book-design.js');
const readerCss = read('book-design.css');
const index = read('index.html');

if (!sourceTruth.includes('יש בעלים יחיד לפעולות reader')) fail('SOURCE_OF_TRUTH must lock single reader-control ownership');
if (!sourceTruth.includes('ה-host אינו רשאי להציג סט שני')) fail('SOURCE_OF_TRUTH must forbid a second host control set');

// The embedded reader owns view/navigation/download actions. Its old outer mode area
// must stay hidden in embed mode so the user never sees two control sets.
for (const token of [
  'body.reader-embed .mode-area',
  'body.reader-embed .reader-zoom',
  'body.reader-embed #readerFullscreen',
]) {
  if (!readerCss.includes(token)) fail(`missing embed ownership guard: ${token}`);
}
if (!readerCss.includes('body.reader-embed .reader-download{display:flex!important')) {
  fail('embed must expose exactly the reader-owned download control');
}

// One generated view-mode segment only: scroll/single/spread are owned by readerTools.
for (const mode of ['scroll', 'single', 'spread']) {
  const matches = readerJs.match(new RegExp(`data-reader-view-button=\\"${mode}\\"`, 'g')) || [];
  if (matches.length !== 1) fail(`${mode} view control must be generated exactly once (found ${matches.length})`);
}

// The static shell may own color/mono and print actions, but it must not define a
// second scroll/single/spread segment.
if (/data-reader-view-button/.test(index)) fail('index.html must not define a second reader view segment');

if (!process.exitCode) console.log('CONTROL_OWNERSHIP_OK');
