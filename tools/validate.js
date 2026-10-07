'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const fail=m=>{console.error('FAIL:',m);process.exitCode=1};
const count=(s,re)=>(s.match(re)||[]).length;

let manifest;
try{manifest=JSON.parse(read('WORKBOOK_MANIFEST.json'))}catch(e){fail('manifest invalid: '+e.message);process.exit(1)}
const pages=Array.isArray(manifest.pages)?manifest.pages:[];
if(manifest.totalPages!==53||pages.length!==53)fail('manifest must contain exactly 53 pages');

const files=pages.map(p=>p.file);
const workbookNumbers=pages.map(p=>p.workbookNumber);
const sourceNumbers=pages.map(p=>p.sourceNumber);
if(new Set(files).size!==53)fail('duplicate page files in manifest');
if(new Set(workbookNumbers).size!==53)fail('duplicate workbookNumber in manifest');
if(new Set(sourceNumbers).size!==53)fail('duplicate sourceNumber in manifest');

for(const [i,p] of pages.entries()){
  if(!/^עמוד-\d+\.html$/u.test(p.file||''))fail('invalid page filename: '+String(p.file));
  if(p.workbookNumber!==i+1)fail(`${p.file}: workbookNumber must be ${i+1}`);
  if(!Number.isInteger(p.sourceNumber))fail(`${p.file}: sourceNumber must be integer`);
  if(!exists(p.file))fail('missing '+p.file);
  const css='styles/pages/'+p.file.replace(/\.html$/u,'.css');
  if(!exists(css))fail('missing '+css);
  const html=exists(p.file)?read(p.file):'';
  const mainCount=count(html,/<main[^>]*class=["'][^"']*\ba4-page\b[^>]*>/giu);
  if(mainCount!==1)fail(`${p.file}: expected exactly one main.a4-page, got ${mainCount}`);

  // Page sources are content-only. The reader + manifest are the only navigation source.
  if(/<nav\s+class=["'][^"']*\bpreview-nav\b/iu.test(html))fail(`${p.file}: legacy preview-nav must not exist in page source`);
  const pageNo=html.match(/<div\s+class=["']page-number["']>\s*(\d+)\s*<\/div>/iu);
  if(!pageNo||Number(pageNo[1])!==p.workbookNumber)fail(`${p.file}: static page-number must equal manifest workbookNumber ${p.workbookNumber}`);

  // Canonical typography and math symbols.
  if(html.includes('×')||/\\times\b/u.test(html))fail(`${p.file}: forbidden multiplication sign; use · or \\cdot`);
  if(html.includes('ס"מ')||html.includes('סמ"ר'))fail(`${p.file}: non-canonical unit typography; use ס״מ / סמ״ר`);
  if(/<span[^>]*dir=["']ltr["'][^>]*>[^<]*x²/iu.test(html))fail(`${p.file}: raw x² remains in formula span; use MathJax`);

  // Mixed number + Hebrew-unit SVG labels must have explicit LTR direction.
  const mixedSvg=[...html.matchAll(/<text([^>]*)>(\s*-?\d+(?:[.,]\d+)?\s+ס״מ\s*)<\/text>/giu)];
  for(const m of mixedSvg)if(!/\bdirection\s*=\s*["']ltr["']/iu.test(m[1]))fail(`${p.file}: SVG unit label must declare direction="ltr": ${m[2].trim()}`);
}

const diskHtml=fs.readdirSync(root).filter(x=>/^עמוד-\d+\.html$/u.test(x)).sort();
const diskCss=fs.readdirSync(path.join(root,'styles','pages')).filter(x=>/^עמוד-\d+\.css$/u.test(x)).sort();
const expectedHtml=[...files].sort();
const expectedCss=files.map(x=>x.replace(/\.html$/u,'.css')).sort();
if(diskHtml.length!==53)fail('disk must contain exactly 53 page HTML files');
if(diskCss.length!==53)fail('disk must contain exactly 53 page CSS files');
for(const x of diskHtml)if(!expectedHtml.includes(x))fail('orphan HTML: '+x);
for(const x of expectedHtml)if(!diskHtml.includes(x))fail('manifest HTML missing on disk: '+x);
for(const x of diskCss)if(!expectedCss.includes(x))fail('orphan CSS: '+x);
for(const x of expectedCss)if(!diskCss.includes(x))fail('manifest CSS missing on disk: '+x);

for(const p of [
  'index.html','book-design.js','book-design.css','ui-controls.css',
  'SOURCE_OF_TRUTH.md','DESIGN.md','README.md','WORKBOOK_MANIFEST.json',
  'pythagoras-workbook.pdf','vendor/mathjax/tex-mml-chtml.js','vercel.json','package.json',
  'styles/topics/pythagoras.css','tools/normalize-pages.js'
]) if(!exists(p))fail('missing core file '+p);

if(exists('pythagoras-workbook.js'))fail('legacy duplicate loader exists');
if(exists('tools/validate-merged.js'))fail('legacy duplicate validator exists');

const runtime=['index.html','book-design.js','book-design.css','ui-controls.css'].map(read).join('\n');
if(runtime.includes('yanivmizrachiy/aaa'))fail('runtime references deleted repo aaa');
if(runtime.includes('https://aaa-pythagoras.vercel.app/WORKBOOK_MANIFEST.json'))fail('runtime uses Vercel URL as content source');
if(!runtime.includes("const SOURCE=new URL('./',document.baseURI).href"))fail('index is not bound to local canonical source');

const featureChecks=[
  ['reader views',"VALID_VIEWS=new Set(['scroll','single','spread'])"],
  ['zoom','const ZOOMS=[.75,.9,1,1.1,1.25]'],
  ['toc','function openToc'],
  ['fullscreen','toggleFullscreen'],
  ['localStorage','localStorage'],
  ['page hash','#page='],
  ['aria pressed','aria-pressed']
];
for(const [name,needle] of featureChecks)if(!runtime.includes(needle))fail('missing reader capability: '+name);

const index=read('index.html');
const ids=[...index.matchAll(/\sid=["']([^"']+)["']/gu)].map(m=>m[1]);
const dup=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];
if(dup.length)fail('duplicate static IDs: '+dup.join(', '));
if(count(index,/id=["']printHost["']/gu)!==1)fail('printHost must exist exactly once');

// Known page-20 ambiguity is guarded explicitly: each operator choice must identify the hypotenuse.
const p20=read('עמוד-650.html');
if(count(p20,/class=["']choice-card["']/gu)!==4)fail('עמוד-650.html: expected four +/− choice cards');
if(count(p20,/class=["']choice-context["']/gu)!==4)fail('עמוד-650.html: every +/− choice must explicitly identify the hypotenuse');
if(!p20.includes('x הוא היתר')||!p20.includes('25 הוא היתר'))fail('עמוד-650.html: +/− choices remain semantically ambiguous');

// Shared rendering guard must own root geometry and RTL SVG labels centrally.
const pytCss=read('styles/topics/pythagoras.css');
for(const needle of [
  '.pyt-foundation .sqrt-cell',
  'border-top: 1.35px solid #334155 !important',
  'border-bottom: 1.1px solid #334155 !important',
  '.pyt-live .pyt-fig-svg .pyt-side',
  'unicode-bidi: isolate'
]) if(!pytCss.includes(needle))fail('shared Pythagoras rendering guard missing: '+needle);

const pdf=fs.statSync(path.join(root,'pythagoras-workbook.pdf'));
if(pdf.size<100000)fail('PDF too small');

const truth=read('SOURCE_OF_TRUTH.md');
if(!truth.includes('מקור האמת היחיד והעליון'))fail('SSOT authority statement missing');
if(!truth.includes('yanivmizrachiy/pythagoras'))fail('canonical repo missing from SSOT');
if(!truth.includes('קובצי `עמוד-*.html` הם **תוכן דף בלבד**'))fail('SSOT must define page files as content-only');
if(!truth.includes('`.sqrt-cell`'))fail('SSOT must define canonical square-root writing component');
if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(truth))fail('SSOT contains control characters');
if(!read('DESIGN.md').includes('SOURCE_OF_TRUTH.md'))fail('DESIGN is not subordinate to SSOT');

const authoritative=fs.readdirSync(root).filter(x=>/^(?:SSOT|RULES|SPEC|REQUIREMENTS)(?:\.|$)/i.test(x));
if(authoritative.length)fail('parallel authority files exist: '+authoritative.join(', '));

const workflows=fs.readdirSync(path.join(root,'.github','workflows')).filter(x=>/\.ya?ml$/i.test(x));
if(workflows.length!==1||workflows[0]!=='validate.yml')fail('there must be exactly one workflow: validate.yml');

const pkg=JSON.parse(read('package.json'));
if(pkg.scripts?.validate!=='node tools/validate.js')fail('package validate script must point to the single validator');
if(pkg.scripts?.smoke!=='node tools/smoke.js')fail('package smoke script missing');

const vercel=JSON.parse(read('vercel.json'));
const dep=vercel.git?.deploymentEnabled||{};
if(dep['gh-pages']!==false)fail('Vercel must ignore gh-pages deployments');
if(dep['unify/*']!==false)fail('Vercel must ignore retired unify branches');
if(typeof vercel.ignoreCommand!=='string'||!vercel.ignoreCommand.includes('git diff --quiet HEAD^ HEAD'))fail('Vercel ignoreCommand must skip docs/CI-only deployments');

if(!process.exitCode)console.log('PASS: canonical Pythagoras — 53/53, one SSOT, content-only pages, canonical math/units/SVG/root rendering, one loader, one validator/workflow, no orphan pages.');
