/* AIPEX · site.js
   Motion + data layer. Data hooks used by firebase-analytics.js:
   window.mergeExtraProjects, window.mergeTestimonials, window.logProjectView */
(() => {
'use strict';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const root = document.documentElement;
const reduced = root.classList.contains('is-reduced');
const touch = root.classList.contains('is-touch');
const pad = (n, l = 2) => String(n).padStart(l, '0');
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const hdrH = () => parseFloat(getComputedStyle(root).getPropertyValue('--hdr')) || 68;

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (location.hash) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
scrollTo(0, 0);
addEventListener('pageshow', () => { if (root.classList.contains('is-loading')) scrollTo(0, 0); });
const yr = $('#year'); if (yr) yr.textContent = new Date().getFullYear();

let lenis = null;
let refreshTimer = 0;
const refreshSoon = () => {
  if (!window.ScrollTrigger) return;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 160);
};

/* =====================================================
   DATA LAYER: projects, films, reviews, player
   ===================================================== */
let baseProjects = [], extraProjects = [], extraSig = '[]';
let portfolioReady = false, suppressReveal = false;
const revealedKeys = new Set();
let category = 'All', limit = 12;
let testimonials = [];

const projectsAll = () => baseProjects.concat(extraProjects);
/* the site never shows dashes: a dash that arrives with the data (titles, quotes, admin entries) becomes a colon or a comma.
   Only the text shown on the page is cleaned; the analytics call still receives the raw title, so existing view counts are untouched. */
const DASHES = String.fromCharCode(0x2014, 0x2013);
const DASH = new RegExp(' *[' + DASHES + '] *', 'g');
const tidyTitle = (s) => String(s == null ? '' : s).replace(DASH, ': ');
const tidyText = (s) => String(s == null ? '' : s).replace(DASH, ', ');
const keyOf = (p) => p.category + '|' + tidyTitle(p.title) + '|' + p.mediaUrl;

const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    if (e.target.dataset.key) revealedKeys.add(e.target.dataset.key);
    io.unobserve(e.target);
  });
}, { threshold: 0.06, rootMargin: '0px 0px -4% 0px' }) : null;

function reveal(node, key) {
  if (key) node.dataset.key = key;
  if (reduced || !io || (suppressReveal && key && revealedKeys.has(key))) { node.classList.add('in'); return; }
  io.observe(node);
}

/* ---- video modal ---- */
const dialog = $('#player'), player = $('#player-video');
const playerImage = el('img', 'player-image'); playerImage.hidden = true; playerImage.alt = ''; if (player) player.after(playerImage);

function openProject(p) {
  if (!dialog || !player) return;
  if (window.logProjectView) window.logProjectView(p.title, p.category);
  $('#player-title').textContent = tidyTitle(p.title);
  $('#player-category').textContent = p.category;
  $('#player-error').hidden = true;
  const isImage = p.mediaType === 'image';
  player.hidden = isImage; playerImage.hidden = !isImage; playerImage.alt = tidyTitle(p.title);
  if (isImage) playerImage.src = p.mediaUrl; else { player.src = p.mediaUrl; player.poster = p.poster || ''; }
  dialog.showModal();
  if (lenis) lenis.stop(); else document.body.style.overflow = 'hidden';
  if (!isImage) player.play().catch(() => {});
}
if (dialog) {
  const closePlayer = () => dialog.close();
  $('#close-player').addEventListener('click', closePlayer);
  dialog.addEventListener('click', (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closePlayer();
  });
  dialog.addEventListener('close', () => {
    player.pause(); player.removeAttribute('src'); player.load();
    if (lenis) lenis.start(); else document.body.style.overflow = '';
  });
  player.addEventListener('error', () => { $('#player-error').hidden = false; });
}

/* ---- hover preview (website rows) ---- */
const peek = $('#peek'), peekImg = peek && $('img', peek);
let peekX = null, peekY = null;
function peekMove(e) { if (peekX) { peekX(e.clientX + 28); peekY(e.clientY - 80); } }
function peekOn(src) {
  if (!peek || !window.gsap || !src) return;
  if (!peekX) { peekX = gsap.quickTo(peek, 'x', { duration: .6, ease: 'power3' }); peekY = gsap.quickTo(peek, 'y', { duration: .6, ease: 'power3' }); }
  peekImg.src = src;
  gsap.to(peek, { opacity: 1, scale: 1, duration: .45, ease: 'power3.out', overwrite: 'auto' });
}
function peekOff() { if (peek && window.gsap) gsap.to(peek, { opacity: 0, scale: .92, duration: .3, overwrite: 'auto' }); }

