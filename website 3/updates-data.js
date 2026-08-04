/* STEMWorks updates.
   Reads updates.txt and turns it into post objects.
   Used by updates.html and by the Home page's latest-updates list.
   No build step, no server. */
(function () {
  var KEYS = 'date|team|result|photo|caption|author|link|linktext|link text|photos';
  var MON = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function driveId(u) {
    var m = u.match(/\/file\/d\/([^/?#]+)/) || u.match(/[?&]id=([^&#]+)/);
    return m ? m[1] : null;
  }

  /* Turn whatever link was pasted into something a browser can actually show. */
  function normalize(u) {
    u = String(u || '').trim();
    if (!u) return { src: '', warn: '' };
    if (/drive\.google\.com/.test(u)) {
      var id = driveId(u);
      if (id) return { src: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600', warn: '' };
    }
    if (/googleusercontent\.com/.test(u)) {
      return { src: /=[whs]\d+/.test(u) ? u : u.split('=')[0] + '=w1600', warn: '' };
    }
    if (/photos\.app\.goo\.gl|photos\.google\.com/.test(u)) {
      return { src: '', warn: 'This is a Google Photos share link, which a website cannot display. Open the photo in Google Photos, right-click it, choose \u201cCopy image address,\u201d and paste that link instead \u2014 or put the file in Google Drive, share it \u201cAnyone with the link,\u201d and paste the Drive link.' };
    }
    return { src: u, warn: '' };
  }

  function photoEntry(raw) {
    var parts = String(raw).split('|');
    var n = normalize(parts[0]);
    return { src: n.src, warn: n.warn, cap: (parts[1] || '').trim(), raw: String(parts[0]).trim(), ok: !!n.src };
  }

  function parseDate(s) {
    s = String(s || '').trim();
    if (!s) return null;
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  function fmtDate(d) { return MON[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'post';
  }

  function blank(title) {
    return { title: title, paras: [], gallery: [], team: '', date: '', result: '',
             caption: '', author: '', link: '', linktext: '', heroRaw: '' };
  }

  function isPhotoLine(t) {
    return /^(https?:\/\/|\/|\.\/|assets\/)/i.test(t) || /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(t);
  }

  function parse(txt) {
    var lines = String(txt || '').replace(/\r\n?/g, '\n').split('\n');
    var posts = [], cur = null, inPhotos = false, buf = [];
    var keyRe = new RegExp('^(' + KEYS + ')\\s*:\\s*(.*)$', 'i');

    function flush() { var t = buf.join(' ').trim(); if (t && cur) cur.paras.push({ t: t }); buf = []; }
    function push() { if (cur) { flush(); posts.push(cur); } }

    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (/^#(?!#)/.test(lines[i])) { push(); cur = blank(t.replace(/^#\s*/, '')); inPhotos = false; buf = []; continue; }
      if (!cur) continue;                                  // anything before the first # is a note to yourself
      if (/^-{3,}$/.test(t)) { flush(); inPhotos = false; continue; }
      if (!t) { flush(); inPhotos = false; continue; }
      if (inPhotos) {
        if (isPhotoLine(t)) { cur.gallery.push(photoEntry(t)); continue; }
        inPhotos = false;
      }
      var m = t.match(keyRe);
      if (m) {
        flush();
        var k = m[1].toLowerCase().replace(/\s+/g, ''), v = m[2].trim();
        if (k === 'photos') { inPhotos = true; if (v) cur.gallery.push(photoEntry(v)); continue; }
        if (k === 'photo') { cur.heroRaw = v; continue; }
        cur[k] = v;
        continue;
      }
      buf.push(t.replace(/^#+\s*/, ''));
    }
    push();

    posts.forEach(function (p, i) {
      var h = p.heroRaw ? photoEntry(p.heroRaw) : null;
      p.hero = h ? h.src : '';
      p.heroWarn = h ? h.warn : '';
      if (h && h.cap && !p.caption) p.caption = h.cap;
      p.heroAlt = p.caption || p.title || 'STEMWorks photo';
      p.hasHero = !!p.hero;
      p.d = parseDate(p.date);
      p.dateLabel = p.d ? fmtDate(p.d) : (p.date || '');
      p.stamp = p.d ? p.d.getTime() : -Infinity;
      p.gallery = p.gallery.filter(function (g) { return g.src || g.warn; });
      p.hasGallery = p.gallery.length > 0;
      p.hasLink = !!p.link;
      p.linkText = p.linktext || 'Read more';
      p.hasTitle = !!p.title;
      p.hasResult = !!p.result;
      p.hasCaption = !!p.caption;
      p.hasAuthor = !!p.author;
      p.hasTeam = !!p.team;
      p.id = slug(p.title || p.date || ('post-' + (i + 1)));
      p.order = i;
    });
    posts.sort(function (a, b) { return (b.stamp - a.stamp) || (a.order - b.order); });
    return posts;
  }

  function load(url) {
    return fetch(url || './updates.txt', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .catch(function () { return ''; })
      .then(parse);
  }

  window.SWUpdates = { parse: parse, load: load, normalize: normalize };
})();
