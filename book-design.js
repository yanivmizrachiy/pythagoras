(()=>{'use strict';
if(!document.querySelector('link[data-pythagoras-ui-controls]')){
  const l=document.createElement('link');
  l.rel='stylesheet';
  l.href='ui-controls.css?v=1';
  l.dataset.pythagorasUiControls='1';
  document.head.append(l);
}
})();

(()=>{'use strict';
/*
  Design safety policy:
  - Never infer semantic roles from text, ids, classes or element names.
  - Never decorate workbook content with generated ped-* classes.
  - Never change workbook geometry, spacing, borders, shadows or card emphasis.
  - Only remove legacy classes that were injected by the previous unsafe enhancer.
*/
const LEGACY_CLASSES=[
  'ped-question','ped-question-group','ped-concept','ped-example','ped-hint','ped-solution',
  'ped-formula','ped-answer','ped-diagram','ped-action','ped-card','ped-bullet','ped-footer',
  'ped-page-title','ped-section-title','ped-subtitle','ped-grid-line','ped-helper-line','ped-relation'
];
const LEGACY_SELECTOR=LEGACY_CLASSES.map(c=>'.'+c).join(',');

function cleanElement(el){
  if(!el||el.nodeType!==1)return 0;
  let removed=0;
  for(const c of LEGACY_CLASSES){
    if(el.classList?.contains(c)){
      el.classList.remove(c);
      removed++;
    }
  }
  return removed;
}

function cleanup(scope=document){
  let removed=0;
  if(scope?.nodeType===1)removed+=cleanElement(scope);
  if(scope?.querySelectorAll){
    scope.querySelectorAll(LEGACY_SELECTOR).forEach(el=>{removed+=cleanElement(el)});
  }
  window.__PYTHAGORAS_LEGACY_DESIGN_CLASSES_REMOVED__=(window.__PYTHAGORAS_LEGACY_DESIGN_CLASSES_REMOVED__||0)+removed;
  return removed;
}

function ensurePreviewTheme(root=document){
  const app=root?.closest?.('#app')||root?.querySelector?.('#app')||document.getElementById('app');
  if(!app)return;
  const mode=window.__PYTHAGORAS_VIEW_MODE__==='mono'?'mono':'color';
  app.classList.remove('book-theme-original','book-theme-color','book-theme-mono');
  app.classList.add(mode==='mono'?'book-theme-mono':'book-theme-color');
}

function audit(scope=document){
  const pages=[...scope.querySelectorAll?.('.fallback')||[]];
  const legacy=scope.querySelectorAll?.(LEGACY_SELECTOR)?.length||0;
  return {
    pages:pages.length,
    legacyClassesRemaining:legacy,
    safe:legacy===0,
    strategy:'source-preserving'
  };
}

function coverage(scope=document){
  const a=audit(scope);
  return {pages:a.pages,covered:a.pages,uncovered:[],complete:a.safe};
}

function apply(scope=document){
  cleanup(scope);
  ensurePreviewTheme(scope);
  window.__PYTHAGORAS_DESIGN_AUDIT__=audit(document);
  window.__PYTHAGORAS_COLOR_COVERAGE__=coverage(document);
  return window.__PYTHAGORAS_DESIGN_AUDIT__;
}

let queued=false;
function queueApply(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{
    queued=false;
    apply(document);
  });
}

const observer=new MutationObserver(mutations=>{
  let needsCleanup=false;
  for(const m of mutations){
    for(const node of m.addedNodes){
      if(node.nodeType!==1)continue;
      if(LEGACY_CLASSES.some(c=>node.classList?.contains(c))||node.querySelector?.(LEGACY_SELECTOR)){
        needsCleanup=true;
        break;
      }
    }
    if(needsCleanup)break;
  }
  if(needsCleanup)queueApply();
});

function start(){
  apply(document);
  observer.observe(document.documentElement,{childList:true,subtree:true});
}

window.PythagorasBookDesign={apply,audit,coverage,cleanup,observer,start};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();

(()=>{'use strict';
let selectedMode='color',modeObserver=null,counterObserver=null;
function getApp(){return document.getElementById('app')}
function markButtons(){
  const color=document.getElementById('colorMode'),mono=document.getElementById('monoMode');
  if(color){
    color.classList.toggle('is-active',selectedMode==='color');
    color.setAttribute('aria-pressed',String(selectedMode==='color'));
    color.dataset.state=selectedMode==='color'?'on':'off';
  }
  if(mono){
    mono.classList.toggle('is-active',selectedMode==='mono');
    mono.setAttribute('aria-pressed',String(selectedMode==='mono'));
    mono.dataset.state=selectedMode==='mono'?'on':'off';
  }
}
function enforceMode(){
  const app=getApp();
  if(app){
    const wanted=selectedMode==='mono'?'book-theme-mono':'book-theme-color';
    const other=selectedMode==='mono'?'book-theme-color':'book-theme-mono';
    if(!app.classList.contains(wanted)||app.classList.contains(other)||app.classList.contains('book-theme-original')){
      app.classList.remove('book-theme-original','book-theme-color','book-theme-mono');
      app.classList.add(wanted);
    }
  }
  markButtons();
  window.__PYTHAGORAS_VIEW_MODE__=selectedMode;
}
function choose(mode){
  if(mode!=='color'&&mode!=='mono')return;
  selectedMode=mode;
  window.__PYTHAGORAS_VIEW_MODE__=selectedMode;
  try{sessionStorage.setItem('pythagoras-view-mode',mode)}catch{}
  enforceMode();
}
function prepareDownloadButtons(){
  for(const id of ['downloadColor','downloadMono']){
    const b=document.getElementById(id);
    if(!b)continue;
    const s=b.querySelector('span');
    if(s)s.textContent='Download';
    b.setAttribute('aria-label',id==='downloadColor'?'Download PDF color':'Download PDF black and white');
    b.title=id==='downloadColor'?'Download PDF color':'Download PDF black and white';
  }
}
function compactCounter(){
  const c=document.getElementById('counter');
  if(!c)return;
  if(innerWidth<=340&&/^עמוד\s+/.test(c.textContent||''))c.textContent=c.textContent.replace(/^עמוד\s+/,'');
}
function wire(){
  try{
    const saved=sessionStorage.getItem('pythagoras-view-mode');
    if(saved==='mono'||saved==='color')selectedMode=saved;
  }catch{}
  window.__PYTHAGORAS_VIEW_MODE__=selectedMode;
  const color=document.getElementById('colorMode'),mono=document.getElementById('monoMode');
  if(color&&!color.dataset.fastModeBound){
    color.dataset.fastModeBound='1';
    color.addEventListener('click',()=>choose('color'),true);
    color.addEventListener('pointerdown',()=>choose('color'),{passive:true});
  }
  if(mono&&!mono.dataset.fastModeBound){
    mono.dataset.fastModeBound='1';
    mono.addEventListener('click',()=>choose('mono'),true);
    mono.addEventListener('pointerdown',()=>choose('mono'),{passive:true});
  }
  prepareDownloadButtons();
  enforceMode();
  const app=getApp();
  if(app&&'MutationObserver'in window){
    modeObserver?.disconnect();
    modeObserver=new MutationObserver(()=>queueMicrotask(enforceMode));
    modeObserver.observe(app,{attributes:true,attributeFilter:['class']});
  }
  const counter=document.getElementById('counter');
  if(counter&&'MutationObserver'in window){
    counterObserver?.disconnect();
    counterObserver=new MutationObserver(compactCounter);
    counterObserver.observe(counter,{childList:true,characterData:true,subtree:true});
  }
  compactCounter();
  addEventListener('resize',compactCounter,{passive:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});
else wire();
window.PythagorasViewMode={set:choose,get:()=>selectedMode};
})();