/* ---- websites list ---- */
function siteRow(p, i) {
  const li = document.createElement('li');
  const b = el('button', 'row'); b.type = 'button'; b.setAttribute('aria-label', 'Watch ' + tidyTitle(p.title));
  const a = el('span', 'row-a', '↗'); a.setAttribute('aria-hidden', 'true');
  // thumbnail: the poster if there is one, otherwise a still frame of the video (entries added from the admin may have no poster)
  const th = el('span', 'row-th'); th.setAttribute('aria-hidden', 'true');
  const still = p.poster || (p.mediaType === 'image' ? p.mediaUrl : '');
  if (still) { const img = new Image(); img.src = still; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; th.append(img); }
  else { const v = document.createElement('video'); v.src = p.mediaUrl + '#t=0.1'; v.muted = true; v.playsInline = true; v.preload = 'metadata'; th.append(v); }
  b.append(el('span', 'row-i', pad(i + 1)), th, el('span', 'row-t', tidyTitle(p.title)), el('span', 'row-k', tidyText(p.kind) || 'Web experience'), a);
  b.addEventListener('click', () => openProject(p));
  li.append(b);
  reveal(li, keyOf(p));
  return li;
}
function renderSites() {
  const list = projectsAll().filter((p) => p.category === 'Websites');
  const ul = $('#siteRows'); if (!ul) return;
  ul.replaceChildren(...list.map(siteRow));
  const n = $('#siteCount'); if (n) n.textContent = pad(list.length) + (list.length === 1 ? ' project' : ' projects');
}

/* ---- films grid ---- */
const filmsFiltered = () => projectsAll().filter((p) => p.category !== 'Websites' && (category === 'All' || p.category === category));
function filmCell(p, i, d) {
  const cell = el('div', 'cell'); cell.style.setProperty('--d', d);
  const b = el('button', 'film'); b.type = 'button'; b.setAttribute('aria-label', 'Watch ' + tidyTitle(p.title));
  const v = el('div', 'film-v');
  if (p.poster || p.mediaType === 'image') {
    const img = new Image(); img.src = p.poster || p.mediaUrl; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; v.append(img);
  } else {
    const still = document.createElement('video'); still.src = p.mediaUrl + '#t=0.1'; still.muted = true; still.playsInline = true; still.preload = 'metadata'; v.append(still);
  }
  const play = el('span', 'film-play', '↗'); play.setAttribute('aria-hidden', 'true'); v.append(play);
  const m = el('div', 'film-m'); m.append(el('span', 'film-t', tidyTitle(p.title)), el('span', 'film-n', pad(i + 1)));
  b.append(v, m, el('span', 'film-c', p.category + ' / film'));
  b.addEventListener('click', () => openProject(p));
  let preview = null;
  b.addEventListener('pointerenter', () => {
    if (p.mediaType === 'image' || touch || reduced) return;
    preview = document.createElement('video'); preview.muted = true; preview.loop = true; preview.playsInline = true; preview.src = p.mediaUrl;
    preview.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none';
    v.insertBefore(preview, play); preview.play().catch(() => {});
  });
  b.addEventListener('pointerleave', () => { if (preview) { preview.pause(); preview.removeAttribute('src'); preview.load(); preview.remove(); preview = null; } });
  cell.append(b);
  reveal(cell, keyOf(p));
  return cell;
}
function renderFilters() {
  const box = $('#filters'); if (!box) return;
  const cats = ['All', ...new Set(projectsAll().filter((p) => p.category !== 'Websites').map((p) => p.category))];
  if (category !== 'All' && !cats.includes(category)) category = 'All';
  box.replaceChildren(...cats.map((c) => {
    const b = el('button', 'filter' + (c === category ? ' is-on' : ''), c); b.type = 'button'; b.setAttribute('aria-pressed', String(c === category));
    b.addEventListener('click', () => { category = c; limit = 12; renderFilters(); renderFilms(); });
    return b;
  }));
}
function renderFilms() {
  const grid = $('#filmGrid'); if (!grid) return;
  const f = filmsFiltered();
  grid.replaceChildren(...f.slice(0, limit).map((p, i) => filmCell(p, i, i % 5)));
  const note = $('#filmCount'); if (note) note.textContent = f.length + ' films / ' + category.toLowerCase();
  const more = $('#loadMore'); if (more) { more.hidden = limit >= f.length; more.textContent = 'Keep exploring (' + (f.length - Math.min(limit, f.length)) + ' more)'; }
}
function appendFilms() {
  const grid = $('#filmGrid'); const f = filmsFiltered(); const start = grid.children.length;
  f.slice(start, limit).forEach((p, i) => grid.append(filmCell(p, start + i, i % 5)));
  const more = $('#loadMore'); more.hidden = limit >= f.length; more.textContent = 'Keep exploring (' + (f.length - Math.min(limit, f.length)) + ' more)';
  const note = $('#filmCount'); if (note) note.textContent = f.length + ' films / ' + category.toLowerCase();
  refreshSoon();
}
const lm = $('#loadMore'); if (lm) lm.addEventListener('click', () => { limit += 12; appendFilms(); });

