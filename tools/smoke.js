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
          fullscreen:!!document.querySelector('#readerFullscreen'),
          navCounter:document.querySelectorAll('.nav-group #counter').length,
          counterText:document.querySelector('#counter')?.textContent||'',
          previous:document.querySelectorAll('.nav-group #prev').length,
          next:document.querySelectorAll('.nav-group #next').length,
          secondaryCounterCount:document.querySelectorAll('#readerPageJump,#readerPageLabel,#readerPageInput,.reader-page-jump').length,
          chapterCount:document.querySelectorAll('#readerTocList .reader-toc-chapter').length
        };
      });
      if(state.scrollWidth>state.clientWidth+2)throw new Error(`${t.name}: horizontal overflow ${state.scrollWidth}/${state.clientWidth}`);
      if(state.sheets!==53)throw new Error(`${t.name}: expected 53 sheets`);
      if(state.duplicateIds.length)throw new Error(`${t.name}: duplicate IDs ${state.duplicateIds.join(',')}`);
      if(!state.readerTools||state.viewButtons!==3||!state.toc||!state.fullscreen)throw new Error(`${t.name}: reader controls incomplete`);
      if(state.navCounter!==1||state.previous!==1||state.next!==1||state.secondaryCounterCount!==0||state.chapterCount!==7||!/^(?:עמוד )?[0-9]+ \/ 53$/.test(state.counterText)){
        throw new Error(t.name + ': page counter duplicated or contents not complete: ' + JSON.stringify(state));
      }
      // Normalize the view for this layout assertion; previous device sizes may persist spread mode.
      await page.evaluate(()=>window.PythagorasReader.setView('scroll',{persist:false}));
      await page.waitForFunction(()=>document.body.dataset.readerView==='scroll');
      // Contract: chapter contents on physical right, all action buttons grouped left.
      // Top of the first HTML sheet is visible below (never hidden by) sticky chrome.
      const layout=await page.evaluate(()=>{
        const toc=document.querySelector('#tocToggle')?.getBoundingClientRect();
        const actions=document.querySelector('#readerTools')?.getBoundingClientRect();
        const print=document.querySelector('#printOptionsBtn')?.getBoundingClientRect();
        const shell=document.querySelector('.toolbar-shell')?.getBoundingClientRect();
        const top=document.querySelector('body>.top')?.getBoundingClientRect();
        const first=document.querySelector('.scroll-sheet[data-index="0"]')?.getBoundingClientRect();
        return {toc:toc&&{left:toc.left,right:toc.right},
          actions:actions&&{left:actions.left,right:actions.right,top:actions.top},
          print:print&&{left:print.left,right:print.right},
          shell:shell&&{left:shell.left,right:shell.right},
          first:first&&{top:first.top,width:first.width,height:first.height},
          headerBottom:top?.bottom,
          scrollY:window.scrollY,
          restoration:history.scrollRestoration,
          smooth:getComputedStyle(document.documentElement).scrollBehavior};
      });
      if(!layout.toc||!layout.actions||!layout.print||layout.restoration!=='manual'||layout.smooth!=='auto'||
         layout.toc.right < layout.shell.right-100||
         layout.actions.left>layout.toc.left||layout.scrollY>4||
         layout.first.top<layout.headerBottom-12){
        throw new Error(t.name+': bad right TOC / left actions / top-of-page contract: '+JSON.stringify(layout));
      }

      // The owner's 18/10 rule: print theme is disclosed only AFTER pressing Print.
      const printUi=await page.evaluate(()=>{
        const main=document.getElementById('printOptionsBtn');
        const download=document.getElementById('downloadMain');
        const panel=document.getElementById('printOptions');
        const legacy=document.querySelectorAll('#colorMode,#monoMode,.mode-choices').length;
        const initial=!!main&&!!download&&!!panel&&panel.hidden&&main.getAttribute('aria-expanded')==='false';
        main?.click();
        const revealed=!panel?.hidden&&main?.getAttribute('aria-expanded')==='true'&&
          !!panel.querySelector('#printColor')&&!!panel.querySelector('#printMono');
        document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
        return {initial,revealed,legacy,closed:panel.hidden&&main.getAttribute('aria-expanded')==='false'};
      });
      if(!printUi.initial||!printUi.revealed||printUi.legacy||!printUi.closed){
        throw new Error(`${t.name}: print-only color choices contract failed: ${JSON.stringify(printUi)}`);
      }


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

    // Direct links are owned only by the canonical index loader. Verify page-top, not just counter text.
    {
      const deep=await browser.newPage();
      try{
        await deep.setViewport({width:1366,height:900,deviceScaleFactor:1});
        await deep.goto('http://127.0.0.1:8080/#page=19',{waitUntil:'domcontentloaded',timeout:60000});
        await deep.waitForFunction(()=>{
          const c=document.querySelector('#counter')?.textContent||'';
          const sheet=document.querySelector('.scroll-sheet[data-index="18"]');
          return /19\s*\/\s*53/.test(c)&&!!sheet?.querySelector('.a4-page');
        },{timeout:60000});
        const result=await deep.evaluate(()=>{
          const header=document.querySelector('body>.top')?.getBoundingClientRect();
          const sheet=document.querySelector('.scroll-sheet[data-index="18"]')?.getBoundingClientRect();
          return {hash:location.hash,counter:document.querySelector('#counter')?.textContent,
            sheetTop:sheet?.top,sheetHeight:sheet?.height,headerBottom:header?.bottom,
            heading:document.querySelector('.scroll-sheet[data-index="18"] .page-title')?.textContent};
        });
        if(result.hash!=='#page=19'||!result.heading||result.sheetHeight<300||
           result.sheetTop<result.headerBottom-15||result.sheetTop>result.headerBottom+80){
          throw new Error('page-19 deep-link not aligned at its own top: '+JSON.stringify(result));
        }
        console.log('PASS smoke: #page=19 starts at top of its real A4 sheet');
      }finally{await deep.close()}
    }

    // Page 6 regression: all worksheet instructions and math writing cards must fit
    // within their allocated tracks. The old 220/150px tracks overlapped the next tasks.
    {
      const page=await browser.newPage();
      try{
        await page.setViewport({width:1100,height:900,deviceScaleFactor:1});
        await page.goto('http://127.0.0.1:8080/עמוד-639.html',{waitUntil:'networkidle0',timeout:60000});
        await page.waitForFunction(()=>!!window.MathJax?.typesetPromise,{timeout:30000});
        await page.evaluate(()=>document.fonts.ready);
        const modes=['screen','print'];
        for(const medium of modes){
          await page.emulateMediaType(medium);
          const result=await page.evaluate(()=>{
            const query=selector=>document.querySelector('.page-639 '+selector);
            const rect=x=>{const r=x?.getBoundingClientRect();return r?{top:r.top,bottom:r.bottom,height:r.height}:null};
            const selectors=['.page6-summary','.page6-basic-task','.page6-thinking-zone','.page6-calculator-task','.page6-error-task','.page6-pattern-task'];
            const sections=selectors.map(selector=>({selector,...rect(query(selector))}));
            const fail=[];
            for(let i=1;i<sections.length;i++){
              if(sections[i-1].bottom>sections[i].top+1)fail.push('adjacent sections overlap: '+sections[i-1].selector+' '+sections[i].selector);
            }
            const cardSelectors=['.square-card','.hard-square-card','.compare-card','.claim-card','.power-error-card','.pattern-expression'];
            const overflowing={};
            for(const cls of cardSelectors){
              let broken=0;for(const el of document.querySelectorAll('.page-639 '+cls)){
                if(el.scrollHeight>el.clientHeight+3)broken++;
              }
              if(broken)overflowing[cls]=broken;
            }
            const pairs=[
              ['.page6-basic-task .q-main','.page6-basic-grid'],
              ['.compare-task .q-main','.compare-example'],
              ['.compare-example','.compare-grid'],
              ['.misconception-task .q-main','.student-claims'],
              ['.page6-calculator-task .q-main','.hard-square-grid'],
              ['.page6-error-task .q-main','.power-error-grid'],
              ['.page6-pattern-task .q-main','.pattern-row']
            ];
            for(const [a,b] of pairs){
              const ar=rect(query(a)),br=rect(query(b));
              if(!ar||!br||ar.bottom>br.top+1)fail.push('instructions overlap work: '+a+' '+b+': '+JSON.stringify({ar,br}));
            }
            const footer=rect(query('.gz-footer'));
            const pattern=rect(query('.page6-pattern-task'));
            if(footer&&pattern&&pattern.bottom>footer.top+1)fail.push('worksheet overlaps footer');
            return {sections,overflowing,fail};
          });
          if(result.fail.length||Object.keys(result.overflowing).length){
            throw new Error('page 6 / '+medium+' layout overflow: '+JSON.stringify(result));
          }
        }
        console.log('PASS smoke: page 6 cards/instructions fit with no overlap in screen+print');
      }finally{await page.close()}
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
                oneVector:/data:image\/svg\+xml/.test(vector.content),
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
