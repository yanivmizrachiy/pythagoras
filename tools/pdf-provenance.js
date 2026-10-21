'use strict';
/**
 * Shared, deterministic provenance for the canonical static PDF (SOURCE_OF_TRUTH §8/§8א/§10).
 *
 * The committed `pythagoras-workbook.pdf` is the direct-URL download teachers receive, and it
 * MUST always be rebuilt from the CURRENT print-determining source. `build-static-pdf.js`
 * records the source hash here after a successful build; `validate.js` recomputes it and fails
 * when the PDF is stale. This is the "what the teacher sees is what the teacher downloads" gate:
 * until this existed, CI only ever checked the PDF's page COUNT, so the file silently drifted
 * two weeks behind the live pages.
 *
 * The hash covers everything that determines how the 53 printed A4 pages render. Host-only
 * reader chrome (`ui-controls.css`, `book-design.css`) is deliberately excluded because
 * `@media print` hides it and it never reaches the printed sheet.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROVENANCE_FILE = 'pdf-provenance.json';

/** Every print-determining input, as repo-relative POSIX paths, in a stable OS-independent order. */
function listInputs(root) {
  const inputs = [];
  // The 53 canonical page bodies.
  for (const f of fs.readdirSync(root)) {
    if (/^עמוד-\d+\.html$/u.test(f)) inputs.push(f);
  }
  // Every stylesheet that can reach a printed page (shared + topic + per-page) and the webfont CSS.
  // Orphan sheets, if any, are harmless to include and err on the side of rebuilding.
  for (const dir of ['styles', 'styles/pages', 'styles/topics', 'vendor/fonts']) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      if (f.endsWith('.css')) inputs.push(dir + '/' + f);
    }
  }
  // Page order/identity, the reader that assembles the print host, and the math engine.
  for (const f of ['WORKBOOK_MANIFEST.json', 'index.html', 'book-design.js', 'vendor/mathjax/tex-mml-chtml.js']) {
    if (fs.existsSync(path.join(root, f))) inputs.push(f);
  }
  return [...new Set(inputs)].sort();
}

/**
 * Decode as UTF-8 and strip a leading BOM + all CR bytes, so a Windows build and a Linux CI
 * checkout produce an identical hash regardless of git's autocrlf line-ending handling.
 */
function normalize(buf) {
  let s = buf.toString('utf8');
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s.replace(/\r\n/gu, '\n').replace(/\r/gu, '\n');
}

function computeSourceHash(root) {
  const inputs = listInputs(root);
  const h = crypto.createHash('sha256');
  for (const rel of inputs) {
    h.update(rel, 'utf8');
    h.update('\0');
    h.update(normalize(fs.readFileSync(path.join(root, rel))), 'utf8');
    h.update('\0');
  }
  return { hash: h.digest('hex'), inputs };
}

function readProvenance(root) {
  const p = path.join(root, PROVENANCE_FILE);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

module.exports = { PROVENANCE_FILE, listInputs, computeSourceHash, readProvenance };
