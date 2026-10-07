#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const puppeteer=require('puppeteer-core');

const executablePath=process.env.CHROME_BIN;
if(!executablePath)throw new Error('CHROME_BIN is required');

const root=path.resolve(__dirname,'..');
const output=path.join(root,'pythagoras-workbook.pdf');
const base=process.env.PYTHAGORAS_BASE_URL||'http://127.0.0.1:8080/';

(async()=>{
  const browser=await puppeteer.launch({
    executablePath,
    headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']
  });
  try{
    const page=await browser.newPage();
    await page.setViewport({width:1280,height:900,deviceScaleFactor:1});

    // The app's canonical print path prepares all 53 pages, applies all page/topic styles,
    // and typesets MathJax. Replace only the native dialog so headless Chrome can capture it.
    await page.evaluateOnNewDocument(()=>{
      window.print=()=>{window.__PYTHAGORAS_PRINT_READY__=true};
    });

    await page.goto(base,{waitUntil:'networkidle0',timeout:120000});
    await page.waitForFunction(()=>{
      return document.querySelectorAll('#app .scroll-sheet').length===53
        && !!document.getElementById('printColor')
        && !!window.PythagorasReader;
    },{timeout:120000});

    // printColor lives inside a collapsed menu, so a physical Puppeteer click is intentionally
    // unavailable. Dispatch the same native DOM click to the already-bound canonical handler.
    await page.evaluate(()=>document.getElementById('printColor').click());
    await page.waitForFunction(()=>{
      const host=document.getElementById('printHost');
      return window.__PYTHAGORAS_PRINT_READY__===true
        && host
        && host.querySelectorAll('.print-page').length===53
        && host.querySelectorAll('.print-page .a4-page').length===53;
    },{timeout:180000});

    await page.evaluate(async()=>{
      if(document.fonts?.ready)await document.fonts.ready;
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    });

    const qa=await page.evaluate(()=>{
      const host=document.getElementById('printHost');
      const roots=[...host.querySelectorAll('.sqrt-cell')];
      const rootGeometryOk=roots.length>0&&roots.every(cell=>{
        const radic=cell.querySelector('.radic');
        const line=cell.querySelector('.root-line,.root-work-fill');
        if(!radic||!line)return false;
        const c=getComputedStyle(cell),r=getComputedStyle(radic),l=getComputedStyle(line);
        const cb=cell.getBoundingClientRect(),rb=radic.getBoundingClientRect(),lb=line.getBoundingClientRect();
        return c.direction==='ltr'
          && parseFloat(l.borderTopWidth)>=1
          && parseFloat(l.borderBottomWidth)>=1
          && parseFloat(r.fontSize)>=20
          && rb.right>=lb.left-3
          && Math.abs(cb.top-lb.top)<8;
      });
      const unitLabels=[...host.querySelectorAll('svg text')].filter(x=>/\d+(?:[.,]\d+)?\s+ס״מ/u.test(x.textContent||''));
      const svgUnitsOk=unitLabels.length>0&&unitLabels.every(x=>getComputedStyle(x).direction==='ltr'||x.getAttribute('direction')==='ltr');
      return {
        pages:host.querySelectorAll('.print-page').length,
        a4:host.querySelectorAll('.print-page .a4-page').length,
        rawLatex:/\\\(|\\\[/.test(host.textContent||''),
        legacyNav:host.querySelectorAll('.preview-nav').length,
        rootCells:roots.length,
        rootGeometryOk,
        unitLabels:unitLabels.length,
        svgUnitsOk,
        choiceContexts:host.querySelectorAll('.page-650 .choice-context').length
      };
    });
    if(qa.pages!==53||qa.a4!==53)throw new Error(`print host incomplete: ${JSON.stringify(qa)}`);
    if(qa.rawLatex)throw new Error('raw LaTeX remains in print host');
    if(qa.legacyNav)throw new Error('legacy preview-nav leaked into print host');
    if(!qa.rootGeometryOk)throw new Error(`square-root geometry failed before PDF capture: ${JSON.stringify(qa)}`);
    if(!qa.svgUnitsOk)throw new Error(`SVG unit direction failed before PDF capture: ${JSON.stringify(qa)}`);
    if(qa.choiceContexts!==4)throw new Error(`page 20 operator choices are not fully disambiguated: ${JSON.stringify(qa)}`);

    await page.emulateMediaType('print');
    await page.pdf({
      path:output,
      printBackground:true,
      preferCSSPageSize:true,
      margin:{top:'0',right:'0',bottom:'0',left:'0'}
    });

    const size=fs.statSync(output).size;
    if(size<100000)throw new Error(`generated PDF suspiciously small: ${size}`);
    console.log(`PASS static PDF generated from canonical reader: ${output} (${size} bytes)`);
    console.log(`PASS pre-PDF visual guards: ${qa.rootCells} roots, ${qa.unitLabels} SVG unit labels, ${qa.choiceContexts} page-20 contexts`);
    await page.close();
  }finally{
    await browser.close();
  }
})().catch(err=>{
  console.error(err);
  process.exit(1);
});
