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

    // Screen AND print regression for every worksheet containing writable radicals.
    // Checks actual browser-computed vector source/geometry rather than CSS source strings.
    for(const source of [647,648,649,650,653]){
      const page=await browser.newPage();
      try{
        await page.setViewport({width:1100,height:900,deviceScaleFactor:1});
        await page.goto('http://127.0.0.1:8080/עמוד-'+source+'.html',{waitUntil:'networkidle0',timeout:60000});
        for(const media of ['screen','print']){
          await page.emulateMediaType(media);
          const qa=await page.evaluate(()=>{
            const roots=[...document.querySelectorAll('.sqrt-cell')];
            const failures=roots.map((cell,i)=>{
              const radic=cell.querySelector('.radic');
              const line=cell.querySelector('.root-line,.root-work-fill');
              if(!radic||!line)return {i,reason:'missing radical or fill'};
              const c=getComputedStyle(cell),r=getComputedStyle(radic),l=getComputedStyle(line);
              const vector=getComputedStyle(radic,'::before');
              const cb=cell.getBoundingClientRect(),rb=radic.getBoundingClientRect(),lb=line.getBoundingClientRect();
              const checks={
                ltr:c.direction==='ltr',
                oneVector:/data:image\\/svg\\+xml/.test(vector.content),
                vectorVisible:vector.display!=='none'&&parseFloat(vector.width)>=18,
                notDoublePrinted:parseFloat(r.fontSize)===0,
                topBorder:parseFloat(l.borderTopWidth)>=1,
                writingLine:parseFloat(l.borderBottomWidth)>=1,
                joined:lb.left<=rb.right+2&&lb.left>=rb.right-4,
                vertical:Math.abs((rb.top+1.5)-(lb.top+parseFloat(l.borderTopWidth)))<=3,
                allInside:lb.left>=cb.left&&lb.right<=cb.right+2
              };
              return Object.values(checks).every(Boolean)?null:{i,checks,radic:{x:rb.x,right:rb.right,y:rb.y},line:{x:lb.x,y:lb.y},vector:vector.content.slice(0,80)};
            }).filter(Boolean);
            return {count:roots.length,failures,contexts:document.querySelectorAll('.choice-context').length,choices:document.querySelectorAll('.choice-card').length,
              rawSquared:[...document.querySelectorAll('.choice-card,.final-card')].some(x=>x.textContent.includes('x²')),
              previewNav:!!document.querySelector('.preview-nav')};
          });
          if(!qa.count||qa.failures.length)throw new Error('page '+source+' / '+media+': root rendering failed: '+JSON.stringify(qa));
          if(source===650&&(qa.count!==6||qa.contexts!==4||qa.choices!==4||qa.rawSquared||qa.previewNav)){
            throw new Error('page 650 / '+media+': operator regression: '+JSON.stringify(qa));
          }
        }
        console.log('PASS smoke: integral radical geometry, screen+print, page '+source);
      }finally{await page.close()}
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