function renderWork() { renderSites(); renderFilters(); renderFilms(); refreshSoon(); }

window.mergeExtraProjects = (extra) => {
  if (!extra) return;
  const next = [
    ...(extra.websites || []).filter((p) => p && p.video).map((p) => ({ title: p.name, category: 'Websites', mediaUrl: p.video, poster: p.poster || '', mediaType: 'video', kind: p.type || '' })),
    ...(extra.ugc || []).filter((p) => p && p.video).map((p) => ({ title: p.name, category: p.category || 'Other', mediaUrl: p.video, poster: '', mediaType: 'video' }))
  ];
  const sig = JSON.stringify(next);
  if (sig === extraSig) return;
  extraSig = sig; extraProjects = next;
  if (!portfolioReady) return;
  suppressReveal = true; renderWork(); suppressReveal = false;
};

(async function loadPortfolio() {
  try {
    const r = await fetch('assets/portfolio.json');
    if (!r.ok) throw Error();
    baseProjects = (await r.json()).projects;
    portfolioReady = true;
    renderWork();
  } catch (e) {
    const ul = $('#siteRows'); if (ul) ul.textContent = 'The portfolio could not load. Please refresh to try again.';
  }
})();

/* ---- reviews ---- */
/* attribution is "Name, Role"; entries saved earlier with a dash or a middle dot between the two still split the same way */
function splitCite(cite) {
  const s = String(cite || '').trim();
  let parts = s.split(new RegExp(' +[' + DASHES + '-] +| +· +'));
  if (parts.length < 2) { const i = s.indexOf(', '); parts = i > 0 ? [s.slice(0, i), s.slice(i + 2)] : [s]; }
  return { name: tidyTitle(parts[0]), role: parts.slice(1).map(tidyTitle).join(', ') };
}
function renderReviews() {
  const sec = $('#reviews'), ol = $('#revList'); if (!sec || !ol) return;
  const has = testimonials.length > 0;
  sec.hidden = !has;
  $$('[data-needs-reviews]').forEach((a) => { a.style.display = has ? '' : 'none'; });
  if (!has) { refreshSoon(); return; }
  ol.replaceChildren(...testimonials.map((t, i) => {
    const c = splitCite(t.cite);
    const li = el('li', 'rev-row'); li.style.setProperty('--d', 0);
    const who = el('div', 'rev-w'); who.append(el('span', 'rev-n', c.name || 'Client'));
    if (c.role) who.append(el('span', 'rev-r', c.role));
    li.append(el('span', 'rev-i', pad(i + 1, 3)), who, el('p', 'rev-q', '“' + tidyText(t.quote) + '”'));
    reveal(li, 'rev|' + i + '|' + tidyText(t.quote).slice(0, 24));
    return li;
  }));
  refreshSoon();
}
window.mergeTestimonials = (list) => { testimonials = Array.isArray(list) ? list : []; renderReviews(); };

/* =====================================================
   MOTION
   ===================================================== */
const hasGsap = !!(window.gsap && window.ScrollTrigger);
const failSafe = () => { root.classList.add('no-anim'); root.classList.remove('is-loading'); };

function seeded(i) {
  let a = (i + 1) * 2654435761 >>> 0; const out = [];
  for (let k = 0; k < 6; k++) { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); out.push(((t ^ t >>> 14) >>> 0) / 4294967296); }
  return out;
}
function splitWords(node) {
  const words = node.textContent.trim().split(/\s+/);
  node.textContent = '';
  return words.map((w, i) => {
    const s = el('span', 'w', w); node.append(s); if (i < words.length - 1) node.append(document.createTextNode(' ')); return s;
  });
}
const rise = (targets, vars = {}) => gsap.fromTo(targets, { yPercent: 115, y: 0 }, Object.assign({ yPercent: 0, y: 0, duration: 1.3, ease: 'expo.out', stagger: .1, overwrite: 'auto' }, vars));

