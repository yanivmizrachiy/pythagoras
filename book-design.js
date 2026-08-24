(()=>{'use strict';if(!document.querySelector('link[data-pythagoras-ui-controls]')){const l=document.createElement('link');l.rel='stylesheet';l.href='ui-controls.css?v=1';l.dataset.pythagorasUiControls='1';document.head.append(l)}})();

(()=>{'use strict';
const BLOCK='section,article,div,li,td,fieldset,figure';
const rules=[
[/question|exercise|task|problem|prompt|q-main|q-sub|qrow|תרגיל|שאלה/i,'ped-question'],
[/example|worked|sample|דוגמ/i,'ped-example'],
[/hint|tip|note|help|foundation-note|defcard|solve-note|summary|observation|רמז|שים.?לב|שימו.?לב/i,'ped-hint'],
[/solution|steps|פתרון|solutions/i,'ped-solution'],
[/formula|equation|math|inverse|pair|root|square|נוסח/i,'ped-formula'],
[/answer|response|blank|workspace|fill|work-lines|solution-space|final-build-area|wline|mcbox|tri-check|check|תשובה/i,'ped-answer'],
[/diagram|figure|geometry|triangle|shape|chart|svg|coord|שרטוט|משולש/i,'ped-diagram'],
[/helper|guide|construction|aux|grid/i,'ped-helper-line'],
[/important|attention|focus|warning|error|חשוב/i,'ped-action']
];
function signature(el){let c='';try{c=typeof el.className==='string'?el.className:(el.className?.baseVal||'')}catch{}return `${c} ${el.id||''} ${[...el.attributes||[]].map(a=>`${a.name}=${a.value}`).join(' ')}`}
function usefulContainer(el){const c=el.closest(BLOCK);if(!c||c.classList.contains('fallback'))return el;return c}
function addBySignature(root){root.querySelectorAll('*').forEach(el=>{const s=signature(el);for(const[re,cls]of rules)if(re.test(s))el.classList.add(cls)})}
function addByLabels(root){root.querySelectorAll('h1,h2,h3,h4,h5,h6,strong,b,p,span,label').forEach(el=>{const t=(el.textContent||'').replace(/\s+/g,' ').trim();if(!t||t.length>120)return;const c=usefulContainer(el);if(/^דוגמ(?:ה|א)|דוגמה פתורה/.test(t))c.classList.add('ped-example');if(/^(רמז|שים לב|שימו לב|זכרו|זכור)/.test(t))c.classList.add('ped-hint');if(/^(פתרון|דרך פתרון|שלבי פתרון|תשובות)/.test(t))c.classList.add('ped-solution');if(/^(תשובה|תשובת התלמיד)/.test(t))c.classList.add('ped-answer');if(/^(תרגיל|שאלה)\s*\d*/.test(t))c.classList.add('ped-question');if(/^(חשוב|שימו לב|בדקו|בדיקה)/.test(t))c.classList.add('ped-action')})}
function addLiveWorkbookRoles(root){
 root.querySelectorAll('.question-block').forEach(e=>e.classList.add('ped-question-group'));
 root.querySelectorAll('.q,.q-main,.q-sub,.qrow,.final-build-task,.page7-section,.pair-task,.mixed-task,.error-task,.page7-final-task').forEach(e=>e.classList.add('ped-question'));
 root.querySelectorAll('.foundation-note,.defcard,.pyt-solve-note,.page7-summary,.final-observation,.chapter-bar').forEach(e=>e.classList.add('ped-concept'));
 root.querySelectorAll('.foundation-card,.tri-cell,.figure,.pyt-diagram-frame,.cur-fig,.visual-container,.figrow,.inverse-pair-card,.mixed-card,.error-card,.final-pair-row,.classification-card,.drawing-card').forEach(e=>e.classList.add('ped-card'));
 root.querySelectorAll('.inverse-pair-card,.mixed-card,.final-pair-row,.root-slot,.pairs-col,.cur-final').forEach(e=>e.classList.add('ped-formula'));
 root.querySelectorAll('.error-card,.error-response').forEach(e=>e.classList.add('ped-action'));
 root.querySelectorAll('.foundation-fill,.pyt-final-answer,.work-lines,.solution-space,.final-build-area,.wline,.mcbox,.tri-check,.check,.response-line,.cls-fill').forEach(e=>e.classList.add('ped-answer'));
 root.querySelectorAll('.pyt-solutions,.pyt-solution').forEach(e=>e.classList.add('ped-solution'));
 root.querySelectorAll('.bullet-large,.bullet-small').forEach(e=>e.classList.add('ped-bullet'));
 root.querySelectorAll('.gz-footer').forEach(e=>e.classList.add('ped-footer'));
 root.querySelectorAll('.chapter-bar').forEach(e=>e.classList.add('ped-section-title'));
 root.querySelectorAll('.coord-svg,.chart,.foundation-svg,.guided-ray-svg,.tri-svg,.pyt-fig-svg').forEach(e=>usefulContainer(e).classList.add('ped-diagram'));
 root.querySelectorAll('.cg,[class*="grid-line" i]').forEach(e=>e.classList.add('ped-grid-line'));
 root.querySelectorAll('.guide-ray,.helper-line,[class*="helper" i]').forEach(e=>e.classList.add('ped-helper-line'));
 root.querySelectorAll('.pair-arrow').forEach(e=>e.classList.add('ped-relation'));
}
function addStructural(root){root.querySelectorAll('h1,.page-title').forEach(e=>e.classList.add('ped-page-title'));root.querySelectorAll('h2,.chapter-bar').forEach(e=>e.classList.add('ped-section-title'));root.querySelectorAll('h3,h4,h5,h6,.page-subtitle').forEach(e=>e.classList.add('ped-subtitle'));root.querySelectorAll('svg').forEach(svg=>usefulContainer(svg).classList.add('ped-diagram'));root.querySelectorAll('math,.math,math-field,[data-math],[class*="formula" i],[class*="equation" i]').forEach(e=>usefulContainer(e).classList.add('ped-formula'));root.querySelectorAll('input,textarea,[contenteditable="true"]').forEach(e=>usefulContainer(e).classList.add('ped-answer'));addLiveWorkbookRoles(root)}
function normalize(root){addStructural(root);addBySignature(root);addByLabels(root);root.querySelectorAll('.ped-example.ped-hint').forEach(e=>e.classList.remove('ped-example'))}
const ROLE_SELECTOR='.ped-question,.ped-concept,.ped-example,.ped-hint,.ped-solution,.ped-formula,.ped-answer,.ped-diagram,.ped-action,.ped-card,.ped-bullet,.ped-footer';
function audit(scope){return[...scope.querySelectorAll('.fallback')].map((p,i)=>{const roleCount=p.querySelectorAll(ROLE_SELECTOR).length;return{page:p.dataset.localPageId||String(i+1).padStart(3,'0'),source:p.dataset.sourceFile||'',roleCount,covered:roleCount>0,questions:p.querySelectorAll('.ped-question').length,concepts:p.querySelectorAll('.ped-concept').length,examples:p.querySelectorAll('.ped-example').length,hints:p.querySelectorAll('.ped-hint').length,solutions:p.querySelectorAll('.ped-solution').length,formulas:p.querySelectorAll('.ped-formula').length,answers:p.querySelectorAll('.ped-answer').length,diagrams:p.querySelectorAll('.ped-diagram').length,actions:p.querySelectorAll('.ped-action').length,cards:p.querySelectorAll('.ped-card').length,tables:p.querySelectorAll('table').length,svgs:p.querySelectorAll('svg').length}})}
function coverage(scope=document){const a=audit(scope),uncovered=a.filter(x=>!x.covered);return{pages:a.length,covered:a.length-uncovered.length,uncovered:uncovered.map(x=>({page:x.page,source:x.source})),complete:a.length>0&&uncovered.length===0}}
function ensurePreviewTheme(root){const app=root.closest?.('#app')||root.querySelector?.('#app');if(app){const mode=window.__PYTHAGORAS_VIEW_MODE__==='mono'?'mono':'color';app.classList.remove('book-theme-original','book-theme-color','book-theme-mono');app.classList.add(mode==='mono'?'book-theme-mono':'book-theme-color')}}
function apply(scope=document){if(scope.matches?.('.fallback'))normalize(scope);scope.querySelectorAll?.('.fallback').forEach(normalize);ensurePreviewTheme(scope);window.__PYTHAGORAS_DESIGN_AUDIT__=audit(document);window.__PYTHAGORAS_COLOR_COVERAGE__=coverage(document);return window.__PYTHAGORAS_DESIGN_AUDIT__}
let queued=false;function queueApply(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply(document)})}
const observer=new MutationObserver(ms=>{if(ms.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.fallback')||n.querySelector?.('.fallback')))))queueApply()});
function start(){apply(document);observer.observe(document.documentElement,{childList:true,subtree:true})}
window.PythagorasBookDesign={apply,audit,coverage,observer,start};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

(()=>{'use strict';
let selectedMode='color',modeObserver=null,counterObserver=null;
function getApp(){return document.getElementById('app')}
function markButtons(){const color=document.getElementById('colorMode'),mono=document.getElementById('monoMode');if(color){color.classList.toggle('is-active',selectedMode==='color');color.setAttribute('aria-pressed',String(selectedMode==='color'));color.dataset.state=selectedMode==='color'?'on':'off'}if(mono){mono.classList.toggle('is-active',selectedMode==='mono');mono.setAttribute('aria-pressed',String(selectedMode==='mono'));mono.dataset.state=selectedMode==='mono'?'on':'off'}}
function enforceMode(){const app=getApp();if(app){const wanted=selectedMode==='mono'?'book-theme-mono':'book-theme-color';const other=selectedMode==='mono'?'book-theme-color':'book-theme-mono';if(!app.classList.contains(wanted)||app.classList.contains(other)||app.classList.contains('book-theme-original')){app.classList.remove('book-theme-original','book-theme-color','book-theme-mono');app.classList.add(wanted)}}markButtons();window.__PYTHAGORAS_VIEW_MODE__=selectedMode}
function choose(mode){if(mode!=='color'&&mode!=='mono')return;selectedMode=mode;window.__PYTHAGORAS_VIEW_MODE__=selectedMode;try{sessionStorage.setItem('pythagoras-view-mode',mode)}catch{}enforceMode()}
function prepareDownloadButtons(){for(const id of ['downloadColor','downloadMono']){const b=document.getElementById(id);if(!b)continue;const s=b.querySelector('span');if(s)s.textContent='Download';b.setAttribute('aria-label',id==='downloadColor'?'Download PDF color':'Download PDF black and white');b.title=id==='downloadColor'?'Download PDF color':'Download PDF black and white'}}
function compactCounter(){const c=document.getElementById('counter');if(!c)return;if(innerWidth<=340&&/^עמוד\s+/.test(c.textContent||''))c.textContent=c.textContent.replace(/^עמוד\s+/,'')}
function wire(){try{const saved=sessionStorage.getItem('pythagoras-view-mode');if(saved==='mono'||saved==='color')selectedMode=saved}catch{}window.__PYTHAGORAS_VIEW_MODE__=selectedMode;const color=document.getElementById('colorMode'),mono=document.getElementById('monoMode');if(color&&!color.dataset.fastModeBound){color.dataset.fastModeBound='1';color.addEventListener('click',()=>choose('color'),true);color.addEventListener('pointerdown',()=>choose('color'),{passive:true})}if(mono&&!mono.dataset.fastModeBound){mono.dataset.fastModeBound='1';mono.addEventListener('click',()=>choose('mono'),true);mono.addEventListener('pointerdown',()=>choose('mono'),{passive:true})}prepareDownloadButtons();enforceMode();const app=getApp();if(app&&'MutationObserver'in window){modeObserver?.disconnect();modeObserver=new MutationObserver(()=>queueMicrotask(enforceMode));modeObserver.observe(app,{attributes:true,attributeFilter:['class'],childList:true})}const counter=document.getElementById('counter');if(counter&&'MutationObserver'in window){counterObserver?.disconnect();counterObserver=new MutationObserver(compactCounter);counterObserver.observe(counter,{childList:true,characterData:true,subtree:true})}compactCounter();addEventListener('resize',compactCounter,{passive:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();
window.PythagorasViewMode={set:choose,get:()=>selectedMode};
})();
