#!/usr/bin/env node
'use strict';
const puppeteer=require('puppeteer-core');
const executablePath=process.env.CHROME_BIN;
if(!executablePath)throw new Error('CHROME_BIN is required');
const cases=[
  {name:'iPhone SE',width:320,height:568},
  {name:'Galaxy S24 Ultra',width:412,height:915},
  {name:'iPad',width:820,height:1180},
  {name:'Laptop',width:1366,height:768},
  {name:'Desktop',width:1920,height:1080}
];
(async()=>{
  const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
  try{
    for(const t of cases){
      const page=await browser.newPage();
      await page.setViewport({width:t.width,height:t.height,deviceScaleFactor:1});
      await page.goto('http://127.0.0.1:8080/',{waitUntil:'domcontentloaded',timeout:60000});
      await page.waitForFunction(()=>{
        const sheets=document.querySelectorAll('#app .scroll-sheet');
        const loaded=document.querySelectorAll('#app .scroll-sheet:not(.is-placeholder)');
        return sheets.length===53&&loaded.length>=1&&window.PythagorasReader;
      },{timeout:60000});
      const state=await page.evaluate(()=>{
        const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);
        const dup=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];
        return {
          clientWidth:document.documentElement.clientWidth,
          scrollWidth:document.documentElement.scrollWidth,
          sheets:document.querySelectorAll('#app .scroll-sheet').length,
          duplicateIds:dup,
          readerTools:!!document.querySelector('#readerTools'),
          viewButtons:document.querySelectorAll('[data-reader-view-button]').length,
          toc:!!document.querySelector('#readerToc'),
          fullscreen:!!document.querySelector('#readerFullscreen')
        };
      });
      if(state.scrollWidth>state.clientWidth+2)throw new Error(`${t.name}: horizontal overflow ${state.scrollWidth}/${state.clientWidth}`);
      if(state.sheets!==53)throw new Error(`${t.name}: expected 53 sheets`);
      if(state.duplicateIds.length)throw new Error(`${t.name}: duplicate IDs ${state.duplicateIds.join(',')}`);
      if(!state.readerTools||state.viewButtons!==3||!state.toc||!state.fullscreen)throw new Error(`${t.name}: reader controls incomplete`);

      if(t.width>=900){
        await page.evaluate(()=>{window.PythagorasReader.setView('spread');window.PythagorasReader.setZoom(1.25);window.PythagorasReader.openToc(true)});
        await page.waitForFunction(()=>document.body.dataset.readerView==='spread'&&!document.querySelector('#readerToc').hidden);
        const rs=await page.evaluate(()=>window.PythagorasReader.getState());
        if(rs.zoom!==1.25)throw new Error(`${t.name}: zoom state failed`);
      }else{
        await page.evaluate(()=>window.PythagorasReader.setView('spread'));
        await page.waitForFunction(()=>document.body.dataset.readerView==='single');
      }
      await page.close();
      console.log('PASS smoke:',t.name);
    }

    // Focused regression: the blank square-root row must be one coherent radical,
    // with a top vinculum and a bottom writing line, and page 20 choices must be determinate.
    {
      const page=await browser.newPage();
      await page.setViewport({width:1100,height:900,deviceScaleFactor:1});
      await page.goto('http://127.0.0.1:8080/עמוד-650.html',{waitUntil:'networkidle0',timeout:60000});
      const qa=await page.evaluate(()=>{
        const roots=[...document.querySelectorAll('.sqrt-cell')];
        const rootOk=roots.length===6&&roots.every(cell=>{
          const radic=cell.querySelector('.radic');
          const line=cell.querySelector('.root-line,.root-work-fill');
          if(!radic||!line)return false;
          const c=getComputedStyle(cell),r=getComputedStyle(radic),l=getComputedStyle(line);
          const cb=cell.getBoundingClientRect(),rb=radic.getBoundingClientRect(),lb=line.getBoundingClientRect();
          return c.direction==='ltr'&&parseFloat(l.borderTopWidth)>=1&&parseFloat(l.borderBottomWidth)>=1&&rb.right>=lb.left-3&&Math.abs(cb.top-lb.top)<8&&parseFloat(r.fontSize)>=20;
        });
        return {
          rootOk,
          contexts:document.querySelectorAll('.choice-context').length,
          choices:document.querySelectorAll('.choice-card').length,
          rawSquared:[...document.querySelectorAll('.choice-card,.final-card')].some(x=>x.textContent.includes('x²')),
          previewNav:!!document.querySelector('.preview-nav')
        };
      });
      if(!qa.rootOk)throw new Error('page 20: canonical sqrt-cell geometry failed');
      if(qa.contexts!==4||qa.choices!==4)throw new Error('page 20: +/− choices are not explicitly disambiguated');
      if(qa.rawSquared)throw new Error('page 20: raw x² remains in formula body');
      if(qa.previewNav)throw new Error('page 20: legacy preview-nav remains in source');
      await page.close();
      console.log('PASS smoke: canonical square-root + determinate page 20 choices');
    }

    // Focused regression: mixed number+Hebrew-unit SVG labels must not reverse in RTL.
    {
      const page=await browser.newPage();
      await page.setViewport({width:900,height:800,deviceScaleFactor:1});
      await page.goto('http://127.0.0.1:8080/עמוד-21.html',{waitUntil:'networkidle0',timeout:60000});
      const qa=await page.evaluate(()=>{
        const labels=[...document.querySelectorAll('svg text.pyt-side')].filter(x=>/\d+\s+ס״מ/u.test(x.textContent||''));
        return {
          count:labels.length,
          allLtr:labels.every(x=>getComputedStyle(x).direction==='ltr'||x.getAttribute('direction')==='ltr'),
          canonical:labels.every(x=>!x.textContent.includes('ס"מ')),
          previewNav:!!document.querySelector('.preview-nav')
        };
      });
      if(qa.count<2)throw new Error('page 21: expected mixed SVG unit labels');
      if(!qa.allLtr)throw new Error('page 21: SVG unit label direction is not LTR');
      if(!qa.canonical)throw new Error('page 21: non-canonical unit typography remains');
      if(qa.previewNav)throw new Error('page 21: legacy preview-nav remains in source');
      await page.close();
      console.log('PASS smoke: SVG mixed unit labels');
    }
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
