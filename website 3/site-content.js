/* STEMWorks site content overrides + in-page editor.
   Loaded by every page. Two jobs:
   1. Always: read site-content.json (published edits) + any local draft and apply them.
   2. Only when the page is opened inside admin.html: expose window.SWEdit so the
      admin tool can turn the page into an editable surface.
   No build step, no server. */
(function () {
  var DRAFT_KEY = 'sw-content-draft-v1';
  var TEXT_SEL = 'h1,h2,h3,h4,h5,h6,p,span,a,li,td,th,button,figcaption,blockquote,label,strong,em,dt,dd';
  var data = { text: {}, href: {}, img: {}, alt: {}, crop: {} };
  var ALIAS = { index: 'home', 'stemworks home': 'home', '': 'home' };
  var PAGE = (function () {
    var f = (location.pathname.split('/').pop() || '').replace(/\.dc\.html$|\.html$/i, '').toLowerCase();
    f = decodeURIComponent(f);
    return ALIAS[f] || f || 'home';
  })();
  var applying = false;
  var editingEl = null;

  /* ---------- keys & lookup ---------- */
  function pathOf(el) {
    var parts = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      var tag = el.tagName.toLowerCase(), i = 1;
      for (var s = el.previousElementSibling; s; s = s.previousElementSibling) {
        if (s.tagName === el.tagName) i++;
      }
      parts.unshift(tag + ':nth-of-type(' + i + ')');
      el = el.parentElement;
    }
    return parts.join('>');
  }
  function keyOf(el) {
    var raw;
    if (el.tagName === 'IMG' && el.getAttribute('data-crop')) raw = 'k:' + el.getAttribute('data-crop');
    else if (el.tagName === 'IMAGE-SLOT' && el.id) raw = 's:' + el.id;
    else raw = 'p:' + pathOf(el);
    return PAGE + '|' + raw;
  }
  function resolve(key) {
    var bar = key.indexOf('|');
    if (bar < 0 || key.slice(0, bar) !== PAGE) return null;
    var k = key.slice(bar + 1);
    try {
      if (k.slice(0, 2) === 'k:') return document.querySelector('img[data-crop="' + k.slice(2) + '"]');
      if (k.slice(0, 2) === 's:') return document.getElementById(k.slice(2));
      return document.body.querySelector(k.slice(2));
    } catch (e) { return null; }
  }
  function clean(html) {
    return String(html).replace(/<\s*(script|style|iframe)[\s\S]*?<\s*\/\s*\1\s*>/gi, '').replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
  }

  /* ---------- apply ---------- */
  function applyCrop(el, c) {
    if (!el) return;
    var pos = c.pos || '50% 50%', z = Number(c.zoom) || 1;
    el.style.objectPosition = pos;
    if (z > 1.001) {
      el.style.transformOrigin = pos;
      el.style.transform = 'scale(' + z + ')';
      var p = el.parentElement;
      if (p && getComputedStyle(p).overflow === 'visible') p.style.overflow = 'hidden';
    } else if (el.style.transform.indexOf('scale') > -1) {
      el.style.transform = '';
    }
  }
  function apply() {
    applying = true;
    var k, el;
    for (k in data.text) {
      el = resolve(k);
      if (el && el !== editingEl && el.innerHTML !== data.text[k]) el.innerHTML = data.text[k];
    }
    for (k in data.href) {
      el = resolve(k);
      if (el && el.getAttribute('href') !== data.href[k]) el.setAttribute('href', data.href[k]);
    }
    for (k in data.img) {
      el = resolve(k);
      if (el && el.getAttribute('src') !== data.img[k]) el.setAttribute('src', data.img[k]);
    }
    for (k in data.alt) {
      el = resolve(k);
      if (el && el.getAttribute('alt') !== data.alt[k]) el.setAttribute('alt', data.alt[k]);
    }
    for (k in data.crop) applyCrop(resolve(k), data.crop[k]);
    applying = false;
  }
  var queued = false;
  function scheduleApply() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; if (!applying) apply(); });
  }
  function watch() {
    apply();
    new MutationObserver(function () { if (!applying) scheduleApply(); })
      .observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('load', scheduleApply);
    setTimeout(scheduleApply, 400);
    setTimeout(scheduleApply, 1500);
  }
  function merge(src) {
    if (!src || typeof src !== 'object') return;
    ['text', 'href', 'img', 'alt', 'crop'].forEach(function (g) {
      if (src[g]) for (var k in src[g]) data[g][k] = src[g][k];
    });
  }
  function readDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { return null; }
  }
  function writeDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
  }

  var base = './site-content.json';
  fetch(base, { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; })
    .then(function (json) {
      merge(json);
      merge(readDraft());
      if (document.body) watch();
      else document.addEventListener('DOMContentLoaded', watch);
    });

  /* ---------- editor (admin only) ---------- */
  var STYLE = '[data-sw-hit]{outline:2px dashed #b1312c!important;outline-offset:2px;cursor:text}' +
    '[data-sw-photo]{outline:2px dashed #b1312c!important;outline-offset:-2px;cursor:pointer}' +
    '[data-sw-sel]{outline:3px solid #b1312c!important;outline-offset:-3px}' +
    '[contenteditable="true"],[contenteditable="plaintext-only"]{outline:2px solid #b1312c!important;outline-offset:2px;background:#f7eded}' +
    '.sw-nopointer a{pointer-events:none}';

  var BLOCK_SEL = 'div,p,ul,ol,li,table,tr,section,article,figure,header,footer,nav,form,h1,h2,h3,h4,h5,h6,img,svg,button,input,image-slot,iframe';
  function isTextTarget(el) {
    if (!el || el.nodeType !== 1) return false;
    if (!el.matches(TEXT_SEL)) return false;
    if (!el.textContent || !el.textContent.trim()) return false;
    if (el.querySelector(BLOCK_SEL)) return false;
    return true;
  }
  function textTargetFrom(node) {
    var el = node && node.nodeType === 3 ? node.parentElement : node;
    while (el && el !== document.body) {
      if (isTextTarget(el)) return el;
      el = el.parentElement;
    }
    return null;
  }
  function photoTargetFrom(node) {
    var el = node && node.nodeType === 3 ? node.parentElement : node;
    while (el && el !== document.body) {
      if (el.tagName === 'IMG' || el.tagName === 'IMAGE-SLOT') return el;
      el = el.parentElement;
    }
    return null;
  }

  var mode = 'off', hover = null, sel = null, cb = {};
  function notify() { if (cb.onChange) cb.onChange(count()); }
  function count() {
    var n = 0;
    ['text', 'href', 'img', 'alt', 'crop'].forEach(function (g) { n += Object.keys(data[g]).length; });
    return n;
  }
  function clearHover() {
    if (hover) { hover.removeAttribute('data-sw-hit'); hover.removeAttribute('data-sw-photo'); hover = null; }
  }
  function commitEdit() {
    if (!editingEl) return;
    var el = editingEl, key = keyOf(el);
    editingEl = null;
    el.removeAttribute('contenteditable');
    var html = clean(el.innerHTML).trim();
    data.text[key] = html;
    writeDraft();
    notify();
  }
  function selectPhoto(el) {
    if (sel) sel.removeAttribute('data-sw-sel');
    sel = el;
    if (el) el.setAttribute('data-sw-sel', '');
    if (cb.onSelect) cb.onSelect(selectionInfo());
  }
  function selectionInfo() {
    if (!sel) return null;
    var key = keyOf(sel), c = data.crop[key] || {};
    var r = sel.getBoundingClientRect();
    return {
      key: key,
      kind: sel.tagName === 'IMAGE-SLOT' ? 'slot' : 'img',
      src: sel.getAttribute('src') || '',
      alt: sel.getAttribute('alt') || '',
      zoom: Number(c.zoom) || 1,
      pos: c.pos || sel.style.objectPosition || '50% 50%',
      label: sel.getAttribute('data-crop') || sel.id || '',
      w: Math.round(r.width), h: Math.round(r.height)
    };
  }

  function onOver(e) {
    if (mode === 'off' || editingEl) return;
    var t = mode === 'text' ? textTargetFrom(e.target) : photoTargetFrom(e.target);
    if (t === hover) return;
    clearHover();
    if (t) { t.setAttribute(mode === 'text' ? 'data-sw-hit' : 'data-sw-photo', ''); hover = t; }
  }
  function onClick(e) {
    if (mode === 'off') return;
    if (mode === 'text') {
      var t = textTargetFrom(e.target);
      if (editingEl && editingEl !== t) commitEdit();
      if (!t) return;
      e.preventDefault(); e.stopPropagation();
      clearHover();
      editingEl = t;
      var mode2 = t.children.length ? 'true' : 'plaintext-only';
      try { t.setAttribute('contenteditable', mode2); } catch (err) { t.setAttribute('contenteditable', 'true'); }
      t.focus();
    } else {
      var p = photoTargetFrom(e.target);
      e.preventDefault(); e.stopPropagation();
      if (p) selectPhoto(p);
    }
  }
  function onKey(e) {
    if (!editingEl) return;
    if (e.key === 'Escape') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Enter' && !e.shiftKey && editingEl.tagName !== 'P' && editingEl.tagName !== 'SPAN') {
      e.preventDefault(); commitEdit();
    }
  }

  /* drag to reframe, in photo mode, on the selected image */
  function onDown(e) {
    if (mode !== 'photo') return;
    var p = photoTargetFrom(e.target);
    if (!p || p.tagName !== 'IMG') return;
    if (p !== sel) selectPhoto(p);
    var key = keyOf(p), c = data.crop[key] || {};
    var start = parsePos(c.pos || p.style.objectPosition || '50% 50%');
    var r = p.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, moved = false;
    e.preventDefault();
    function move(ev) {
      moved = true;
      var nx = clamp(start.x - (ev.clientX - sx) / r.width * 100, 0, 100);
      var ny = clamp(start.y - (ev.clientY - sy) / r.height * 100, 0, 100);
      var pos = Math.round(nx) + '% ' + Math.round(ny) + '%';
      data.crop[key] = { pos: pos, zoom: (data.crop[key] && data.crop[key].zoom) || 1 };
      applyCrop(p, data.crop[key]);
    }
    function up() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (moved) { writeDraft(); notify(); if (cb.onSelect) cb.onSelect(selectionInfo()); }
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
  function parsePos(s) {
    var m = String(s).match(/(-?[\d.]+)%\s+(-?[\d.]+)%/);
    return m ? { x: +m[1], y: +m[2] } : { x: 50, y: 50 };
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  var inited = false;
  window.SWEdit = {
    init: function (opts) {
      cb = opts || cb;
      if (inited) { notify(); return true; }
      inited = true;
      var st = document.createElement('style');
      st.textContent = STYLE;
      document.head.appendChild(st);
      document.addEventListener('mouseover', onOver, true);
      document.addEventListener('click', onClick, true);
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('pointerdown', onDown, true);
      notify();
      return true;
    },
    setMode: function (m) {
      commitEdit();
      clearHover();
      mode = m;
      document.body.classList.toggle('sw-nopointer', m !== 'off');
      if (m !== 'photo') selectPhoto(null);
    },
    getMode: function () { return mode; },
    count: count,
    getData: function () { return JSON.parse(JSON.stringify(data)); },
    setData: function (d) {
      data = { text: {}, href: {}, img: {}, alt: {}, crop: {} };
      merge(d);
      writeDraft();
      apply();
      notify();
    },
    clearAll: function () {
      try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
      location.reload();
    },
    selection: selectionInfo,
    selectNext: function (dir) {
      var imgs = Array.prototype.slice.call(document.querySelectorAll('img, image-slot'))
        .filter(function (i) { return i.getBoundingClientRect().width > 40; });
      if (!imgs.length) return;
      var i = imgs.indexOf(sel);
      selectPhoto(imgs[(i + (dir || 1) + imgs.length) % imgs.length]);
      if (sel.scrollIntoView) sel.scrollIntoView({ block: 'center' });
    },
    replaceSelected: function (src) {
      if (!sel) return;
      data.img[keyOf(sel)] = src;
      sel.setAttribute('src', src);
      writeDraft(); notify();
      if (cb.onSelect) cb.onSelect(selectionInfo());
    },
    setAltSelected: function (t) {
      if (!sel) return;
      data.alt[keyOf(sel)] = t;
      sel.setAttribute('alt', t);
      writeDraft(); notify();
    },
    setZoomSelected: function (z) {
      if (!sel || sel.tagName !== 'IMG') return;
      var key = keyOf(sel), c = data.crop[key] || {};
      data.crop[key] = { pos: c.pos || sel.style.objectPosition || '50% 50%', zoom: z };
      applyCrop(sel, data.crop[key]);
      writeDraft(); notify();
      if (cb.onSelect) cb.onSelect(selectionInfo());
    },
    setPosSelected: function (pos) {
      if (!sel || sel.tagName !== 'IMG') return;
      var key = keyOf(sel), c = data.crop[key] || {};
      data.crop[key] = { pos: pos, zoom: c.zoom || 1 };
      applyCrop(sel, data.crop[key]);
      writeDraft(); notify();
      if (cb.onSelect) cb.onSelect(selectionInfo());
    },
    nudgeSelected: function (dx, dy) {
      if (!sel || sel.tagName !== 'IMG') return;
      var key = keyOf(sel), c = data.crop[key] || {}, p = parsePos(c.pos || sel.style.objectPosition || '50% 50%');
      data.crop[key] = { pos: clamp(p.x + dx, 0, 100) + '% ' + clamp(p.y + dy, 0, 100) + '%', zoom: c.zoom || 1 };
      applyCrop(sel, data.crop[key]);
      writeDraft(); notify();
      if (cb.onSelect) cb.onSelect(selectionInfo());
    },
    resetSelected: function () {
      if (!sel) return;
      var key = keyOf(sel);
      delete data.crop[key]; delete data.img[key]; delete data.alt[key];
      sel.style.objectPosition = ''; sel.style.transform = '';
      writeDraft(); notify();
      location.reload();
    },
    commitEdit: commitEdit
  };
})();
