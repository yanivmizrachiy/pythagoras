'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'WORKBOOK_MANIFEST.json'),'utf8'));
const pages=Array.isArray(manifest.pages)?manifest.pages:[];
let changed=0;

function normalizeUnits(s){
  return s
    .replaceAll('ס"מ','ס״מ')
    .replaceAll('סמ"ר','סמ״ר')
    .replaceAll('חט"ב','חט״ב')
    .replaceAll('מנח"י','מנח״י');
}

function addLtrToSvgUnitLabels(s){
  return s.replace(/<text([^>]*)>(\s*-?\d+(?:[.,]\d+)?\s+ס״מ\s*)<\/text>/giu,(m,attrs,text)=>{
    if(/\bdirection\s*=\s*["']ltr["']/iu.test(attrs)) return m;
    return `<text${attrs} direction="ltr">${text}</text>`;
  });
}

function fixPage20(s){
  const oldBlock=`      <div class="page20-choice-grid" dir="ltr">
        <div class="choice-card">x² = 9² <span class="operation-fill"></span> 12²</div>
        <div class="choice-card">x² = 25² <span class="operation-fill"></span> 7²</div>
        <div class="choice-card">x² = 20² <span class="operation-fill"></span> 21²</div>
        <div class="choice-card">x² = 25² <span class="operation-fill"></span> 24²</div>
      </div>`;
  const newBlock=`      <div class="page20-choice-grid">
        <div class="choice-card"><span class="choice-context">x הוא היתר</span><span class="choice-equation" dir="ltr"><span>\\(x^2=9^2\\)</span><span class="operation-fill" aria-label="מקום לסימן חיבור או חיסור"></span><span>\\(12^2\\)</span></span></div>
        <div class="choice-card"><span class="choice-context">25 הוא היתר</span><span class="choice-equation" dir="ltr"><span>\\(x^2=25^2\\)</span><span class="operation-fill" aria-label="מקום לסימן חיבור או חיסור"></span><span>\\(7^2\\)</span></span></div>
        <div class="choice-card"><span class="choice-context">x הוא היתר</span><span class="choice-equation" dir="ltr"><span>\\(x^2=20^2\\)</span><span class="operation-fill" aria-label="מקום לסימן חיבור או חיסור"></span><span>\\(21^2\\)</span></span></div>
        <div class="choice-card"><span class="choice-context">25 הוא היתר</span><span class="choice-equation" dir="ltr"><span>\\(x^2=25^2\\)</span><span class="operation-fill" aria-label="מקום לסימן חיבור או חיסור"></span><span>\\(24^2\\)</span></span></div>
      </div>`;
  s=s.replace(oldBlock,newBlock);
  s=s.replace('<span dir="ltr">x²=25²+24²</span>','<span dir="ltr">\\(x^2=25^2+24^2\\)</span>');
  s=s.replace('<span dir="ltr">x²=20²+21²</span>','<span dir="ltr">\\(x^2=20^2+21^2\\)</span>');
  s=s.replace('<span dir="ltr">x²=25²−24²</span>','<span dir="ltr">\\(x^2=25^2-24^2\\)</span>');
  return s;
}

function fixRawMath(file,s){
  if(file==='עמוד-647.html'){
    s=s.replace('<span dir="ltr">x²=10²+6²</span>','<span dir="ltr">\\(x^2=10^2+6^2\\)</span>');
    s=s.replace('<span dir="ltr">x²=9²+12²=225</span><span>ולכן x²=15.</span>','<span dir="ltr">\\(x^2=9^2+12^2=225\\)</span><span>ולכן \\(x^2=15\\).</span>');
  }
  if(file==='עמוד-649.html'){
    s=s.replace('<span dir="ltr">x² = 8²−10²</span>','<span dir="ltr">\\(x^2=8^2-10^2\\)</span>');
  }
  if(file==='עמוד-650.html') s=fixPage20(s);
  return s;
}

for(const meta of pages){
  const file=meta.file;
  const abs=path.join(root,file);
  let s=fs.readFileSync(abs,'utf8');
  const before=s;

  // דפי התוכן הם תוכן בלבד. כל ניווט החוברת מגיע מה-reader ומה-manifest היחיד.
  s=s.replace(/<nav\s+class=["']preview-nav["'][\s\S]*?<\/nav>\s*/giu,'');

  // המספור הסטטי נשמר מסונכרן גם בפתיחה ישירה של קובץ העמוד.
  s=s.replace(/<div\s+class=["']page-number["']>\s*\d+\s*<\/div>/iu,`<div class="page-number">${meta.workbookNumber}</div>`);
  s=s.replace(/<title>עמוד\s+\d+(\s+—)/u,`<title>עמוד ${meta.workbookNumber}$1`);

  s=normalizeUnits(s);
  s=addLtrToSvgUnitLabels(s);
  s=fixRawMath(file,s);

  if(s!==before){
    fs.writeFileSync(abs,s,'utf8');
    changed++;
    console.log('NORMALIZED',file);
  }
}

console.log(`PASS normalize: ${pages.length} pages scanned, ${changed} files changed.`);
