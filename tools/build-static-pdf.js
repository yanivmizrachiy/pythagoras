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
  const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
  try{
    const page=await browser.newPage();
    await page.setViewport({width:1280,height:900,deviceScaleFactor:1});
    await page.evaluateOnNewDocument(()=>{window.print=()=>{window.__PYTHAGORAS_PRINT_READY__=true}});
    await page.goto(base,{waitUntil:'networkidle0',timeout:120000});
    await page.waitForFunction(()=>document.querySelectorAll('#app .scroll-sheet').length===53&&!!document.getElementById('printColor')&&!!window.PythagorasReader,{timeout:120000});
    await page.evaluate(()=>document.getElementById('printColor').click());
    await page.waitForFunction(()=>{const h=document.getElementById('printHost');return window.__PYTHAGORAS_PRINT_READY__===true&&h&&h.querySelectorAll('.print-page').length===53&&h.querySelectorAll('.print-page .a4-page').length===53},{timeout:180000});
    await page.evaluate(async()=>{if(document.fonts?.ready)await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});

    const qa=await page.evaluate(()=>{
      const host=document.getElementById('printHost');
      const roots=[...host.querySelectorAll('.sqrt-cell')];
      const rootFailures=[];
      roots.forEach((cell,index)=>{
        const radic=cell.querySelector('.radic');
        const line=cell.querySelector('.root-line,.root-work-fill');
        const pageEl=cell.closest('.a4-page');
        const pageClass=pageEl?[...pageEl.classList].find(x=>/^page-/u.test(x)):'unknown';
        if(!radic||!line){rootFailures.push({index,page:pageClass,reason:'missing-child',html:cell.outerHTML});return}
        const c=getComputedStyle(cell),r=getComputedStyle(radic),l=getComputedStyle(line);
        const cb=cell.getBoundingClientRect(),rb=radic.getBoundingClientRect(),lb=line.getBoundingClientRect();
        const checks={
          direction:c.direction==='ltr',
          topBorder:parseFloat(l.borderTopWidth)>=1,
          bottomBorder:parseFloat(l.borderBottomWidth)>=1,
          fontSize:parseFloat(r.fontSize)>=20,
          touching:rb.right>=lb.left-3,
          topAlign:Math.abs(cb.top-lb.top)<8
        };
        if(Object.values(checks).some(v=>!v))rootFailures.push({index,page:pageClass,checks,cell:{x:cb.x,y:cb.y,w:cb.width,h:cb.height},radic:{x:rb.x,y:rb.y,w:rb.width,h:rb.height,font:r.fontSize},line:{x:lb.x,y:lb.y,w:lb.width,h:lb.height,top:l.borderTopWidth,bottom:l.borderBottomWidth,marginTop:l.marginTop},html:cell.outerHTML});
      });
      const unitLabels=[...host.querySelectorAll('svg text')].filter(x=>/\d+(?:[.,]\d+)?\s+ס״מ/u.test(x.textContent||''));
      const badUnits=unitLabels.filter(x=>!(getComputedStyle(x).direction==='ltr'||x.getAttribute('direction')==='ltr')).map(x=>({page:[...(x.closest('.a4-page')?.classList||[])].find(c=>/^page-/u.test(c)),text:x.textContent,dir:getComputedStyle(x).direction,attr:x.getAttribute('direction')}));
      return {pages:host.querySelectorAll('.print-page').length,a4:host.querySelectorAll('.print-page .a4-page').length,rawLatex:/\\\(|\\\[/.test(host.textContent||''),legacyNav:host.querySelectorAll('.preview-nav').length,rootCells:roots.length,rootFailures,unitLabels:unitLabels.length,badUnits,choiceContexts:host.querySelectorAll('.page-650 .choice-context').length};
    });
    if(qa.pages!==53||qa.a4!==53)throw new Error(`print host incomplete: ${JSON.stringify(qa)}`);
    if(qa.rawLatex)throw new Error('raw LaTeX remains in print host');
    if(qa.legacyNav)throw new Error('legacy preview-nav leaked into print host');
    if(qa.rootFailures.length)throw new Error(`square-root geometry failures: ${JSON.stringify(qa.rootFailures)}`);
    if(qa.badUnits.length)throw new Error(`SVG unit direction failures: ${JSON.stringify(qa.badUnits)}`);
    if(qa.choiceContexts!==4)throw new Error(`page 20 operator choices are not fully disambiguated: ${JSON.stringify(qa)}`);

    await page.emulateMediaType('print');
    await page.pdf({path:output,printBackground:true,preferCSSPageSize:true,margin:{top:'0',right:'0',bottom:'0',left:'0'}});
    const size=fs.statSync(output).size;
    if(size<100000)throw new Error(`generated PDF suspiciously small: ${size}`);
    console.log(`PASS static PDF generated from canonical reader: ${output} (${size} bytes)`);
    console.log(`PASS pre-PDF visual guards: ${qa.rootCells} roots, ${qa.unitLabels} SVG unit labels, ${qa.choiceContexts} page-20 contexts`);
    await page.close();
  }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
