#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const puppeteer=require('puppeteer-core');
const {PROVENANCE_FILE,computeSourceHash}=require('./pdf-provenance.js');

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
    const browserProblems=[];
    // Fatal fidelity guards: a page error, or a same-origin asset (woff2/css/svg/js) that fails to
    // load, means the captured PDF would ship fallback/tofu glyphs instead of what the teacher sees.
    const pageErrors=[];
    const assetFailures=[];
    const isLocalAsset=u=>/127\.0\.0\.1|localhost/u.test(u)&&/\.(?:woff2?|css|js|svg|json|html|png|jpe?g)(?:[?#]|$)/iu.test(u);
    page.on('requestfailed',req=>{const u=req.url();if(isLocalAsset(u))assetFailures.push('requestfailed '+((req.failure()&&req.failure().errorText)||'')+' '+u)});
    page.on('response',res=>{const u=res.url();if(isLocalAsset(u)&&res.status()>=400)assetFailures.push('http '+res.status()+' '+u)});
    page.on('pageerror',error=>{pageErrors.push(error.message);browserProblems.push('pageerror: '+error.message);console.error('PDF pageerror:',error.message)});
    page.on('console',message=>{if(message.type()==='error'||message.type()==='warning'){browserProblems.push('console '+message.type()+': '+message.text());console.error('PDF console:',message.text())}});
    page.on('dialog',async dialog=>{const msg=dialog.message();browserProblems.push('dialog: '+msg);console.error('PDF dialog:',msg);await dialog.dismiss()});

    await page.evaluateOnNewDocument(()=>{window.print=()=>{window.__PYTHAGORAS_PRINT_READY__=true}});
    await page.goto(base,{waitUntil:'networkidle0',timeout:120000});
    await page.waitForFunction(()=>document.querySelectorAll('#app .scroll-sheet').length===53&&!!document.getElementById('printColor')&&!!window.PythagorasReader,{timeout:120000});
    await page.evaluate(()=>document.getElementById('printColor').click());
    try{
      await page.waitForFunction(()=>{const h=document.getElementById('printHost');return window.__PYTHAGORAS_PRINT_READY__===true&&h&&h.querySelectorAll('.print-page').length===53&&h.querySelectorAll('.print-page .a4-page').length===53},{timeout:90000});
    }catch(error){
      const state=await page.evaluate(()=>{
        const host=document.getElementById('printHost');
        return {
          status:document.querySelector('.sync')?.textContent||'',
          printReady:window.__PYTHAGORAS_PRINT_READY__===true,
          pages:host?.querySelectorAll('.print-page').length||0,
          a4:host?.querySelectorAll('.a4-page').length||0,
          buttonDisabled:document.getElementById('printColor')?.disabled,
          mathReady:!!window.MathJax?.typesetPromise,
          printClass:host?.className||'',
          view:document.body.dataset.readerView||''
        }
      });
      throw new Error('PDF rendering did not finish; state='+JSON.stringify(state)+'; browserErrors='+JSON.stringify(browserProblems.slice(-8))+'; '+error.message);
    }
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
          vector:/data:image\/svg\+xml/.test(getComputedStyle(radic,'::before').content),
          noDoubleGlyph:parseFloat(r.fontSize)===0,
          touching:lb.left<=rb.right+2&&lb.left>=rb.right-4,
          topAlign:Math.abs((rb.top+1.5)-(lb.top+parseFloat(l.borderTopWidth)))<=3
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

    // Validate actual print-media radical appearance, not screen-only print-host geometry.
    await page.emulateMediaType('print');
    const printable=await page.evaluate(()=>{
      const host=document.getElementById('printHost');
      const cells=[...host.querySelectorAll('.sqrt-cell')];
      return {cells:cells.length,invalid:cells.filter(cell=>{
        const r=cell.querySelector('.radic');
        const line=cell.querySelector('.root-line,.root-work-fill');
        return !r||!line||!/data:image\/svg\+xml/.test(getComputedStyle(r,'::before').content)||
          parseFloat(getComputedStyle(line).borderTopWidth)<1||parseFloat(getComputedStyle(line).borderBottomWidth)<1;
      }).length};
    });
    if(printable.cells!==qa.rootCells||printable.invalid)throw new Error('print-media radicals failed: '+JSON.stringify(printable));
    if(assetFailures.length)throw new Error('asset load failures during print render (PDF would ship fallback/tofu glyphs): '+JSON.stringify([...new Set(assetFailures)].slice(0,12)));
    if(pageErrors.length)throw new Error('page errors during print render: '+JSON.stringify(pageErrors.slice(0,8)));
    await page.pdf({path:output,printBackground:true,preferCSSPageSize:true,margin:{top:'0',right:'0',bottom:'0',left:'0'}});
    const size=fs.statSync(output).size;
    if(size<100000)throw new Error(`generated PDF suspiciously small: ${size}`);
    // Record the source hash this PDF was built from, so the validator can fail a stale PDF
    // ("see == get" gate, SOURCE_OF_TRUTH §8א/§10). Deterministic: identical source → identical file.
    const {hash:sourceSha256,inputs}=computeSourceHash(root);
    fs.writeFileSync(path.join(root,PROVENANCE_FILE),JSON.stringify({
      note:'Build provenance for pythagoras-workbook.pdf — do not edit by hand. Rebuild with: CHROME_BIN=<chrome> npm run pdf:build (SOURCE_OF_TRUTH §8א/§10).',
      sourceSha256,
      inputCount:inputs.length
    },null,2)+'\n');
    console.log(`PASS static PDF generated from canonical reader: ${output} (${size} bytes)`);
    console.log(`PASS pre-PDF visual guards: ${qa.rootCells} roots, ${qa.unitLabels} SVG unit labels, ${qa.choiceContexts} page-20 contexts`);
    console.log(`PASS provenance recorded: ${PROVENANCE_FILE} (sourceSha256=${sourceSha256.slice(0,12)}…, ${inputs.length} inputs)`);
    await page.close();
  }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