function initMotion() {
  gsap.registerPlugin(ScrollTrigger);
  const slow = /[?&]slow=([\d.]+)/.exec(location.search);       // test switch: ?slow=0.2 plays every animation at 20% speed
  if (slow) gsap.globalTimeline.timeScale(+slow[1]);

  /* smooth scroll */
  if (!reduced && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, touchMultiplier: 1.3 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  const scrollToTarget = (target, opts = {}) => {
    if (lenis) lenis.scrollTo(target, Object.assign({ duration: 1.7, easing: (t) => 1 - Math.pow(1 - t, 4) }, opts));
    else if (typeof target === 'number') scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' });
    else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  };

  const mm = gsap.matchMedia();

  /* ---------- 3D logo: coloured faces + a stacked navy wall (the opening, the reviews and the footer all use it) ---------- */
  const make3d = (host, walls) => {
    const tilt = el('div', 'tilt'), turn = el('div', 'turn'), stage = el('div', 'stage');
    const face = (cls, k) => { const s = el('div', 'sl ' + cls); s.style.setProperty('--k', k); return s; };
    stage.append(face('sl--b', -.5));
    for (let i = 1; i <= walls; i++) stage.append(face('', i / (walls + 1) - .5));
    stage.append(face('sl--f', .5));
    turn.append(stage); tilt.append(turn); host.append(tilt);
    return { tilt, turn, stage };
  };

  /* ---------- intro: the logo turns on the site's own grid, then flies to its place and the site rises around it ---------- */
  const heroIn = (dock) => {
    const tl = gsap.timeline();
    if (dock) {   // the logo's landing brings the brand in (icon first, then the word slides out from behind it)
      gsap.set('.hero-bar .brand img', { opacity: 0 });
      gsap.set('.hero-bar .brand-word', { clipPath: 'inset(0 100% 0 0)' });
    } else tl.fromTo('.hero-bar .brand', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out' }, 0);
    tl.fromTo('.hero-nav a', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: .06 }, .08)
      .fromTo('.hero-bar .pill', { opacity: 0, scale: .85 }, { opacity: 1, scale: 1, duration: 1, ease: 'expo.out' }, .2)
      .fromTo('.hero-info .mini, .hero-info p', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: .07 }, .22)
      .fromTo('.hero-rule', { scaleX: 0 }, { scaleX: 1, duration: 1.6, ease: 'expo.out' }, .1)
      .add(rise('#heroH1 .ln>span', { duration: 1.5, stagger: .12 }), .12)
      .fromTo('.hero-cta p, .hero-cta .u-link', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: .1 }, .55)
      .fromTo('.hero-thumb-img', { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 1.4, ease: 'expo.out' }, .75)
      .fromTo('.hero-thumb-img img', { scale: 1.3 }, { scale: 1, duration: 1.8, ease: 'expo.out' }, .75)
      .fromTo('.hero-thumb-cap, .scroll-cue', { opacity: 0 }, { opacity: 1, duration: 1, ease: 'power2.out' }, 1.1);
    return tl;
  };

  const finishIntro = () => {
    root.classList.remove('is-loading');
    if (lenis) lenis.start();
    ScrollTrigger.refresh();
  };

  const pl = $('#pl');
  if (!pl || reduced) {
    heroIn(false).progress(1);
    finishIntro();
  } else {
    const pct = $('#plPct'), cnt = $('#plCount'), bar = $('#plBar'), plLogo = $('#plLogo'), shadow = $('#plShadow'), plBg = $('.pl-bg', pl);
    const lg = make3d(plLogo, 8);                                // window.AipexFx (the background engine) loads after this file, so it is looked up when needed
    const prog = { v: 0 };
    const paint = () => {
      const v = prog.v;
      pct.textContent = Math.round(v) + '%';
      cnt.textContent = pad(Math.round(v), 3) + ' / 100';
      bar.style.transform = 'scaleX(' + (v / 100) + ')';
    };

    /* the mark turns around itself and bobs a little (like the one in the reviews and the footer) while the grid lights up around it */
    gsap.set(lg.tilt, { rotationX: -8 });
    const spin = gsap.to(lg.stage, { rotationY: 360, duration: 4.4, ease: 'none', repeat: -1 });
    const bob = gsap.to(lg.tilt, { rotationX: 8, y: -7, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    const size0 = plLogo.getBoundingClientRect().width;
    pl.style.setProperty('--lw', size0 + 'px'); pl.style.setProperty('--lh', (size0 * .56) + 'px');
    const orb = { a: 0 };
    const orbit = gsap.to(orb, { a: Math.PI * 2, duration: 5.2, ease: 'none', repeat: -1, onUpdate: () => {
      const fx = window.AipexFx; if (!fx) return;
      const r = plLogo.getBoundingClientRect();
      fx.drive(r.left + r.width / 2 + Math.cos(orb.a) * r.width * 1.15, r.top + r.height / 2 + Math.sin(orb.a) * r.width * .6);
    } });

    /* the transition: the mark slows to face front, flies to the brand's place on an arc and wakes the grid on the way; where it lands a
       ripple runs through the page and the opening melts into the identical background while the headline rises */
    const exit = () => {
      const fx = window.AipexFx;
      try {
        orbit.kill(); spin.pause(); bob.pause();
        const mob = matchMedia('(max-width: 900px)').matches, hdrEl = $('#hdr');
        const brandImg = mob ? $('.hdr .brand img.brand-i:not(.brand-i--inv)') : $('.hero-bar .brand img');
        const r0 = plLogo.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
        const tr = brandImg.getBoundingClientRect(), offY = mob ? -hdrEl.getBoundingClientRect().top : 0;   // the header waits above the screen while loading
        const tx = tr.left + tr.width / 2, ty = tr.top + offY + tr.height / 2, ts = tr.width / r0.width;
        const wrap = $('.fx-wrap', pl);
        const follow = () => { if (!fx) return; const r = plLogo.getBoundingClientRect(); fx.drive(r.left + r.width / 2, r.top + r.height / 2); };
        const land = () => {
          gsap.set(brandImg, { opacity: 1 });
          gsap.to(plLogo, { opacity: 0, duration: .35, ease: 'power1.out' });
          if (!mob) gsap.to('.hero-bar .brand-word', { clipPath: 'inset(0 0% 0 0)', duration: 1.2, ease: 'expo.out' });
          if (fx) { fx.ripple(tx, ty, { size: Math.hypot(innerWidth, innerHeight) * 2.2, dur: 2.4 }); fx.release(); }
          if (mob) hdrEl.style.transition = 'none';             // the header is simply there under the landing mark
          pl.style.pointerEvents = 'none';                       // the page is usable as soon as the mark has landed
          finishIntro();
          if (mob) requestAnimationFrame(() => requestAnimationFrame(() => { hdrEl.style.transition = ''; }));
        };
        const rotY = gsap.getProperty(lg.stage, 'rotationY');
        const tl = gsap.timeline({ onComplete: () => { gsap.set(pl, { display: 'none' }); if (fx) fx.release(); } });
        tl.to('.pl-top, .pl-bot', { opacity: 0, duration: .5, ease: 'power2.in' }, 0)
          .to(shadow, { opacity: 0, duration: .6, ease: 'power2.out' }, 0)
          .to(lg.stage, { rotationY: Math.ceil((rotY + 240) / 360) * 360, duration: 1.9, ease: 'power3.out' }, 0)       // the turn slows to a stop, facing front
          .to(lg.tilt, { rotationX: 0, y: 0, duration: 1.1, ease: 'power2.out' }, 0)
          .to(plLogo, { x: tx - cx, duration: 1.7, ease: 'power3.inOut' }, .35)                                         // x and y on different curves make the path an arc
          .to(plLogo, { y: ty - cy, duration: 1.5, ease: 'power2.inOut' }, .35)
          .to(plLogo, { scale: ts, duration: 1.7, ease: 'power3.inOut', onUpdate: follow }, .35)
          .add(land, 2.0)
          .to([plBg, wrap].filter(Boolean), { opacity: 0, duration: 1.5, ease: 'power1.inOut' }, 1.0)                  // the identical background is already behind it
          .add(heroIn(true), 1.1);
      } catch (e) {
        gsap.set('.hero-bar .brand img', { opacity: 1 }); gsap.set('.hero-bar .brand-word', { clipPath: 'none' });
        gsap.set(pl, { display: 'none' }); heroIn(false).progress(1); if (fx) fx.release(); finishIntro();
      }
    };

    const tl = gsap.timeline({ paused: true });
    tl.to(prog, { v: 100, duration: 1.7, ease: 'power2.inOut', onUpdate: paint })
      .to({}, { duration: .25 })
      .add(exit);
    paint();
    Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 2600))]).then(() => tl.play());
  }

  /* ---------- header + scroll cue ---------- */
  const hdr = $('#hdr');
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => hdr.classList.toggle('is-on', self.scroll() > innerHeight * .58) });
  if (!reduced) gsap.to('.hero-thumb', { yPercent: -28, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  /* ---------- statement: words converge ---------- */
  const stmtText = $('#stmtText');
  const words = splitWords(stmtText);
  mm.add({ desk: '(min-width: 901px)', mob: '(max-width: 900px)' }, (ctx) => {
    if (reduced) return;
    const desk = ctx.conditions.desk;
    gsap.timeline({ scrollTrigger: { trigger: '.stmt', start: () => 'top top+=' + hdrH(), end: () => '+=' + (desk ? 150 : 120) + '%', pin: true, scrub: .7, anticipatePin: 1, invalidateOnRefresh: true } })
      .fromTo(words, {
        x: (i) => (seeded(i)[0] * 2 - 1) * innerWidth * (desk ? .4 : .5),
        y: (i) => (seeded(i)[1] * 2 - 1) * innerHeight * (desk ? .36 : .3),
        rotation: (i) => (seeded(i)[2] * 2 - 1) * 14,
        opacity: (i) => .1 + seeded(i)[3] * .26,
        scale: (i) => .9 + seeded(i)[4] * .3
      }, { x: 0, y: 0, rotation: 0, opacity: 1, scale: 1, ease: 'power3.out', duration: 1, stagger: { amount: .6, from: 'random' } });
    return () => gsap.set(words, { clearProps: 'all' });
  });

  /* ---------- approach: pinned steps ---------- */
  const steps = $$('.step'), lis = $$('#procList li'), procBg = $('.proc-bg'), N = steps.length;
  mm.add({ desk: '(min-width: 901px)', mob: '(max-width: 900px)' }, (ctx) => {
    if (reduced) return;
    const desk = ctx.conditions.desk;
    const proc = $('.proc');
    const apply = (u, p) => {
      const H = proc.clientHeight, focus = H * (desk ? .26 : .36), spacing = H * (desk ? .58 : .5);
      steps.forEach((s, i) => {
        const d = i - u;
        gsap.set(s, { y: focus + d * spacing, opacity: d > 0 ? gsap.utils.clamp(0, 1, 1 - d * .62) : gsap.utils.clamp(0, 1, 1 + d * 1.8) });
        gsap.set($('.step-label', s), { opacity: gsap.utils.clamp(0, 1, 1 - Math.abs(d) * 2.4) });
      });
      lis.forEach((li, i) => li.classList.toggle('is-on', i === Math.round(u)));
      gsap.set(procBg, { yPercent: -3 + p * 6, scale: 1.1 - p * .08 });
    };
    apply(0, 0);
    const len = (N - 1) * .9 + .25;
    ScrollTrigger.create({
      trigger: '.proc', start: () => 'top top+=' + hdrH(), end: () => '+=' + (len * 100) + '%', pin: true, anticipatePin: 1, invalidateOnRefresh: true,
      onRefresh: (self) => apply(gsap.utils.clamp(0, N - 1, self.progress * len / .9), self.progress),
      onUpdate: (self) => apply(gsap.utils.clamp(0, N - 1, self.progress * len / .9), self.progress)
    });
    return () => { gsap.set([...steps, ...$$('.step-label'), procBg], { clearProps: 'all' }); };
  });

  /* ---------- services: heading + ribbon ---------- */
  const lineReveal = (h, start = 'top 88%') => ScrollTrigger.create({ trigger: h, start, once: true, onEnter: () => rise($$('.ln>span', h)) });
  /* panel headings are part of the panel as it slides up, so only the other headings get the line reveal */
  if (!reduced) $$('.svc-h, .rev-h').forEach((h) => lineReveal(h, 'top 88%'));

  /* the ribbon draws itself along its path while the section scrolls in (scrubbed, so it also un-draws on the way back);
     dash and gap are a little longer than the path so the round cap never leaves a dot at either end */
  const ribbon = $('#ribbonPath');
  if (ribbon && !reduced) {
    const PAD = 120, L = Math.ceil(ribbon.getTotalLength()) + PAD;
    gsap.set(ribbon, { strokeDasharray: L + ' ' + L, strokeDashoffset: L });
    gsap.to(ribbon, { strokeDashoffset: PAD, ease: 'none', scrollTrigger: { trigger: '.svc-intro', start: 'top 92%', end: 'top 10%', scrub: .6 } });
  }

  /* ---------- stacked panels: each one pins while the next slides over it, then recedes ---------- */
  const panels = $$('.svc .panel');
  mm.add('(min-width: 901px)', () => {
    if (reduced || panels.length < 2) return;
    const under = panels.slice(0, -1);
    const setTops = () => under.forEach((p) => { p.style.top = Math.min(0, innerHeight - p.offsetHeight) + 'px'; });
    root.classList.add('has-stack');
    setTops();
    ScrollTrigger.addEventListener('refreshInit', setTops);
    const made = under.map((p, i) => {
      const shade = el('div', 'panel-shade'); p.append(shade);
      const tl = gsap.timeline({ scrollTrigger: { trigger: panels[i + 1], start: 'top bottom', end: 'top top', scrub: .5, invalidateOnRefresh: true } });
      tl.fromTo(p, { scale: 1 }, { scale: .88, ease: 'none', transformOrigin: () => '50% ' + Math.max(0, p.offsetHeight - innerHeight) + 'px' }, 0)
        .fromTo(p, { y: 0 }, { y: () => -innerHeight * .065, ease: 'power2.out' }, 0)
        .fromTo(shade, { opacity: 0 }, { opacity: .48, ease: 'none' }, 0);
      return { shade, tl };
    });
    return () => {
      ScrollTrigger.removeEventListener('refreshInit', setTops);
      made.forEach(({ shade, tl }) => { if (tl.scrollTrigger) tl.scrollTrigger.kill(); tl.kill(); shade.remove(); });
      root.classList.remove('has-stack');
      under.forEach((p) => { p.style.top = ''; gsap.set(p, { clearProps: 'transform,transformOrigin' }); });
    };
  });

  if (!reduced) ScrollTrigger.batch('[data-fade]', {
    start: 'top 93%', once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: .09, overwrite: 'auto' })
  });

  if (!reduced) $$('.panel-fig img').forEach((img) => {
    gsap.fromTo(img, { scale: 1.2 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* ---------- case study ---------- */
  if (!reduced) $$('[data-count]').forEach((n) => {
    const target = parseFloat(n.dataset.count), o = { v: 0 };
    n.textContent = '0';
    ScrollTrigger.create({ trigger: n, start: 'top 92%', once: true, onEnter: () => gsap.to(o, { v: target, duration: 1.8, ease: 'power3.out', onUpdate: () => { n.textContent = Math.round(o.v); } }) });
  });
  const strip = $('#caseStrip'), track = strip && $('.case-track', strip);
  if (track && !reduced) {
    gsap.fromTo(track, { x: 0 }, { x: () => -Math.max(0, track.scrollWidth - strip.clientWidth), ease: 'none', scrollTrigger: { trigger: strip, start: 'top 90%', end: 'bottom 20%', scrub: true, invalidateOnRefresh: true } });
  }

  /* ---------- marquee ---------- */
  if (!reduced) gsap.fromTo('#marqA', { xPercent: 4 }, { xPercent: -26, ease: 'none', scrollTrigger: { trigger: '.marq', start: 'top bottom', end: 'bottom top', scrub: .8 } });
  if (!reduced) gsap.fromTo('#marqB', { xPercent: -34 }, { xPercent: 0, ease: 'none', scrollTrigger: { trigger: '.marq', start: 'top bottom', end: 'bottom top', scrub: .8 } });

  /* reviews: the mark never stops turning, and the scroll adds extra turns on top */
  const revLogo = $('#logo3d');
  if (revLogo) {
    const { tilt, turn, stage } = make3d(revLogo, 8);
    if (reduced) { gsap.set(stage, { rotationY: -28 }); gsap.set(tilt, { rotationX: 6 }); }
    else {
      gsap.set(tilt, { rotationX: -7 });
      gsap.fromTo(turn, { rotationY: -40 }, { rotationY: 320, ease: 'none', scrollTrigger: { trigger: '.rev', start: 'top 80%', end: 'bottom 20%', scrub: .5 } });
      const spin = gsap.to(stage, { rotationY: 360, duration: 9, ease: 'none', repeat: -1, paused: true });
      const bob = gsap.to(tilt, { rotationX: 7, y: -6, duration: 3.4, ease: 'sine.inOut', yoyo: true, repeat: -1, paused: true });
      ScrollTrigger.create({ trigger: revLogo, start: 'top bottom', end: 'bottom top', onToggle: (s) => { if (s.isActive) { spin.play(); bob.play(); } else { spin.pause(); bob.pause(); } } });
    }
  }

  /* footer: the mark spins around itself (only while it is on screen) */
  const ftrLogo = $('#ftrLogo');
  if (ftrLogo) {
    const { tilt, stage } = make3d(ftrLogo, 8);
    if (reduced) { gsap.set(stage, { rotationY: -24 }); gsap.set(tilt, { rotationX: 6 }); }
    else {
      gsap.set(tilt, { rotationX: -7 });
      const spin = gsap.to(stage, { rotationY: 360, duration: 10, ease: 'none', repeat: -1, paused: true });
      const bob = gsap.to(tilt, { rotationX: 7, y: -7, duration: 3.4, ease: 'sine.inOut', yoyo: true, repeat: -1, paused: true });
      ScrollTrigger.create({ trigger: ftrLogo, start: 'top bottom', end: 'bottom top', onToggle: (s) => { if (s.isActive) { spin.play(); bob.play(); } else { spin.pause(); bob.pause(); } } });
    }
  }

  /* ---------- contact + footer ---------- */
  if (!reduced) gsap.fromTo('.cta-strip', { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } });
  if (!reduced) gsap.from('.card', { y: 120, opacity: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: '.cta', start: 'top 60%', once: true } });
  if (!reduced) gsap.from('#ftrWord', { yPercent: 28, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '.ftr-bottom', start: 'top 98%', once: true } });

  /* ---------- menu ---------- */
  const menu = $('#menu'), menuBtn = $('#menuBtn'), label = $('[data-menu-label]', menuBtn);
  let menuOpen = false;
  const openMenu = () => {
    if (menuOpen) return; menuOpen = true;
    hdr.classList.add('is-menu'); hdr.classList.add('is-on');
    menuBtn.setAttribute('aria-expanded', 'true'); label.textContent = 'Close';
    menu.classList.add('is-open'); menu.setAttribute('aria-hidden', 'false');
    if (lenis) lenis.stop();
    gsap.fromTo(menu, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: .9, ease: 'expo.inOut', overwrite: true });
    rise($$('.menu-nav .ln>span'), { delay: .35, stagger: .07, duration: 1.1 });
    gsap.fromTo('.menu-foot a', { opacity: 0, y: 16 }, { opacity: 1, y: 0, delay: .75, duration: .8, stagger: .08, ease: 'power3.out' });
  };
  const closeMenu = (instant) => {
    if (!menuOpen) return; menuOpen = false;
    hdr.classList.remove('is-menu');
    menuBtn.setAttribute('aria-expanded', 'false'); label.textContent = 'Menu';
    menu.setAttribute('aria-hidden', 'true');
    if (lenis) lenis.start();
    const done = () => { menu.classList.remove('is-open'); gsap.set(menu, { clipPath: 'inset(0 0 100% 0)' }); gsap.set($$('.menu-nav .ln>span'), { yPercent: 115 }); };
    if (instant) done(); else gsap.to(menu, { clipPath: 'inset(100% 0 0 0)', duration: .8, ease: 'expo.inOut', overwrite: true, onComplete: done });
  };
  menuBtn.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) closeMenu(); });

  /* ---------- anchors ---------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const id = a.getAttribute('href');
    e.preventDefault();
    if (a.dataset.topic) { const r = $('input[name="type"][value="' + a.dataset.topic + '"]'); if (r) r.checked = true; }
    const wasOpen = menuOpen; if (wasOpen) closeMenu();
    const go = () => {
      if (id === '#top' || id === '#') scrollToTarget(0, { duration: 2 });
      else { const t = $(id); if (t) scrollToTarget(t, { offset: id === '#contact' ? -hdrH() : -hdrH() }); }
    };
    wasOpen ? setTimeout(go, 520) : go();
  });

  /* ---------- cursor ---------- */
  if (!touch) {
    const c = $('#cursor'); let first = true;
    const cx = gsap.quickTo(c, 'x', { duration: .45, ease: 'power3' }), cy = gsap.quickTo(c, 'y', { duration: .45, ease: 'power3' });
    addEventListener('pointermove', (e) => {
      if (first) { gsap.set(c, { x: e.clientX, y: e.clientY }); c.style.opacity = 1; first = false; }
      cx(e.clientX); cy(e.clientY);
    }, { passive: true });
    document.addEventListener('mouseleave', () => { c.style.opacity = 0; first = true; });
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('a,button,input,textarea,label,.row,.film');
      gsap.to(c, { scale: t ? (t.matches('input,textarea') ? 4.6 : 3.2) : 1, duration: .45, ease: 'power3.out', overwrite: 'auto' });
    });
  }

  addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
}

