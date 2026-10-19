/*
 * עורך־הטקסט המקומי של חוברת פיתגורס.
 * נטען רק במצב ?edit=1 (ראו tools/dev-server.js) — כלי פיתוח מקומי, לעולם לא נכלל בפרודקשן.
 *
 * מה הוא עושה:
 *   • בונה סרגל עליון עם ניווט לפי סדר החוברת (1→53) + כפתור שמירה.
 *   • הופך כל אלמנט־טקסט שסומן (data-ed) לעריך במקום — לוחצים וכותבים.
 *   • שומר רק את מה שנערך, בדיוק כירורגי, דרך /api/save-text (גיבוי .bak נשמר בשרת).
 */
(function () {
  'use strict';
  var FILE = decodeURIComponent(location.pathname.replace(/^\//, ''));
  var dirty = new Map();       // ed(string) -> {el, before}
  var before = new Map();      // ed(string) -> original text

  document.addEventListener('DOMContentLoaded', function () {
    document.body.classList.add('ped-on');
    buildBar();
    wireEditables();
    loadManifest();
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    });
    window.addEventListener('beforeunload', function (e) {
      if (dirty.size) { e.preventDefault(); e.returnValue = ''; }
    });
  });

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var bar, sel, saveBtn, toastEl;

  function buildBar() {
    bar = el('div', 'ped-bar');
    var brand = el('div', 'ped-brand');
    brand.appendChild(el('span', 'ped-dot'));
    brand.appendChild(el('span', null, 'עריכת מלל — חוברת פיתגורס'));
    bar.appendChild(brand);

    var nav = el('div', 'ped-nav');
    nav.appendChild(el('label', null, 'עמוד:'));
    sel = el('select');
    sel.setAttribute('aria-label', 'בחירת עמוד לפי סדר החוברת');
    sel.addEventListener('change', function () {
      if (dirty.size && !confirm('יש שינויים שלא נשמרו. לעבור עמוד ולאבד אותם?')) { syncSelect(); return; }
      location.href = '/' + encodeURIComponent(sel.value) + '?edit=1';
    });
    nav.appendChild(sel);
    bar.appendChild(nav);

    saveBtn = el('button', 'ped-btn ped-save', 'שמור שינויים');
    saveBtn.type = 'button';
    saveBtn.disabled = true;
    saveBtn.addEventListener('click', save);
    bar.appendChild(saveBtn);

    bar.appendChild(el('div', 'ped-hint',
      'לחצו על טקסט כדי לערוך. הנוסחאות מוצגות כקוד \\(x\\) כדי שאפשר לערוך אותן. Ctrl+S לשמירה.'));

    toastEl = el('div', 'ped-toast');
    document.body.appendChild(bar);
    document.body.appendChild(toastEl);
  }

  function wireEditables() {
    var nodes = document.querySelectorAll('[data-ed]');
    nodes.forEach(function (node) {
      var id = node.getAttribute('data-ed');
      before.set(id, node.textContent);
      node.setAttribute('contenteditable', 'plaintext-only');
      // גיבוי לדפדפנים שלא תומכים ב-plaintext-only
      if (node.contentEditable !== 'plaintext-only') node.setAttribute('contenteditable', 'true');
      node.setAttribute('spellcheck', 'false');
      node.addEventListener('input', function () { onEdit(id, node); });
      node.addEventListener('keydown', function (e) {
        // Enter = שורה חדשה כטקסט (לא <div>/<br>); Esc = ביטול העריכה הנוכחית
        if (e.key === 'Enter' && node.getAttribute('contenteditable') === 'true') {
          e.preventDefault();
          document.execCommand('insertText', false, '\n');
        } else if (e.key === 'Escape') {
          e.preventDefault(); node.textContent = before.get(id); onEdit(id, node); node.blur();
        }
      });
      node.addEventListener('paste', function (e) {
        e.preventDefault();
        var t = (e.clipboardData || window.clipboardData).getData('text');
        document.execCommand('insertText', false, t);
      });
    });
  }

  function onEdit(id, node) {
    if (node.textContent === before.get(id)) { dirty.delete(id); node.classList.remove('ped-dirty'); }
    else { dirty.set(id, { el: node, before: before.get(id) }); node.classList.add('ped-dirty'); }
    refreshSave();
  }

  function refreshSave() {
    saveBtn.disabled = dirty.size === 0;
    saveBtn.textContent = dirty.size ? ('שמור שינויים (' + dirty.size + ')') : 'שמור שינויים';
  }

  function save() {
    if (!dirty.size) return;
    var edits = [];
    dirty.forEach(function (v, id) {
      edits.push({ ed: Number(id), before: v.before, after: v.el.textContent });
    });
    saveBtn.disabled = true; saveBtn.textContent = 'שומר…';
    fetch('/api/save-text', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: FILE, edits: edits }),
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (!res || !res.ok) { toast('השמירה נכשלה: ' + ((res && res.error) || 'שגיאה'), 'err'); refreshSave(); return; }
      var okIds = {}, skipped = [];
      (res.results || []).forEach(function (r2) {
        if (r2.ok) okIds[r2.ed] = 1; else skipped.push(r2.ed);
      });
      // מעדכנים בסיס ומנקים dirty לעריכות שנשמרו
      Array.from(dirty.keys()).forEach(function (id) {
        if (okIds[Number(id)]) {
          var v = dirty.get(id);
          before.set(id, v.el.textContent);
          v.el.classList.remove('ped-dirty');
          dirty.delete(id);
        }
      });
      refreshSave();
      if (skipped.length) toast('נשמרו ' + res.changed + ' · דולגו ' + skipped.length + ' (ריעננו ונסו שוב)', 'err');
      else toast('נשמרו ' + res.changed + ' שינויים ✓', 'ok');
    }).catch(function (err) {
      toast('השמירה נכשלה: ' + err.message, 'err'); refreshSave();
    });
  }

  var toastTimer;
  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = 'ped-toast ped-show' + (kind ? ' ped-' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = 'ped-toast'; }, 3200);
  }

  function syncSelect() { if (sel) sel.value = FILE; }

  function loadManifest() {
    fetch('/WORKBOOK_MANIFEST.json').then(function (r) { return r.json(); }).then(function (m) {
      var pages = (m && m.pages) || [];
      sel.innerHTML = '';
      pages.forEach(function (p, i) {
        var o = document.createElement('option');
        o.value = p.file;
        o.textContent = (i + 1) + ' מתוך ' + pages.length + '  ·  עמ׳ ' + (p.sourceNumber != null ? p.sourceNumber : '?');
        sel.appendChild(o);
      });
      syncSelect();
    }).catch(function () {
      var o = document.createElement('option'); o.value = FILE; o.textContent = FILE; sel.appendChild(o);
    });
  }
})();
