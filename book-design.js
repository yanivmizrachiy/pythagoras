(()=>{
'use strict';
const BLOCK='section,article,div,li,td,fieldset,figure';
const rules=[
  [/question|exercise|task|problem|prompt|תרגיל|שאלה/i,'ped-question'],
  [/example|worked|sample|דוגמ/i,'ped-example'],
  [/hint|tip|note|help|רמז|שים.?לב|שימו.?לב/i,'ped-hint'],
  [/solution|steps|פתרון/i,'ped-solution'],
  [/formula|equation|math|נוסח/i,'ped-formula'],
  [/answer|response|blank|workspace|תשובה/i,'ped-answer'],
  [/diagram|figure|geometry|triangle|shape|שרטוט|משולש/i,'ped-diagram'],
  [/helper|guide|construction|aux/i,'ped-helper-line'],
  [/important|attention|focus|warning|חשוב/i,'ped-action']
];
function signature(el){return `${el.className||''} ${el.id||''} ${[...el.attributes||[]].map(a=>`${a.name}=${a.value}`).join(' ')}`}
function addBySignature(root){
  root.querySelectorAll('*').forEach(el=>{const s=signature(el);for(const [re,cls] of rules)if(re.test(s))el.classList.add(cls)});
}
function usefulContainer(el){
  const c=el.closest(BLOCK);if(!c||c.classList.contains('fallback'))return el;return c;
}
function addByLabels(root){
  root.querySelectorAll('h1,h2,h3,h4,h5,h6,strong,b,p,span,label').forEach(el=>{
    const t=(el.textContent||'').replace(/\s+/g,' ').trim();
    if(!t||t.length>80)return;
    const c=usefulContainer(el);
    if(/^דוגמ(?:ה|א)|דוגמה פתורה/.test(t))c.classList.add('ped-example');
    if(/^(רמז|שים לב|שימו לב|זכרו|זכור)/.test(t))c.classList.add('ped-hint');
    if(/^(פתרון|דרך פתרון|שלבי פתרון)/.test(t))c.classList.add('ped-solution');
    if(/^(תשובה|תשובת התלמיד)/.test(t))c.classList.add('ped-answer');
    if(/^(תרגיל|שאלה)\s*\d*/.test(t))c.classList.add('ped-question');
    if(/^(חשוב|שימו לב)/.test(t))c.classList.add('ped-action');
  });
}
function addStructural(root){
  root.querySelectorAll('h1').forEach(e=>e.classList.add('ped-page-title'));
  root.querySelectorAll('h2').forEach(e=>e.classList.add('ped-section-title'));
  root.querySelectorAll('h3,h4,h5,h6').forEach(e=>e.classList.add('ped-subtitle'));
  root.querySelectorAll('svg').forEach(svg=>usefulContainer(svg).classList.add('ped-diagram'));
  root.querySelectorAll('math,.math,math-field,[data-math],[class*="formula" i],[class*="equation" i]').forEach(e=>usefulContainer(e).classList.add('ped-formula'));
  root.querySelectorAll('input,textarea,[contenteditable="true"],[class*="answer" i],[class*="blank" i]').forEach(e=>usefulContainer(e).classList.add('ped-answer'));
}
function normalize(root){
  addStructural(root);addBySignature(root);addByLabels(root);
  root.querySelectorAll('.ped-example.ped-hint').forEach(e=>e.classList.remove('ped-example'));
}
function audit(scope){
  const pages=[...scope.querySelectorAll('.fallback')];
  return pages.map((p,i)=>({page:p.dataset.localPageId||String(i+1).padStart(3,'0'),questions:p.querySelectorAll('.ped-question').length,examples:p.querySelectorAll('.ped-example').length,hints:p.querySelectorAll('.ped-hint').length,solutions:p.querySelectorAll('.ped-solution').length,formulas:p.querySelectorAll('.ped-formula').length,answers:p.querySelectorAll('.ped-answer').length,diagrams:p.querySelectorAll('.ped-diagram').length,tables:p.querySelectorAll('table').length,svgs:p.querySelectorAll('svg').length}));
}
window.PythagorasBookDesign={
  apply(scope=document){scope.querySelectorAll('.fallback').forEach(normalize);window.__PYTHAGORAS_DESIGN_AUDIT__=audit(scope);return window.__PYTHAGORAS_DESIGN_AUDIT__},
  audit(scope=document){return audit(scope)}
};
})();
