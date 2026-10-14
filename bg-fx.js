/* AIPEX · bg-fx.js  (light version)
   Living backgrounds. A section marked data-fx="<effect> [options]" gets a layer that sits under its content:
     marks      light grounds: drifting soft light, a lattice of fine registration marks, a lens that turns the marks into blue crosses
     lines      navy grounds: a silk of fine lines (drawn once) that lights up under the pointer
     streaks    navy grounds: slow cinematic light streaks and bokeh with depth parallax
     blueprint  light grounds: the 12-column layout grid, lit like a flashlight under the pointer
     depth      the approach section: the dust layer drifts with the pointer
   Nothing here redraws a big canvas per frame (that was far too slow on Firefox): motion is CSS animation that the browser
   composites by itself, textures are drawn once, and the pointer only moves a small masked window over a pre-drawn layer.
   A frame-time guard switches everything off for this browser if the page still runs slowly. */
(() => {
  'use strict';
  const root = document.documentElement;
  const hosts = Array.from(document.querySelectorAll('[data-fx]'));
  if (!hosts.length || !('IntersectionObserver' in window) || !('ResizeObserver' in window)) return;
  const q = location.search, KEY = 'aipex-fx-off';
  try {
    if (/[?&]fx=on/.test(q)) localStorage.removeItem(KEY);
    const off = +localStorage.getItem(KEY);
    if (/[?&]fx=off/.test(q) || (off && Date.now() - off < 7 * 864e5)) return;
  } catch (e) { /* storage blocked: carry on */ }

  const reduced = root.classList.contains('is-reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = root.classList.contains('is-touch') || matchMedia('(hover: none), (pointer: coarse)').matches;
  const lite = touch || innerWidth < 900;                       // fewer layers, no pointer window
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  const rnd = (() => { let s = 20261013; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
  const STEEL = [98, 142, 246], ICE = [196, 214, 255], ACC = [8, 123, 255], INK = [29, 37, 52];
  const PAD = 40;                                               // canvases are a little larger than the stage so a slow sway never shows an edge

  /* a masked window that follows the pointer and shows `inner` (a layer the size of the stage, kept aligned by counter-translating it) */
  function makeWin(inner, size) {
    const box = el('div', 'fx-win'), holder = el('div', 'fx-in');
    box.style.width = box.style.height = size + 'px';
    holder.append(inner); box.append(holder);
    return { box, holder, size };
  }
  function placeWin(win, lx, ly) {
    const wx = Math.round(lx - win.size / 2), wy = Math.round(ly - win.size / 2);
    win.box.style.transform = 'translate3d(' + wx + 'px,' + wy + 'px,0)';
    win.holder.style.transform = 'translate3d(' + (-wx) + 'px,' + (-wy) + 'px,0)';
  }
  function setDpr() { return Math.min(window.devicePixelRatio || 1, 1.5); }

  /* =====================================================
     EFFECTS: build(f) once, layout(f) after every resize, point(f, lx, ly, inside) while the pointer moves
     ===================================================== */

  const marks = {
    build(f) {
      const s = f.stage;
      s.classList.add('fx-light'); if (f.opts.has('calm')) s.classList.add('fx-calm');
      s.append(el('i', 'fx-mist'), el('i', 'fx-lat'));
      if (!lite) {
        f.win = makeWin(el('i', 'fx-lat fx-lat--hi'), 560);
        f.glow = el('i', 'fx-glow');
        s.append(f.win.box, f.glow);
      }
    },
    layout(f) { if (f.win) { const i = f.win.holder.firstChild; i.style.width = f.w + 'px'; i.style.height = f.h + 'px'; } },
    point(f, lx, ly, inside) {
      if (!f.win) return;
      f.win.box.classList.toggle('on', inside); f.glow.classList.toggle('on', inside);
      if (!inside) return;
      placeWin(f.win, lx, ly);
      f.glow.style.transform = 'translate3d(' + Math.round(lx) + 'px,' + Math.round(ly) + 'px,0)';
    }
  };

  /* the silk of lines is a pre-rendered image (a dim copy, and a brighter copy that the pointer window reveals): nothing is drawn at runtime */
  const lines = {
    build(f) {
      const s = f.stage;
      s.classList.add('fx-dark'); if (f.opts.has('low')) s.classList.add('fx-calm');
      s.append(el('i', 'fx-silk'));
      if (!lite) {
        f.win = makeWin(el('i', 'fx-silk fx-silk--hi'), 560); f.glow = el('i', 'fx-glow fx-glow--acc');
        s.append(f.win.box, f.glow);
      }
    },
    layout(f) { if (f.win) { const i = f.win.holder; i.style.width = f.w + 'px'; i.style.height = f.h + 'px'; } },
    point(f, lx, ly, inside) {
      if (!f.win) return;
      f.win.box.classList.toggle('on', inside); f.glow.classList.toggle('on', inside);
      if (!inside) return;
      placeWin(f.win, lx, ly);
      f.glow.style.transform = 'translate3d(' + Math.round(lx) + 'px,' + Math.round(ly) + 'px,0)';
    }
  };

  const streaks = {
    build(f) {
      const s = f.stage; s.classList.add('fx-dark');
      const n = lite ? 7 : 13, nb = lite ? 3 : 7;
      f.parA = el('div', 'fx-par'); f.parB = el('div', 'fx-par');
      for (let i = 0; i < nb; i++) {
        const b = el('i', 'fx-bokeh'), r = 60 + rnd() * 190, c = rnd() < .5 ? ACC : ICE;
        b.style.cssText = 'width:' + r + 'px;height:' + r + 'px;left:' + (rnd() * 100).toFixed(1) + '%;top:' + (10 + rnd() * 80).toFixed(1) + '%;background:radial-gradient(closest-side,' + rgba(c, (.07 + rnd() * .08).toFixed(3)) + ',' + rgba(c, 0) + ');animation-duration:' + (50 + rnd() * 60).toFixed(0) + 's;animation-delay:-' + (rnd() * 60).toFixed(0) + 's';
        f.parA.append(b);
      }
      for (let i = 0; i < n; i++) {
        const hero = i < 3, t = el('i', 'fx-streak'), c = hero ? (i === 1 ? ACC : ICE) : (rnd() < .22 ? ACC : (rnd() < .5 ? STEEL : ICE));
        const len = hero ? 40 + rnd() * 30 : 14 + rnd() * 26, th = hero ? 2.2 + rnd() * 1.2 : 1.1 + rnd() * 1.6, a = hero ? .34 + rnd() * .16 : .1 + rnd() * .22;
        t.style.cssText = 'width:' + len.toFixed(0) + 'vw;height:' + th.toFixed(1) + 'px;top:' + (hero ? 22 + i * 27 + rnd() * 6 : 6 + (i - 3) / (n - 3) * 88 + rnd() * 5).toFixed(1) + '%;background:linear-gradient(90deg,' + rgba(c, 0) + ',' + rgba(c, a.toFixed(3)) + ' 50%,' + rgba(c, 0) + ');animation-duration:' + (hero ? 90 + rnd() * 60 : 36 + rnd() * 50).toFixed(0) + 's;animation-delay:-' + (rnd() * 90).toFixed(0) + 's;animation-direction:' + (rnd() < .5 ? 'normal' : 'reverse');
        f.parB.append(t);
      }
      s.append(f.parA, f.parB);
    },
    layout() {},
    point(f, lx, ly, inside) {
      const nx = inside ? clamp(lx / f.w - .5, -.6, .6) : 0, ny = inside ? clamp(ly / f.h - .5, -.6, .6) : 0;
      f.parA.style.transform = 'translate3d(' + (-nx * 70).toFixed(1) + 'px,' + (-ny * 50).toFixed(1) + 'px,0)';
      f.parB.style.transform = 'translate3d(' + (-nx * 36).toFixed(1) + 'px,' + (-ny * 26).toFixed(1) + 'px,0)';
    }
  };

  const blueprint = {
    build(f) {
      const s = f.stage; s.classList.add('fx-light');
      f.cvA = el('canvas', 'fx-cv fx-cv--still'); s.append(f.cvA);
      if (!lite) {
        f.cvB = el('canvas', 'fx-cv fx-cv--still');
        f.win = makeWin(f.cvB, 620); f.glow = el('i', 'fx-glow');
        s.append(f.win.box, f.glow);
      }
    },
    layout(f) {
      const cs = getComputedStyle(root), pad = parseFloat(cs.getPropertyValue('--pad')) || 24, gap = parseFloat(cs.getPropertyValue('--gap')) || 24;
      const colW = (f.w - 2 * pad - 11 * gap) / 12, xs = [];
      for (let c = 0; c < 12; c++) { const x = pad + c * (colW + gap); xs.push(Math.round(x) + .5, Math.round(x + colW) + .5); }
      const R = 96, dpr = setDpr();
      const paint = (cv, ink, crossInk, lw) => {
        cv.width = Math.round(f.w * dpr); cv.height = Math.round(f.h * dpr); cv.style.width = f.w + 'px'; cv.style.height = f.h + 'px';
        const ctx = cv.getContext('2d'); if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineWidth = lw;
        ctx.strokeStyle = ink; ctx.beginPath();
        for (let i = 0; i < xs.length; i++) { ctx.moveTo(xs[i], 0); ctx.lineTo(xs[i], f.h); }
        for (let y = R / 2; y < f.h; y += R) { const yy = Math.round(y) + .5; ctx.moveTo(0, yy); ctx.lineTo(f.w, yy); }
        ctx.stroke();
        ctx.strokeStyle = crossInk; ctx.beginPath();
        for (let y = R / 2; y < f.h; y += R) { const yy = Math.round(y) + .5; for (let i = 0; i < xs.length; i += 2) { const x = xs[i]; ctx.moveTo(x - 5, yy); ctx.lineTo(x + 5, yy); ctx.moveTo(x, yy - 5); ctx.lineTo(x, yy + 5); } }
        ctx.stroke();
      };
      paint(f.cvA, rgba(INK, .06), rgba(INK, .2), 1);
      if (f.win) { paint(f.cvB, rgba(ACC, .55), rgba(ACC, .9), 1); const i = f.win.holder; i.style.width = f.w + 'px'; i.style.height = f.h + 'px'; }
    },
    point(f, lx, ly, inside) {
      if (!f.win) return;
      f.win.box.classList.toggle('on', inside); f.glow.classList.toggle('on', inside);
      if (!inside) return;
      placeWin(f.win, lx, ly);
      f.glow.style.transform = 'translate3d(' + Math.round(lx) + 'px,' + Math.round(ly) + 'px,0)';
    }
  };

  const depth = {
    canvas: false,
    build(f) { f.layers = Array.from(f.host.querySelectorAll('[data-depth]')).map((e) => ({ e, d: parseFloat(e.dataset.depth) || 0 })); },
    layout() {},
    point(f, lx, ly, inside) {
      const nx = inside ? clamp((lx - innerWidth / 2) / innerWidth, -.6, .6) : 0, ny = inside ? clamp((ly - innerHeight / 2) / innerHeight, -.6, .6) : 0;
      for (let i = 0; i < f.layers.length; i++) { const L = f.layers[i]; L.e.style.transform = 'translate3d(' + (-nx * L.d * 46).toFixed(1) + 'px,' + (-ny * L.d * 30).toFixed(1) + 'px,0)'; }
    }
  };

  const EFFECTS = { marks, lines, streaks, blueprint, depth };

  /* =====================================================
     ENGINE
     ===================================================== */
  const items = [], byHost = new Map();
  let killed = false;
  const DEBUG = /[?&]fxdebug/.test(q);

  function make(host) {
    const parts = host.dataset.fx.trim().split(/\s+/), eff = EFFECTS[parts[0]];
    if (!eff) return;
    const f = { host, eff, kind: parts[0], opts: new Set(parts.slice(1)), gate: host.dataset.fxGate || '', inView: false, built: false, w: 0, h: 0 };
    items.push(f); byHost.set(host, f);
  }

  const isOn = (f) => f.inView && (!f.gate || f.host.classList.contains(f.gate));

  /* Sizes come from a ResizeObserver, never from reading element sizes right after inserting nodes (that forces a full page layout). */
  const byStage = new Map();
  function activate(f) {
    if (killed || f.dead) return;
    try {
      if (!f.built) {
        f.w = innerWidth; f.h = innerHeight;                    // provisional until the observer reports the real size
        if (f.eff.canvas !== false) {
          f.wrap = el('div', 'fx-wrap'); f.wrap.setAttribute('aria-hidden', 'true');
          f.stage = el('div', 'fx-stage'); f.wrap.append(f.stage); f.host.prepend(f.wrap);
          byStage.set(f.stage, f);
        }
        f.eff.build(f); f.built = true; f.dirty = true;
        if (f.stage) ro.observe(f.stage); else { f.eff.layout(f); f.dirty = false; }
      } else if (f.dirty && f.sized) { f.eff.layout(f); f.dirty = false; }
      if (f.wrap) f.wrap.classList.remove('off');
      if (f.freeTimer) { clearTimeout(f.freeTimer); f.freeTimer = 0; }
    } catch (e) { f.dead = true; if (f.wrap) f.wrap.hidden = true; }
  }
  function deactivate(f) {
    if (f.wrap) f.wrap.classList.add('off');                    // pauses the CSS animations
    if (f.cvA || f.cvB) {                                      // give the canvas memory back a few seconds after leaving
      clearTimeout(f.freeTimer);
      f.freeTimer = setTimeout(() => { for (const c of [f.cvA, f.cvB]) if (c) { c.width = 1; c.height = 1; } f.dirty = true; }, 4000);
    }
  }
  function sync(f) { const on = isOn(f) && !f.dead; if (on !== f.on) { f.on = on; if (on) activate(f); else deactivate(f); } }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { const f = byHost.get(e.target); if (f) { f.inView = e.isIntersecting; sync(f); } });
    if (ptr.on) schedule();
  }, { rootMargin: '120px 0px' });
  const ro = new ResizeObserver((entries) => entries.forEach((e) => {
    const f = byStage.get(e.target), cr = e.contentRect; if (!f || cr.width < 2 || cr.height < 2) return;
    f.w = Math.round(cr.width); f.h = Math.round(cr.height); f.sized = true;
    if (f.on) { try { f.eff.layout(f); f.dirty = false; } catch (err) { f.dead = true; } } else f.dirty = true;
  }));
  const mo = new MutationObserver(() => items.forEach((f) => { if (f.gate) sync(f); }));

  /* ---- pointer: smoothed, and only while it is moving ---- */
  const ptr = { x: -9999, y: -9999, sx: -9999, sy: -9999, on: false };
  let raf = 0, last = 0;
  function frame(now) {
    raf = 0;
    const dt = clamp((now - last) / 1000, .001, .05); last = now;
    const k = 1 - Math.exp(-dt * 11), dx = ptr.x - ptr.sx, dy = ptr.y - ptr.sy;
    ptr.sx += dx * k; ptr.sy += dy * k;
    for (let i = 0; i < items.length; i++) {
      const f = items[i]; if (!f.on || !f.built || f.dead) continue;
      const el0 = f.stage || f.host, r = el0.getBoundingClientRect(), sc = r.width ? (f.w || r.width) / r.width : 1;
      const lx = (ptr.sx - r.left) * sc, ly = (ptr.sy - r.top) * sc;
      const inside = ptr.on && lx > -280 && lx < f.w + 280 && ly > -280 && ly < f.h + 280;
      f.eff.point(f, lx, ly, inside);
    }
    if (ptr.on && (Math.abs(dx) > .4 || Math.abs(dy) > .4)) raf = requestAnimationFrame(frame);
  }
  function schedule() { if (!raf && !reduced && !lite) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  function ripple(x, y, o) {
    for (let i = 0; i < items.length; i++) {
      const f = items[i]; if (!f.on || !f.stage || f.dead) continue;
      const r = f.stage.getBoundingClientRect(); if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      const ring = el('i', 'fx-ring' + (f.stage.classList.contains('fx-dark') ? ' fx-ring--dark' : ''));
      if (o && o.size) ring.style.setProperty('--fx-ring-size', o.size + 'px');
      if (o && o.dur) ring.style.animationDuration = o.dur + 's';
      ring.style.left = Math.round((x - r.left) * f.w / r.width) + 'px'; ring.style.top = Math.round((y - r.top) * f.w / r.width) + 'px';
      ring.addEventListener('animationend', () => ring.remove(), { once: true });
      f.stage.append(ring);
    }
  }

  /* ---- guard: if the page keeps running below ~30 fps while the effects are on, switch them off for this browser ---- */
  let pRaf = 0, pLast = 0, pN = 0, pSum = 0, pBad = 0, pUntil = 0, pStart = 0;
  function probeTick(now) {
    pRaf = 0;
    if (killed || document.hidden) { pLast = 0; return; }
    if (pLast) { const d = now - pLast; if (d < 2000) { pN++; pSum += d; } }   // longer gaps mean the tab was in the background
    pLast = now; if (!pStart) pStart = now;
    if (now - pStart >= 1500) {                                              // judge every 1.5 s: two slow windows in a row (about 3 s) switch the effects off
      pBad = pN && pSum / pN > 40 ? pBad + 1 : 0; pStart = now; pN = 0; pSum = 0;
      if (pBad >= 2) { kill(); return; }
    }
    if (now < pUntil) pRaf = requestAnimationFrame(probeTick); else { pLast = 0; pN = 0; pSum = 0; pBad = 0; pStart = 0; }
  }
  function probe(ms) { pUntil = Math.max(pUntil, performance.now() + ms); if (!pRaf && !killed) pRaf = requestAnimationFrame(probeTick); }
  function kill() {
    killed = true;
    try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* ignore */ }
    items.forEach((f) => { if (f.wrap) f.wrap.remove(); });
    items.length = 0; io.disconnect(); if (ro) ro.disconnect(); mo.disconnect();
    root.classList.add('fx-killed');
  }

  const only = (/[?&]fxonly=([a-z,]+)/.exec(q) || [])[1];
  hosts.forEach((h) => { if (!only || only.split(',').indexOf(h.dataset.fx.trim().split(/\s+/)[0]) >= 0) make(h); });
  if (!items.length) return;
  items.forEach((f) => { io.observe(f.host); if (f.gate) mo.observe(f.host, { attributes: true, attributeFilter: ['class'] }); });
  if (DEBUG) window.__fx = { items, kill, get killed() { return killed; } };

  /* the opening sequence borrows the pointer: it drives the lens along the logo's path and fires a ripple when the logo lands */
  let driven = false;
  window.AipexFx = {
    drive(x, y) { if (killed || reduced) return; driven = true; ptr.x = x; ptr.y = y; if (!ptr.on) { ptr.on = true; ptr.sx = x; ptr.sy = y; } schedule(); },
    release() { driven = false; ptr.on = false; schedule(); },
    ripple(x, y, o) { if (!killed && !reduced) ripple(x, y, o); }
  };

  if (!reduced) {
    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || killed || driven) return;
      ptr.x = e.clientX; ptr.y = e.clientY;
      if (!ptr.on) { ptr.on = true; ptr.sx = ptr.x; ptr.sy = ptr.y; }
      schedule(); probe(2500);
    }, { passive: true });
    root.addEventListener('mouseleave', () => { ptr.on = false; schedule(); });
    addEventListener('blur', () => { ptr.on = false; schedule(); });
    addEventListener('pointerdown', (e) => { if (!killed && e.pointerType !== 'touch') ripple(e.clientX, e.clientY); }, { passive: true });
    addEventListener('scroll', () => probe(3000), { passive: true });
    addEventListener('load', () => setTimeout(() => probe(8000), 3500));
  }
})();
