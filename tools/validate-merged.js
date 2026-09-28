const fs=require("fs");
const path=require("path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const exists=p=>fs.existsSync(path.join(root,p));
const fail=m=>{console.error("FAIL:",m);process.exitCode=1};

let manifest;
try{manifest=JSON.parse(read("WORKBOOK_MANIFEST.json"))}catch(e){fail("manifest invalid: "+e.message);process.exit(1)}

if(manifest.totalPages!==53)fail("totalPages must be 53");
if(!Array.isArray(manifest.pages)||manifest.pages.length!==53)fail("manifest must contain exactly 53 pages");

const files=manifest.pages.map(p=>p.file);
if(new Set(files).size!==53)fail("duplicate page files in manifest");

manifest.pages.forEach((p,i)=>{
  if(p.workbookNumber!==i+1)fail(`${p.file}: workbookNumber must be ${i+1}`);
  if(!exists(p.file))fail(`missing ${p.file}`);
  const css=`styles/pages/${p.file.replace(/\.html$/u,".css")}`;
  if(!exists(css))fail(`missing ${css}`);
  const html=exists(p.file)?read(p.file):"";
  if(!/<main[^>]*\ba4-page\b/u.test(html))fail(`${p.file}: missing a4-page`);
});

for(const p of [
 "index.html","book-design.js","book-design.css","ui-controls.css",
 "SOURCE_OF_TRUTH.md","WORKBOOK_MANIFEST.json","pythagoras-workbook.pdf",
 "vendor/mathjax/tex-mml-chtml.js"
]) if(!exists(p)) fail(`missing core file ${p}`);

if(exists("pythagoras-workbook.js"))fail("duplicate legacy public loader pythagoras-workbook.js still exists");

const runtime=["index.html","book-design.js","book-design.css","ui-controls.css"]
  .map(p=>read(p)).join("\n");

if(runtime.includes("https://aaa-pythagoras.vercel.app"))fail("runtime still depends on donor Vercel URL");
if(!runtime.includes("SOURCE=new URL('./',document.baseURI).href"))fail("reader is not bound to local canonical source");

const index=read("index.html");
const ids=[...index.matchAll(/\sid=["']([^"']+)["']/gu)].map(m=>m[1]);
const duplicates=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];
if(duplicates.length)fail("duplicate IDs: "+duplicates.join(", "));

const pdf=fs.statSync(path.join(root,"pythagoras-workbook.pdf"));
if(pdf.size<100000)fail("PDF too small");

const truth=read("SOURCE_OF_TRUTH.md");
if(!truth.includes("yanivmizrachiy/pythagoras"))fail("merged SSOT does not identify canonical repo");
if(!truth.includes("אין יותר הפרדה"))fail("merged SSOT missing consolidation decision");

if(!process.exitCode)console.log("PASS: unified Pythagoras — 53/53 pages, one runtime, local content, PDF present");