/* =====================================================
   CONTACT FORM: three steps, handler lives in firebase-analytics.js
   ===================================================== */
(function initForm() {
  const form = $('#contactForm'); if (!form) return;
  const panes = $$('.pane', form), pill = $('#stepNow'), status = $('#cfStatus');
  let step = 1;
  const motion = () => !!(window.gsap && !reduced);
  const go = (n) => {
    const cur = panes[step - 1], nxt = panes[n - 1]; if (cur === nxt) return;
    const swap = () => {
      cur.classList.remove('is-active'); cur.setAttribute('aria-hidden', 'true');
      nxt.classList.add('is-active'); nxt.removeAttribute('aria-hidden');
      step = n; pill.textContent = pad(n);
      if (motion()) gsap.fromTo(nxt, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .8, ease: 'power3.out' });
      const f = $('input:not([type=radio]), textarea', nxt); if (f && n === 2) f.focus({ preventScroll: true });
      refreshSoon();
    };
    if (motion()) gsap.to(cur, { opacity: 0, y: -14, duration: .28, ease: 'power2.in', onComplete: swap }); else swap();
  };
  const bad = (input, on) => { const f = input.closest('.fld'); if (f) f.classList.toggle('is-err', on); };
  const next = () => {
    const name = $('#cfName'), email = $('#cfEmail');
    const okName = name.value.trim().length > 0, okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim());
    bad(name, !okName); bad(email, !okEmail);
    status.className = 'cf-status' + (okName && okEmail ? '' : ' err');
    status.textContent = okName && okEmail ? '' : (!okName ? 'Please add your name.' : 'Please check your email address.');
    if (okName && okEmail) go(2);
  };
  $('[data-next]', form).addEventListener('click', next);
  $('[data-prev]', form).addEventListener('click', () => { status.textContent = ''; go(1); });
  $('[data-again]', form).addEventListener('click', () => { status.textContent = ''; go(1); });
  form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && step === 1 && e.target.tagName === 'INPUT') { e.preventDefault(); next(); } });
  $$('#cfName, #cfEmail').forEach((i) => i.addEventListener('input', () => bad(i, false)));
  form.addEventListener('submit', (e) => {
    if (step !== 2) { e.preventDefault(); return; }
    if (form.dataset.connected !== 'true') {
      e.preventDefault();
      status.className = 'cf-status err';
      status.textContent = 'The contact service is unavailable. Please email ahmed.yahia.negm@gmail.com.';
    }
  });
  form.addEventListener('aipex:sent', () => { status.textContent = ''; go(3); });
})();

/* ---- boot ---- */
if (hasGsap) {
  try { initMotion(); } catch (err) { console.error(err); failSafe(); }
} else {
  failSafe();
}
})();
