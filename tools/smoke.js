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
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
