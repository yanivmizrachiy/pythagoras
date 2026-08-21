import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const SOURCE = 'https://pythagoras-runtime-cache.vercel.app';
const EXPECTED_SHA = '5c41e13b7d93fb63c138efa1b3508e5b6c2a5dbd2d122d2882a2aef7e1c38c2e';
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

function collectPackageRoots(root, current = root, depth = 0, out = []) {
  if (depth > 5) return out;
  if (fs.existsSync(path.join(current, 'package.json'))) out.push(current);
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git') continue;
    collectPackageRoots(root, path.join(current, entry.name), depth + 1, out);
  }
  return out;
}

function chooseProjectRoot(root) {
  const candidates = collectPackageRoots(root);
  if (!candidates.length) throw new Error('No package.json found in verified runtime archive');
  const scored = candidates.map((dir) => {
    let pkg = {};
    try { pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch {}
    let score = 0;
    if (fs.existsSync(path.join(dir, 'src', 'pages'))) score += 100;
    if (fs.existsSync(path.join(dir, 'SOURCE_OF_TRUTH.md'))) score += 50;
    if (pkg?.scripts?.build) score += 25;
    score -= path.relative(root, dir).split(path.sep).filter(Boolean).length;
    return { dir, score, hasBuild: Boolean(pkg?.scripts?.build) };
  }).sort((a, b) => b.score - a.score);
  console.log('Runtime package candidates:', scored.map((x) => `${path.relative(root, x.dir) || '.'}:${x.score}`).join(', '));
  const chosen = scored.find((x) => x.hasBuild) || scored[0];
  console.log('Chosen runtime project root:', path.relative(root, chosen.dir) || '.');
  return chosen.dir;
}

function walkHtml(root, current = root, out = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) walkHtml(root, full, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) out.push(path.relative(root, full).replaceAll(path.sep, '/'));
  }
  return out;
}

function findBuiltDist(projectRoot) {
  const direct = path.join(projectRoot, 'dist');
  if (fs.existsSync(direct) && walkHtml(direct).length) return direct;
  const queue = [{ dir: projectRoot, depth: 0 }];
  while (queue.length) {
    const { dir, depth } = queue.shift();
    if (depth > 4) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if ((entry.name === 'dist' || entry.name === 'build' || entry.name === 'out') && walkHtml(full).length) return full;
      queue.push({ dir: full, depth: depth + 1 });
    }
  }
  throw new Error('No built HTML output directory found after build');
}

function ensureRootIndex(distDir) {
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) return;
  const html = walkHtml(distDir).filter((p) => p !== 'index.html');
  if (!html.length) throw new Error('Build produced no HTML files');
  const score = (p) => {
    const lower = p.toLowerCase();
    if (lower.endsWith('/workbook.html') || lower === 'workbook.html') return 0;
    if (/(^|\/)(page[-_ ]?0*1|0*1)(\/|$)/.test(lower)) return 1;
    if (lower.endsWith('/main.html') || lower === 'main.html') return 2;
    return 3;
  };
  html.sort((a, b) => score(a) - score(b) || a.localeCompare(b, 'en'));
  const target = html[0];
  const escaped = target.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  fs.writeFileSync(indexPath, `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${escaped}"><title>משפט פיתגורס</title></head><body><p><a href="${escaped}">פתיחת דפי משפט פיתגורס</a></p></body></html>`, 'utf8');
  console.log(`Created root index redirect -> ${target}`);
}

const manifest = JSON.parse(await fetchText(`${SOURCE}/`));
if (manifest.archiveSha256 !== EXPECTED_SHA) throw new Error(`Runtime source changed unexpectedly: ${manifest.archiveSha256}`);
if (!Array.isArray(manifest.parts) || manifest.parts.length !== 51) throw new Error(`Expected 51 runtime source parts, got ${manifest.parts?.length ?? 'none'}`);

let base64 = '';
for (const part of manifest.parts) {
  const text = (await fetchText(`${SOURCE}/${encodeURIComponent(part.name)}`)).trim();
  if (text.length !== part.length) throw new Error(`${part.name}: expected ${part.length} chars, got ${text.length}`);
  base64 += text;
}
if (base64.length !== manifest.base64Length) throw new Error(`Base64 length mismatch: ${base64.length} != ${manifest.base64Length}`);

const archive = Buffer.from(base64, 'base64');
if (archive.length !== manifest.archiveBytes) throw new Error(`Archive size mismatch: ${archive.length} != ${manifest.archiveBytes}`);
const sha = crypto.createHash('sha256').update(archive).digest('hex');
if (sha !== EXPECTED_SHA) throw new Error(`Archive SHA mismatch: ${sha}`);
console.log(`Verified runtime archive SHA-256 ${sha}`);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pythagoras-src-'));
const archivePath = path.join(tempRoot, 'source.tar.xz');
const sourceDir = path.join(tempRoot, 'source');
fs.mkdirSync(sourceDir);
fs.writeFileSync(archivePath, archive);
run('tar', ['-xJf', archivePath, '-C', sourceDir]);

const projectRoot = chooseProjectRoot(sourceDir);
run('npm', ['install', '--no-audit', '--no-fund'], projectRoot);
run('npm', ['run', 'build'], projectRoot);

const builtDist = findBuiltDist(projectRoot);
console.log('Using built output:', path.relative(projectRoot, builtDist) || '.');
const targetDist = path.join(repoRoot, 'dist');
fs.rmSync(targetDist, { recursive: true, force: true });
fs.cpSync(builtDist, targetDist, { recursive: true });
ensureRootIndex(targetDist);
console.log(`Pythagoras production build ready from ${EXPECTED_SHA}`);
