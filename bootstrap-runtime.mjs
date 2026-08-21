import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const CANONICAL_COMMIT = '405696a512417922e09eb7720400157782a13399';
const BASE = `https://raw.githubusercontent.com/yanivmizrachiy/pythagoras/${CANONICAL_COMMIT}/.canonical`;
const EXPECTED_SHA = 'b4c7806d2dade3e390401fb4f53d6b0d7b568b8c08964221067d2e1742efb453';
const repoRoot = process.cwd();

function run(cmd, args, cwd = process.cwd()) {
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, CI: '1' } });
  if (result.status !== 0) throw new Error(`${cmd} failed with exit code ${result.status}`);
}

async function fetchText(url) {
  const response = await fetch(url, { redirect: 'follow', cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`);
  return response.text();
}

function walk(root, predicate, current = root, out = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) walk(root, predicate, full, out);
    else if (entry.isFile() && predicate(full, entry.name)) out.push(path.relative(root, full).replaceAll(path.sep, '/'));
  }
  return out;
}

function htmlFiles(root) {
  return walk(root, (_full, name) => name.toLowerCase().endsWith('.html'));
}

function ensureRootIndex(distDir) {
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) return;
  const html = htmlFiles(distDir).filter((p) => p !== 'index.html');
  if (!html.length) throw new Error('Build produced no HTML files');
  const score = (p) => {
    const lower = p.toLowerCase();
    if (lower === 'workbook.html' || lower.endsWith('/workbook.html')) return 0;
    if (/(^|\/)(page[-_ ]?0*1|0*1)(\/|$)/.test(lower)) return 1;
    if (lower === 'main.html' || lower.endsWith('/main.html')) return 2;
    return 3;
  };
  html.sort((a, b) => score(a) - score(b) || a.localeCompare(b, 'en'));
  const target = html[0];
  const escaped = target.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  fs.writeFileSync(indexPath, `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${escaped}"><title>משפט פיתגורס</title></head><body><p><a href="${escaped}">פתיחת דפי משפט פיתגורס</a></p></body></html>`, 'utf8');
  console.log(`Created root index redirect -> ${target}`);
}

let encoded = '';
for (let i = 0; i < 4; i++) {
  const name = `part-${String(i).padStart(3, '0')}`;
  const part = await fetchText(`${BASE}/${name}`);
  if (!part.trim()) throw new Error(`Canonical ${name} is empty`);
  encoded += part.trim();
  console.log(`Fetched ${name}: ${part.trim().length} chars`);
}

const archive = Buffer.from(encoded.replace(/\s+/g, ''), 'base64');
const sha = crypto.createHash('sha256').update(archive).digest('hex');
if (sha !== EXPECTED_SHA) throw new Error(`Canonical SHA mismatch: ${sha}`);
console.log(`Verified canonical bundle bytes SHA-256 ${sha}`);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pythagoras-canonical-'));
const sourceDir = path.join(tempRoot, 'source');
const archivePath = path.join(tempRoot, 'pythagoras.tar.gz');
fs.mkdirSync(sourceDir);
fs.writeFileSync(archivePath, archive);
run('tar', ['-xzf', archivePath, '-C', sourceDir]);

for (const required of ['SOURCE_OF_TRUTH.md', 'package.json']) {
  if (!fs.existsSync(path.join(sourceDir, required))) throw new Error(`${required} missing from canonical source`);
}
const pagesRoot = path.join(sourceDir, 'src', 'pages');
if (!fs.existsSync(pagesRoot)) throw new Error('src/pages missing from canonical source');
const pageFiles = walk(pagesRoot, (_full, name) => name === 'main.html');
if (pageFiles.length !== 53) throw new Error(`Expected 53 Pythagoras pages, found ${pageFiles.length}`);
const fontsRoot = path.join(sourceDir, 'src', 'shared', 'fonts');
const fontFiles = fs.existsSync(fontsRoot) ? walk(fontsRoot, (full, name) => name.endsWith('.woff2') && fs.statSync(full).size > 1000) : [];
if (fontFiles.length < 4) throw new Error(`Expected at least 4 valid fonts, found ${fontFiles.length}`);
console.log(`Verified canonical workbook structure: ${pageFiles.length} pages, ${fontFiles.length} fonts`);

run('npm', ['install', '--no-audit', '--no-fund'], sourceDir);
run('npm', ['run', 'check'], sourceDir);
run('npm', ['run', 'build'], sourceDir);
run('npm', ['run', 'typecheck'], sourceDir);

const builtDist = path.join(sourceDir, 'dist');
if (!fs.existsSync(builtDist) || !htmlFiles(builtDist).length) throw new Error('dist HTML output missing after build');
const targetDist = path.join(repoRoot, 'dist');
fs.rmSync(targetDist, { recursive: true, force: true });
fs.cpSync(builtDist, targetDist, { recursive: true });
ensureRootIndex(targetDist);
console.log(`Pythagoras verified build ready: ${htmlFiles(targetDist).length} HTML files`);
