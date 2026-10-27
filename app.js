(() => {
  'use strict';
  const VER = 6;
  const $ = (id) => document.getElementById(id);
  const GROUND = -1.4;   // 目の高さ 1.4 m と見なした、地面の高さ

  // ---------- 呪文(ことば) ----------
  const SPELLS = {
    thunder: { icon: '⚡', label: 'サンダー', desc: '空から、いなずまが落ちる。ピカッと光って、ゴロゴロ鳴る。', words: ['サンダー', 'サンダ', 'サンダァ', '雷', 'カミナリ', 'ライトニング', 'イナズマ', '稲妻', 'thunder', 'lightning'] },
    fire: { icon: '🔥', label: 'ファイヤー', desc: '足もとから、炎がいっぱいに広がる。', words: ['ファイヤー', 'ファイアー', 'ファイア', 'ファイヤ', 'ファイ', 'ファイヤーー', '火', '炎', 'ホノオ', 'fire'] },
    water: { icon: '💧', label: 'ウォーター', desc: 'あちこちから、水がふき出す。', words: ['ウォーター', 'ウォータ', 'ウオーター', 'ウォター', 'ワーター', 'ウォーラー', '水', 'ミズ', 'アクア', 'water'] },
    onigiri: { icon: '🍙', label: 'にぎにぎ', desc: 'おにぎりが、たくさん飛んでいく。', words: ['ニギニギ', '握握', '握り握り', 'ニギ二ギ', 'nigi nigi', 'niginigi'] },
    ice: { icon: '❄️', label: 'アイス', desc: '雪の結晶が、まわりにふりそそぐ。', words: ['アイス', '氷', 'コオリ', '雪', 'ユキ', 'ブリザード', 'ice', 'snow'] },
    hanabi: { icon: '🎆', label: '花火', desc: '夜空に、大きな花火が3発。', words: ['花火', 'ハナビ', 'ファイヤーワークス', 'ファイアーワークス', 'fireworks'] },
    heart: { icon: '💖', label: 'ハート', desc: 'ハートが、ふわふわ空にのぼる。', words: ['ハート', 'ラブ', '愛', 'heart', 'love'] },
    star: { icon: '⭐', label: 'スター', desc: '流れ星が、ツーッと流れる。', words: ['スター', '流れ星', 'ナガレボシ', '星', 'ホシ', 'star'] },
    kamehameha: { icon: '☄️', label: 'カメハメハ', cd: 7000, desc: '気をためて、すごいビームを発射する。', words: ['カメハメハ', 'カメハメ波', 'カメハメ', 'かめはめ波', 'kamehameha', '亀波'] },
  };
  const WORD_LIST = [];
  Object.keys(SPELLS).forEach((k) => SPELLS[k].words.forEach((w) => WORD_LIST.push([toKata(w).toLowerCase(), k])));
  WORD_LIST.sort((a, b) => b[0].length - a[0].length);   // 長いことばを先に(「花火」の中の「火」を、火と数えない)

  function toKata(s) { return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60)); }
  // 聞こえた文字から、呪文ごとの回数を数える
  function countSpells(text) {
    let t = toKata(text).toLowerCase().replace(/\s+/g, '');
    const out = {};
    for (const [w, k] of WORD_LIST) {
      let i;
      while ((i = t.indexOf(w)) >= 0) { out[k] = (out[k] || 0) + 1; t = t.slice(0, i) + '\u0001'.repeat(w.length) + t.slice(i + w.length); }
    }
    return out;
  }

  // ---------- 画面(three.js は A-Frame に入っているものを使う) ----------
  const T = window.THREE;
  let renderer, scene, camera;
  const lastFwd = new T.Vector3(0, 0, -1);
  function initGL() {
    renderer = new T.WebGLRenderer({ canvas: $('gl'), alpha: true, antialias: false });
    renderer.setClearColor(0x000000, 0);
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(65, 1, 0.05, 200);
    const fit = () => {
      const w = window.innerWidth, h = window.innerHeight, a = w / h;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = a;
      camera.fov = a <= 0.75 ? 65 : 2 * Math.atan(Math.tan(34.5 * Math.PI / 180) / Math.max(a, 1.333)) * 180 / Math.PI;
      camera.updateProjectionMatrix();
    };
    fit(); window.addEventListener('resize', fit);
  }

  // 端末の向きでカメラを回す(位置は使わない)
  const ori = { e: null, n: 0, yaw: 0, pitch: 0 };
  const euler = new T.Euler(), q0 = new T.Quaternion(), q1 = new T.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)), zee = new T.Vector3(0, 0, 1);
  function initLook() {
    window.addEventListener('deviceorientation', (e) => { if (e.alpha == null && e.beta == null) return; ori.e = e; ori.n++; });
    let drag = null;   // 向きが取れないとき(パソコン)は、ドラッグで見回す
    const st = $('stage');
    st.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; });
    st.addEventListener('pointermove', (e) => {
      if (!drag || ori.n > 5) return;
      ori.yaw -= (e.clientX - drag.x) * 0.005; ori.pitch = Math.max(-1.5, Math.min(1.5, ori.pitch - (e.clientY - drag.y) * 0.005));
      drag = { x: e.clientX, y: e.clientY };
    });
    st.addEventListener('pointerup', () => { drag = null; });
  }
  function look() {
    const d = ori.e, rad = T.MathUtils.degToRad;
    if (d) {
      const sa = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (window.orientation || 0);
      euler.set(d.beta ? rad(d.beta) : 0, rad(d.alpha || 0), d.gamma ? -rad(d.gamma) : 0, 'YXZ');
      camera.quaternion.setFromEuler(euler); camera.quaternion.multiply(q1); camera.quaternion.multiply(q0.setFromAxisAngle(zee, -rad(sa)));
    } else { euler.set(ori.pitch, ori.yaw, 0, 'YXZ'); camera.quaternion.setFromEuler(euler); }
  }
  const _d = new T.Vector3();
  function fwd() {   // 向いている方向(水平だけ)
    camera.getWorldDirection(_d);
    const l = Math.hypot(_d.x, _d.z);
    if (l > 0.3) lastFwd.set(_d.x / l, 0, _d.z / l);
    return lastFwd.clone();
  }
  const rgt = (f) => new T.Vector3(-f.z, 0, f.x);
  const at = (f, fd, lat, y) => f.clone().multiplyScalar(fd).addScaledVector(rgt(f), lat).setY(y);
  const R = (a, b) => a + Math.random() * (b - a);

  // ---------- 絵(コードで描く) ----------
  const tex = {};
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };
  const V = (x, y, z) => new T.Vector3(x, y, z);
  function radial(size, stops) {
    const c = cv(size), g = c.getContext('2d'), h = size / 2, gr = g.createRadialGradient(h, h, 0, h, h, h);
    stops.forEach(([o, a]) => gr.addColorStop(o, 'rgba(255,255,255,' + a + ')'));
    g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
  }
  function flameCanvas() {   // しずく形の炎
    const c = cv(128, 192), g = c.getContext('2d');
    const blob = (cx, cy, rx, ry, a) => { g.save(); g.translate(cx, cy); g.scale(rx / ry, 1); const gr = g.createRadialGradient(0, 0, 0, 0, 0, ry); gr.addColorStop(0, 'rgba(255,255,255,' + a + ')'); gr.addColorStop(0.5, 'rgba(255,255,255,' + a * 0.55 + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, ry, 0, 7); g.fill(); g.restore(); };
    blob(64, 128, 58, 58, 1); blob(64, 92, 36, 60, 0.9); blob(64, 56, 20, 52, 0.8); blob(64, 30, 9, 30, 0.7);
    return c;
  }
  function smokeCanvas() {
    const c = cv(128), g = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const x = 64 + (Math.random() - 0.5) * 44, y = 64 + (Math.random() - 0.5) * 44, r = 26 + Math.random() * 22, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
    return c;
  }
  function flakeCanvas() {   // 雪の結晶
    const c = cv(128), g = c.getContext('2d');
    g.translate(64, 64); g.strokeStyle = '#fff'; g.lineCap = 'round'; g.shadowColor = '#cfeaff'; g.shadowBlur = 8;
    for (let i = 0; i < 6; i++) {
      g.save(); g.rotate(i * Math.PI / 3);
      g.lineWidth = 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -54); g.stroke();
      g.lineWidth = 4; [[-22, 16], [-38, 11]].forEach(([y, l]) => { g.beginPath(); g.moveTo(0, y); g.lineTo(-l, y - l * 0.9); g.moveTo(0, y); g.lineTo(l, y - l * 0.9); g.stroke(); });
      g.restore();
    }
    return c;
  }
  function sparkCanvas() {   // きらっと光る十字
    const c = cv(128), g = c.getContext('2d');
    g.drawImage(radial(128, [[0, 1], [0.25, 0.5], [1, 0]]), 0, 0);
    const bar = (w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); };
    g.save(); g.translate(0, 62); bar(128, 4); g.restore();
    g.save(); g.translate(62, 128); g.rotate(-Math.PI / 2); bar(128, 4); g.restore();
    return c;
  }
  function heartCanvas() {
    const c = cv(128), g = c.getContext('2d');
    g.translate(64, 62); g.scale(3.1, 3.1); g.beginPath();
    for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 2, x = 16 * Math.pow(Math.sin(a), 3), y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)); i ? g.lineTo(x * 0.9, y * 0.9) : g.moveTo(x * 0.9, y * 0.9); }
    const gr = g.createRadialGradient(-5, -6, 1, 0, 0, 18); gr.addColorStop(0, '#ffd1e6'); gr.addColorStop(0.5, '#ff5fa2'); gr.addColorStop(1, '#d81b60');
    g.shadowColor = '#ff7ab8'; g.shadowBlur = 7; g.fillStyle = gr; g.fill();
    return c;
  }
  function starCanvas() {
    const c = cv(128), g = c.getContext('2d');
    g.drawImage(radial(128, [[0, 0.5], [1, 0]]), 0, 0);
    g.translate(64, 66); g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 22 : 50; i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); const gr = g.createRadialGradient(0, 0, 4, 0, 0, 50); gr.addColorStop(0, '#fffbe0'); gr.addColorStop(1, '#ffc928');
    g.shadowColor = '#ffe27a'; g.shadowBlur = 10; g.fillStyle = gr; g.fill();
    return c;
  }
  function boltCanvas() {   // いなずまの帯の、横の濃さ
    const c = cv(64, 4), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 64, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.3, 'rgba(255,255,255,.35)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(0.7, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 4); return c;
  }
  function emojiTex(ch) {
    const c = cv(128), g = c.getContext('2d');
    g.font = '96px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 64, 70); return new T.CanvasTexture(c);
  }
  function initTex() {
    tex.glow = new T.CanvasTexture(radial(64, [[0, 1], [0.3, 0.55], [1, 0]]));
    tex.flame = new T.CanvasTexture(flameCanvas()); tex.smoke = new T.CanvasTexture(smokeCanvas()); tex.flake = new T.CanvasTexture(flakeCanvas());
    tex.spark = new T.CanvasTexture(sparkCanvas()); tex.heart = new T.CanvasTexture(heartCanvas()); tex.star = new T.CanvasTexture(starCanvas());
    tex.bolt = new T.CanvasTexture(boltCanvas()); tex.ring = new T.CanvasTexture(radial(128, [[0, 0], [0.62, 0], [0.82, 1], [0.94, 0.35], [1, 0]]));
    tex['🍙'] = emojiTex('🍙');
    scene.add(new T.AmbientLight(0xffffff, 0.85)); const dl = new T.DirectionalLight(0xffffff, 0.9); dl.position.set(0.4, 1, 0.6); scene.add(dl);
  }

  // ---------- 粒 ----------
  const parts = [], emitters = [], fxs = [];
  // o: tex, pos, vel, life, size, aspect, grow, g, drag, spin, trail, color(hex または (t,color)=>void), add, op, pw, fadeIn, floor, onFloor
  function spawn(o) {
    if (parts.length > 4000) return;
    const m = new T.SpriteMaterial({ map: tex[o.tex || 'glow'], transparent: true, depthWrite: false, depthTest: false, blending: o.add ? T.AdditiveBlending : T.NormalBlending, opacity: o.op == null ? 1 : o.op });
    if (typeof o.color === 'number') m.color.setHex(o.color); else if (typeof o.color === 'function') o.color(0, m.color);
    if (o.rot) m.rotation = o.rot;
    const s = new T.Sprite(m); s.position.copy(o.pos); s.scale.set(o.size * (o.aspect || 1), o.size, 1); s.renderOrder = o.add ? 2 : 1;
    scene.add(s);
    parts.push({ s, m, v: o.vel || new T.Vector3(), age: 0, tr: 0, o: Object.assign({ life: 1, grow: 1, g: 0, op: 1, pw: 1, aspect: 1, drag: 0, spin: 0 }, o) });
  }
  function updateParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i], o = p.o; p.age += dt;
      const t = p.age / o.life;
      p.v.y += o.g * dt; if (o.drag) p.v.multiplyScalar(Math.max(0, 1 - o.drag * dt));
      p.s.position.addScaledVector(p.v, dt);
      let dead = t >= 1;
      if (o.floor && p.s.position.y < GROUND) { dead = true; if (o.onFloor) o.onFloor(p.s.position); }
      if (dead) { scene.remove(p.s); p.m.dispose(); parts.splice(i, 1); continue; }
      const sz = o.size * (1 + (o.grow - 1) * t); p.s.scale.set(sz * o.aspect, sz, 1);
      p.m.opacity = o.op * Math.pow(1 - t, o.pw) * Math.min(1, t / (o.fadeIn || 0.001));
      if (o.spin) p.m.rotation = (o.rot || 0) + o.spin * p.age;
      if (typeof o.color === 'function') o.color(t, p.m.color);
      if (o.trail) { p.tr -= dt; if (p.tr <= 0) { p.tr = o.trail; spawn({ pos: p.s.position.clone(), size: sz * 0.7, life: 0.5, add: true, color: p.m.color.getHex(), op: p.m.opacity * 0.6 }); } }
    }
  }
  function updateEmitters(dt) {
    const now = performance.now();
    for (let i = emitters.length - 1; i >= 0; i--) {
      const e = emitters[i];
      if (now < e.start) continue;
      if (now > e.end) { emitters.splice(i, 1); continue; }
      e.fn(dt, (now - e.start) / (e.end - e.start));
    }
  }
  const emit = (delay, dur, fn) => emitters.push({ start: performance.now() + delay, end: performance.now() + delay + dur, fn });

  // 立体のもの(いなずま・ビーム・氷の柱)。life 秒たつと消える
  function addFx(objs, life, upd) { objs.forEach((m) => { m.frustumCulled = false; scene.add(m); }); fxs.push({ objs, life, t: 0, upd }); }
  function updateFx(dt) {
    for (let i = fxs.length - 1; i >= 0; i--) {
      const x = fxs[i]; x.t += dt; const u = x.t / x.life;
      if (u >= 1) { x.objs.forEach((m) => { scene.remove(m); if (m.isMesh) { m.geometry.dispose(); m.material.dispose(); } else if (m.material) m.material.dispose(); }); fxs.splice(i, 1); continue; }
      x.upd(u, x.t, dt);
    }
  }
  const addMat = (color, op, map) => new T.MeshBasicMaterial({ color, map: map || null, transparent: true, opacity: op, blending: T.AdditiveBlending, depthTest: false, depthWrite: false, side: T.DoubleSide });
  function groundRing(pos, maxR, color, life, op) {
    const geo = new T.RingGeometry(0.82, 1, 48); geo.rotateX(-Math.PI / 2);
    const mat = addMat(color, op), m = new T.Mesh(geo, mat); m.position.set(pos.x, GROUND + 0.03, pos.z); m.scale.setScalar(0.01); m.renderOrder = 2;
    addFx([m], life, (u) => { m.scale.setScalar(Math.max(0.01, maxR * (1 - Math.pow(1 - u, 3)))); mat.opacity = op * (1 - u); });
  }
  // 点の列を、カメラ(原点)の方を向いた帯にする。w は帯の半分の太さ
  function ribbon(pts, w) {
    const n = pts.length, pos = new Float32Array(n * 6), uv = new Float32Array(n * 4), idx = [];
    const side = new T.Vector3(), dir = new T.Vector3(), cam = new T.Vector3();
    for (let i = 0; i < n; i++) {
      dir.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize(); cam.copy(pts[i]).negate().normalize();
      side.crossVectors(dir, cam).normalize();
      const ww = w * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, (i + 1) / n)) + 0.2);
      for (let s = 0; s < 2; s++) { const sg = s ? 1 : -1, k = (i * 2 + s) * 3; pos[k] = pts[i].x + side.x * ww * sg; pos[k + 1] = pts[i].y + side.y * ww * sg; pos[k + 2] = pts[i].z + side.z * ww * sg; uv[(i * 2 + s) * 2] = s; uv[(i * 2 + s) * 2 + 1] = i / (n - 1); }
      if (i < n - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setIndex(idx); return geo;
  }
  function jag(a, b, disp, depth, out) {   // まん中をずらしながら、ぎざぎざの線にする
    if (depth === 0) { out.push(b); return; }
    const m = a.clone().lerp(b, R(0.4, 0.6)).add(V(R(-1, 1), R(-0.15, 0.15), R(-1, 1)).multiplyScalar(disp));
    jag(a, m, disp * 0.55, depth - 1, out); jag(m, b, disp * 0.55, depth - 1, out);
  }
  function boltPolys(top, base, depth, disp, branches) {
    const main = [top.clone()]; jag(top, base, disp, depth, main);
    const polys = [{ pts: main, w: 1 }];
    if (branches) for (let i = 10; i < main.length - 6; i += Math.round(R(6, 12))) {
      const dir = V(R(-1, 1), -R(0.5, 1.1), R(-1, 1)).normalize(), len = R(3, 8) * (1 - i / main.length * 0.5), b = [main[i].clone()];
      jag(main[i], main[i].clone().addScaledVector(dir, len), len * 0.35, 4, b); polys.push({ pts: b, w: 0.45 });
    }
    return polys;
  }
  function flick(t, life) {   // ピカ、ピカッ、と、またたく
    if (t < 0.07) return 1; if (t < 0.11) return 0.15; if (t < 0.19) return 1; if (t < 0.24) return 0.35; if (t < 0.3) return 0.9;
    return Math.max(0, 1 - (t - 0.3) / Math.max(0.05, life - 0.3)) * 0.8;
  }
  function boltFx(polys, ws, life, glowHex) {
    const gm = addMat(glowHex, 0.6, tex.bolt), mm = addMat(0xd8e6ff, 0.9, tex.bolt), cm = addMat(0xffffff, 1, tex.bolt), objs = [];
    polys.forEach((pl) => { objs.push(new T.Mesh(ribbon(pl.pts, 0.5 * ws * pl.w), gm), new T.Mesh(ribbon(pl.pts, 0.17 * ws * pl.w), mm), new T.Mesh(ribbon(pl.pts, 0.05 * ws * pl.w), cm)); });
    objs.forEach((o) => { o.renderOrder = 3; });
    addFx(objs, life, (u, t) => { const k = flick(t, life); gm.opacity = 0.6 * k; mm.opacity = 0.9 * k; cm.opacity = k; });
  }

  // ---------- 画面のゆれ・ふち取り・ひかり ----------
  let shake = 0;
  const kick = (a) => { shake = Math.max(shake, a); };
  function applyShake(dt) {
    shake = Math.max(0, shake - dt * 0.9); const s = $('stage');
    if (shake > 0.01) s.style.transform = 'translate(' + (R(-1, 1) * shake * 16).toFixed(1) + 'px,' + (R(-1, 1) * shake * 16).toFixed(1) + 'px) scale(1.05)'; else if (s.style.transform) s.style.transform = '';
  }
  let veilTok = 0;
  function veil(bg, op, inMs, holdMs, outMs) {
    const v = $('veil'), tok = ++veilTok; v.style.transition = 'none'; v.style.background = bg; v.style.opacity = 0;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (tok !== veilTok) return; v.style.transition = 'opacity ' + inMs + 'ms ease-out'; v.style.opacity = op;
      setTimeout(() => { if (tok !== veilTok) return; v.style.transition = 'opacity ' + outMs + 'ms ease-in'; v.style.opacity = 0; }, inMs + holdMs);
    }));
  }
  const flashEl = () => $('flash');
  function flash(color, op, ms) {
    const f = flashEl(); f.style.transition = 'none'; f.style.background = color; f.style.opacity = op;
    requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transition = 'opacity ' + ms + 'ms ease-out'; f.style.opacity = 0; }));
  }
  const buzz = (n) => { try { navigator.vibrate && navigator.vibrate(n); } catch (e) {} };

  // ---------- 音(その場で作る) ----------
  let ac = null, nb = null, bus = null;
  function initAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; ac = new AC();
      nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const comp = ac.createDynamicsCompressor(); comp.connect(ac.destination);
      bus = ac.createGain(); bus.gain.value = 1.5; bus.connect(comp);
      ac.onstatechange = () => { showAudio(); };
      const conv = ac.createConvolver(), n = Math.floor(ac.sampleRate * 2.2), ir = ac.createBuffer(2, n, ac.sampleRate);   // ひびき(エコー)
      for (let c = 0; c < 2; c++) { const x = ir.getChannelData(c); for (let i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5); }
      conv.buffer = ir; const wet = ac.createGain(); wet.gain.value = 0.3; bus.connect(wet); wet.connect(conv); conv.connect(comp);
      if (navigator.audioSession) navigator.audioSession.type = 'play-and-record';
    } catch (e) { ac = null; }
  }
  function showAudio() { const e = $('cAudio'); if (!e) return; const ok = ac && ac.state === 'running'; e.textContent = '音の出口 ' + (ac ? (ok ? '○' : '× ' + ac.state) : '×'); e.className = ok ? 'on' : 'bad'; }
  function ensureAudio() {   // iPhoneは、マイクを使ったり画面を切り替えると、音が止まる。そのつど、つけ直す
    if (ac && ac.state !== 'running') ac.resume().catch(() => {});
    showAudio();
  }
  function env(g, t0, a, d, peak) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); }
  function noise(delay, dur, type, freq, peak, q) {
    if (!ac) return; const t0 = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = nb; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    const g = ac.createGain(); env(g, t0, Math.min(0.03, dur / 3), dur, peak);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t0, Math.random()); s.stop(t0 + dur + 0.1);
  }
  function noiseSweep(delay, dur, type, f0, f1, peak, q) {   // 周波数が動く雑音(ぐちゃっ、ヒュッ)
    if (!ac) return; const t0 = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = nb; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur); if (q) f.Q.value = q;
    const g = ac.createGain(); env(g, t0, Math.min(0.02, dur / 3), dur, peak);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t0, Math.random()); s.stop(t0 + dur + 0.1);
  }
  function squelch(delay, p, vol) {   // ぐちゃっ
    noiseSweep(delay, 0.13, 'bandpass', p * 3.2, p * 0.9, vol * 1.3, 5);
    tone(delay, p, p * 0.4, 0.12, vol * 0.8, 'sine'); tone(delay + 0.025, p * 1.7, p * 0.6, 0.08, vol * 0.35, 'sawtooth');
  }
  function tone(delay, f0, f1, dur, peak, type) {
    if (!ac) return; const t0 = ac.currentTime + delay;
    const o = ac.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ac.createGain(); env(g, t0, 0.02, dur, peak); o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + dur + 0.1);
  }
  function rise(delay, f0, f1, dur, peak, type) {   // だんだん高く、大きくなる音
    if (!ac) return; const t0 = ac.currentTime + delay;
    const o = ac.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ac.createGain(); env(g, t0, dur * 0.92, dur * 0.08, peak); o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + dur + 0.1);
  }
  function wind(delay, dur, peak, f0, f1) {   // ゴーッという風
    if (!ac) return; const t0 = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = nb; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(f0, t0); f.frequency.linearRampToValueAtTime(f1, t0 + dur);
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.9; lg.gain.value = f0 * 0.45; lfo.connect(lg); lg.connect(f.frequency);
    const g = ac.createGain(); env(g, t0, dur * 0.3, dur * 0.7, peak);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t0, Math.random()); lfo.start(t0); s.stop(t0 + dur + 0.1); lfo.stop(t0 + dur + 0.1);
  }
  const SND = {
    thunder() {
      noise(0, 0.2, 'highpass', 1800, 1.0); noise(0, 0.6, 'bandpass', 900, 0.9, 0.7); noiseSweep(0, 0.25, 'highpass', 6000, 800, 1.0);   // バリッ
      for (let i = 0; i < 14; i++) noise(R(0.02, 0.5), 0.03, 'highpass', R(2500, 6000), R(0.4, 0.9));   // バチバチ
      noise(0.03, 3.4, 'lowpass', 260, 1.0); tone(0.03, 62, 26, 2.6, 0.9); noise(0.8, 2.8, 'lowpass', 150, 0.7);   // ゴロゴロ
      noise(0.18, 0.15, 'highpass', 2200, 0.7); noise(0.34, 0.12, 'highpass', 2200, 0.55); tone(0.18, 80, 30, 1.4, 0.5);
    },
    fire() { noiseSweep(0, 0.9, 'bandpass', 200, 1800, 1.0, 0.8); noise(0, 4.2, 'lowpass', 300, 0.7); tone(0, 60, 40, 1.2, 0.9); noise(0, 1.0, 'bandpass', 700, 0.9, 0.6); for (let i = 0; i < 26; i++) noise(R(0, 3.6), 0.04, 'bandpass', R(900, 2800), 0.5, 2); noise(0, 4.2, 'lowpass', 420, 0.35); tone(0, 90, 50, 0.7, 0.5); },
    water() { noiseSweep(0, 0.5, 'lowpass', 300, 3000, 1.0); noise(0.05, 0.6, 'bandpass', 2200, 0.7, 0.8); for (let i = 0; i < 8; i++) tone(R(0.1, 2.5), R(300, 500), R(800, 1500), 0.12, 0.3); noise(0, 3.8, 'bandpass', 1400, 0.45, 0.7); noise(0, 3.8, 'highpass', 4000, 0.1); for (let i = 0; i < 14; i++) tone(R(0, 3.4), R(500, 900), R(1200, 1800), 0.08, 0.15); },
    onigiri() {   // ぐちゃぐちゃぐちゃぐちゃ(おにぎりを、にぎる音)
      for (let i = 0; i < 22; i++) squelch(i * 0.068 + R(0, 0.03), R(170, 420), R(0.5, 0.9));
      noise(0, 1.6, 'lowpass', 400, 0.35); for (let i = 0; i < 6; i++) tone(0.9 + i * 0.1, R(500, 700), R(900, 1300), 0.1, 0.3, 'triangle');   // 最後に、ぽこぽこ
    },
    ice() {
      wind(0, 5.4, 0.55, 450, 1100); wind(0.2, 5, 0.25, 1500, 2600); tone(0, 90, 60, 1.4, 0.35);
      for (let i = 0; i < 16; i++) { const f = R(2200, 4600); tone(R(0, 4.2), f, f * 0.98, 0.6, 0.07); }
      for (let i = 0; i < 12; i++) noise(R(0.1, 1.4), 0.05, 'highpass', 3500, 0.45);   // 氷がきしむ音
    },
    shot(d) {
      tone(d, 500, 1800, 0.85, 0.05); noise(d + 0.85, 0.5, 'lowpass', 180, 1.0); tone(d + 0.85, 100, 40, 0.5, 0.7); noise(d + 0.88, 1.4, 'highpass', 4500, 0.3);
      for (let i = 0; i < 14; i++) noise(d + 0.95 + R(0, 1.2), 0.03, 'highpass', 5000, 0.35);
    },
    heart() { [660, 880, 1320, 1760, 2200, 2640].forEach((f, i) => { tone(i * 0.12, f, f * 1.02, 1.0, 0.3); tone(i * 0.12, f * 2, f * 2.02, 0.6, 0.1); }); tone(0.9, 90, 80, 0.25, 0.4); tone(1.2, 90, 80, 0.25, 0.3); },
    star() { for (let i = 0; i < 6; i++) tone(i * 0.22, 2600, 500, 0.9, 0.18, 'triangle'); [0.3, 0.5, 0.7, 1.1, 1.4].forEach((d) => tone(d, R(2000, 3000), 1500, 0.3, 0.12)); },
    kame() {
      rise(0, 140, 2600, 1.65, 0.16, 'sawtooth'); rise(0, 55, 220, 1.65, 0.5); rise(0, 300, 3500, 1.65, 0.16, 'triangle'); wind(0, 1.7, 0.35, 300, 2800);
      noise(1.7, 2.7, 'lowpass', 1200, 0.9); noise(1.7, 2.7, 'highpass', 3500, 0.18); tone(1.7, 110, 90, 2.7, 0.5, 'sawtooth'); tone(1.7, 55, 50, 2.7, 0.7); tone(1.72, 440, 330, 2.5, 0.12, 'square');
      noise(2.2, 0.3, 'highpass', 1500, 0.9); noise(2.2, 3, 'lowpass', 200, 1.0); tone(2.2, 70, 26, 2.2, 0.9);
    },
  };

  // ---------- 魔法のしくみ ----------
  const MAGIC = {
    thunder() {
      const f = fwd();
      const strike = (delay, fd, lat, big) => setTimeout(() => {
        const base = at(f, fd, lat, GROUND), top = base.clone().add(V(R(-3, 3), 36, R(-3, 3)));
        boltFx(boltPolys(top, base, 7, 4.5, true), big ? 1.3 : 0.8, 0.9, 0x6c8cff);
        for (let i = 0; i < 90; i++) spawn({ tex: 'spark', pos: base.clone(), vel: V(R(-6, 6), R(1, 9), R(-6, 6)), g: -12, size: R(0.15, 0.4), life: R(0.5, 1.1), add: true, color: 0xffee99, pw: 1 });
        spawn({ pos: base.clone().setY(GROUND + 0.5), size: big ? 9 : 6, life: 0.6, add: true, color: 0xaac4ff, op: 0.9 });
        spawn({ tex: 'spark', pos: base.clone().setY(GROUND + 0.5), size: big ? 12 : 8, life: 0.4, add: true, color: 0xffffff, op: 1 });
        for (let i = 0; i < 4; i++) spawn({ tex: 'smoke', pos: base.clone().add(V(R(-1, 1), 0.2, R(-1, 1))), vel: V(R(-1.5, 1.5), R(0.5, 1.5), R(-1.5, 1.5)), size: R(2, 3.5), grow: 3, life: 1.8, color: 0x8892a8, op: 0.35 });   // 砂ぼこり
        for (let i = 0; i < 3; i++) spawn({ tex: 'smoke', pos: at(f, fd, lat, 16 + i * 3), size: 28, life: 0.9, add: true, color: 0x7f9cff, op: 0.55, fadeIn: 0.05 });   // 雲が光る
        groundRing(base, big ? 9 : 6, 0xaac4ff, 0.7, 0.9); groundRing(base, 3.5, 0xffffff, 0.4, 1);
        flash('#e6ecff', big ? 1 : 0.7, big ? 600 : 420); kick(big ? 0.9 : 0.5); buzz(big ? [120, 30, 160] : 60);
        if (big) setTimeout(() => flash('#ffffff', 0.8, 400), 130);
      }, delay);
      strike(0, R(7, 10), R(-2, 2), true); strike(190, R(9, 13), R(-8, -4), false); strike(360, R(9, 13), R(4, 8), false);
      veil('radial-gradient(ellipse at center, rgba(120,150,255,0) 30%, rgba(80,100,220,.55) 100%)', 0.8, 120, 500, 1800);
      SND.thunder();
    },
    fire() {
      const f = fwd(), spots = [];
      for (let i = 0; i < 16; i++) spots.push(at(f, R(2.2, 7), R(-4.8, 4.8), GROUND));
      spots.forEach((p, i) => setTimeout(() => {   // ボッと燃え上がる
        for (let k = 0; k < 7; k++) spawn({ tex: 'flame', aspect: 0.66, pos: p.clone().add(V(R(-0.3, 0.3), 1, R(-0.3, 0.3))), vel: V(R(-0.5, 0.5), R(2, 4), R(-0.5, 0.5)), size: R(2, 3.4), grow: 0.5, life: R(0.6, 1), add: true, op: 0.5, color: (t, c) => c.setHSL(0.11 - 0.1 * t, 1, 0.55 - 0.15 * t) });
        spawn({ pos: p.clone().setY(GROUND + 0.4), size: 6, life: 0.7, add: true, color: 0xff8a2a, op: 0.6 });
      }, i * 40));
      emit(0, 4200, (dt, u) => {
        const k = u < 0.8 ? 1 : (1 - u) / 0.2;
        spots.forEach((p) => {
          if (Math.random() < dt * 24 * k) { const s = R(1.1, 2.3); spawn({ tex: 'flame', aspect: 0.66, pos: p.clone().add(V(R(-0.35, 0.35), s * 0.5, R(-0.35, 0.35))), vel: V(R(-0.3, 0.3), R(0.8, 1.9), R(-0.3, 0.3)), size: s, grow: 0.45, life: R(0.7, 1.3), add: true, op: 0.5, pw: 0.8, color: (t, c) => c.setHSL(0.12 - 0.12 * t, 1, 0.55 - 0.15 * t) }); }
          if (Math.random() < dt * 4 * k) spawn({ tex: 'smoke', pos: p.clone().setY(GROUND + 2.2), vel: V(R(-0.3, 0.3), R(1, 1.8), R(-0.3, 0.3)), size: R(1.5, 2.4), grow: 2.4, life: 2.4, color: 0x262020, op: 0.4, spin: R(-0.4, 0.4) });
          if (Math.random() < dt * 5 * k) spawn({ pos: p.clone().setY(GROUND + 0.5), size: R(3, 5), life: 0.5, add: true, color: 0xff7a1a, op: 0.3 });
        });
        if (Math.random() < dt * 45 * k) { const p = spots[Math.floor(Math.random() * spots.length)]; spawn({ tex: 'spark', pos: p.clone().setY(GROUND + 0.6), vel: V(R(-1, 1), R(2.5, 6), R(-1, 1)), size: R(0.12, 0.3), life: R(1, 2.4), add: true, color: 0xffb347, g: -0.8, drag: 0.3 }); }
        kick(0.08 * k);
      });
      veil('radial-gradient(ellipse at center, rgba(255,120,30,0) 35%, rgba(255,80,10,.5) 100%)', 0.85, 400, 2600, 1400);
      flash('#ff8a2a', 0.5, 800); SND.fire(); buzz([60, 30, 40]);
    },
    water() {
      const f = fwd(), spots = [];
      for (let i = 0; i < 9; i++) spots.push(at(f, R(2, 6), R(-4.8, 4.8), GROUND));
      const splash = (p) => {
        for (let i = 0; i < 3; i++) spawn({ pos: p.clone().setY(GROUND + 0.02), vel: V(R(-1, 1), R(1, 2), R(-1, 1)), g: -9, size: 0.1, life: 0.5, color: 0xcdeaff, op: 0.8 });
        if (Math.random() < 0.08) groundRing(p, R(0.6, 1.3), 0xcdeaff, 0.7, 0.5);
      };
      emit(0, 4000, (dt, u) => {
        const k = u < 0.85 ? 1 : (1 - u) / 0.15;
        spots.forEach((p) => {
          const n = Math.round(dt * 80 * k);
          for (let i = 0; i < n; i++) spawn({ pos: p.clone(), vel: V(R(-0.9, 0.9), R(4.5, 7.2), R(-0.9, 0.9)), g: -9.8, size: R(0.12, 0.26), life: 3, floor: true, onFloor: splash, color: 0x8fcfff, op: 0.85, pw: 0.2 });
          if (Math.random() < dt * 30 * k) spawn({ tex: 'spark', pos: p.clone().add(V(R(-0.3, 0.3), R(0.5, 3), R(-0.3, 0.3))), size: R(0.15, 0.35), life: 0.5, add: true, color: 0xffffff, op: 0.8 });
          if (Math.random() < dt * 12 * k) spawn({ tex: 'smoke', pos: p.clone().setY(GROUND + 0.3), vel: V(R(-0.3, 0.3), R(0.6, 1.2), R(-0.3, 0.3)), size: R(1.2, 2), grow: 2.2, life: 1.5, color: 0xe4f3ff, op: 0.22 });
        });
        kick(0.05 * k);
      });
      spots.forEach((p, i) => setTimeout(() => groundRing(p, 2.2, 0x9fd4ff, 0.9, 0.7), i * 60));
      veil('radial-gradient(ellipse at center, rgba(60,140,255,0) 40%, rgba(40,110,255,.45) 100%)', 0.7, 500, 2500, 1400);
      flash('#3a8bff', 0.25, 600); SND.water(); buzz(30);
    },
    onigiri() {
      const f = fwd(), r = rgt(f);
      emit(0, 1100, (dt) => {
        const n = Math.max(1, Math.round(dt * 55));
        for (let i = 0; i < n; i++) {
          const dir = f.clone().multiplyScalar(R(4.5, 8)).addScaledVector(r, R(-4, 4)).setY(R(0.5, 4.5));
          spawn({ tex: '🍙', pos: f.clone().multiplyScalar(0.6).setY(-0.35).addScaledVector(r, R(-0.3, 0.3)), vel: dir, g: -2.2, size: R(0.22, 0.42), grow: 1.5, life: R(2, 3), op: 1, pw: 0.35 });
        }
      });
      SND.onigiri(); buzz(40);
    },
    ice() {
      const f = fwd(), r = rgt(f);
      veil('radial-gradient(ellipse at center, rgba(190,235,255,0) 18%, rgba(150,210,255,.85) 100%)', 1, 900, 3000, 1800);
      flash('#d8f2ff', 0.6, 1000); kick(0.3); groundRing(V(0, 0, 0), 11, 0xbfe8ff, 1.2, 0.6);
      emit(0, 5200, (dt, u) => {   // ふぶき(右から左へ)
        const k = Math.min(1, u * 6) * (u > 0.82 ? (1 - u) / 0.18 : 1);
        const n = Math.round(dt * 650 * k);
        for (let i = 0; i < n; i++) {
          const near = Math.random() < 0.12, flake = Math.random() < 0.3;
          spawn({ tex: flake ? 'flake' : 'glow', pos: at(f, near ? R(0.5, 3) : R(-2, 12), near ? R(2, 6) : R(5, 16), R(-2.5, 5)),
            vel: r.clone().multiplyScalar(-R(near ? 14 : 9, near ? 22 : 16)).addScaledVector(f, R(-2, 2)).setY(R(-2.2, -0.4)), size: near ? R(0.3, 0.7) : R(0.14, flake ? 0.5 : 0.3),
            life: R(0.9, 1.7), op: near ? 0.6 : 0.95, pw: 0.15, color: 0xeaf6ff, spin: flake ? R(-3, 3) : 0, rot: R(0, 6) });
        }
        if (Math.random() < dt * 30 * k) spawn({ tex: 'smoke', pos: at(f, R(2, 10), R(6, 14), R(-1.5, 3)), vel: r.clone().multiplyScalar(-R(5, 9)), size: R(5, 9), grow: 1.4, life: R(1.5, 2.4), color: 0xe4f4ff, op: 0.3, fadeIn: 0.25, spin: R(-0.3, 0.3) });
        if (Math.random() < dt * 22 * k) spawn({ tex: 'spark', pos: at(f, R(1, 8), R(-5, 5), R(-1, 3)), size: R(0.2, 0.6), life: 0.6, add: true, color: 0xcfeeff, op: 0.9 });
        kick(0.1 * k);
      });
      for (let i = 0; i < 16; i++) {   // 氷の柱が、地面からつき出す
        const p = at(f, R(2.5, 9), R(-6, 6), GROUND), h = R(1.2, 3.8), rad = h * R(0.1, 0.16), geo = new T.ConeGeometry(rad, h, 5);
        geo.translate(0, h / 2, 0);
        const mat = new T.MeshLambertMaterial({ color: 0xcdeeff, emissive: 0x3a86b8, flatShading: true, transparent: true, opacity: 0.9 });
        const m = new T.Mesh(geo, mat); m.position.copy(p); m.rotation.set(R(-0.25, 0.25), R(0, 6), R(-0.25, 0.25)); m.scale.y = 0.001; m.renderOrder = 1;
        setTimeout(() => {
          addFx([m], 4.2, (u, t) => { const g = Math.min(1, t / 0.35); m.scale.y = Math.max(0.001, 1 - Math.pow(1 - g, 3)); mat.opacity = 0.9 * Math.min(1, (1 - u) * 5); });
          const tip = p.clone().setY(GROUND + h); spawn({ tex: 'spark', pos: tip, size: h * 0.7, life: 0.7, add: true, color: 0xcfeeff });
          spawn({ tex: 'smoke', pos: p.clone().setY(GROUND + 0.3), vel: V(0, 0.4, 0), size: 2, grow: 2.5, life: 1.4, color: 0xe4f4ff, op: 0.4 });
          for (let j = 0; j < 8; j++) spawn({ tex: 'glow', pos: p.clone().setY(GROUND + 0.2), vel: V(R(-2, 2), R(1, 4), R(-2, 2)), g: -7, size: 0.08, life: 0.8, add: true, color: 0xcfeeff });
        }, R(0, 1300));
      }
      SND.ice(); buzz([40, 30, 40]);
    },
    hanabi() {
      const f = fwd(), r = rgt(f), up = V(0, 1, 0);
      const PAL = [0xff4a6a, 0xffd24a, 0x5ae0ff, 0x9a7bff, 0x6bff9a, 0xff8a3a, 0xffffff];
      const burst = (c, col, col2, kind) => {
        const n = kind === 0 ? 140 : 90;
        for (let i = 0; i < n; i++) {
          let d;
          if (kind === 0) d = V(R(-1, 1), R(-1, 1), R(-1, 1)).normalize().multiplyScalar(R(3, 6));
          else { const a = i / n * Math.PI * 2; d = r.clone().multiplyScalar(Math.cos(a) * 5.2).addScaledVector(up, Math.sin(a) * 5.2).addScaledVector(f, R(-0.5, 0.5)); }
          spawn({ tex: 'spark', pos: c.clone(), vel: d, g: -1.3, drag: 0.7, size: R(0.35, 0.6), life: R(1.7, 2.4), add: true, pw: 0.7, color: i % 4 === 0 ? col2 : col, trail: i % 2 ? 0.08 : 0 });
        }
        for (let i = 0; i < 45; i++) spawn({ tex: 'spark', pos: c.clone(), vel: V(R(-1, 1), R(-0.3, 1), R(-1, 1)).normalize().multiplyScalar(R(0.5, 2.2)), g: -1.1, drag: 0.4, size: R(0.15, 0.3), life: R(2.4, 3.4), add: true, color: 0xffd27a, pw: 0.6 });   // 金色の、ふってくる粒
        spawn({ pos: c.clone(), size: 8, life: 0.3, add: true, color: 0xffffff, op: 0.8 });
        spawn({ tex: 'spark', pos: c.clone(), size: 12, life: 0.45, add: true, color: col, op: 1 });
        spawn({ tex: 'ring', pos: c.clone(), size: 1, grow: 12, life: 0.7, add: true, color: col, op: 0.5 });
        flash('#ffffff', 0.18, 350); kick(0.35); buzz(50);
      };
      [[0, 0], [550, 1], [1150, 0], [1800, 1]].forEach(([delay, kind]) => {
        SND.shot(delay / 1000);
        setTimeout(() => {
          const base = at(f, R(9, 14), R(-6, 6), GROUND), top = base.clone().setY(R(3, 7)), col = PAL[Math.floor(R(0, PAL.length))], col2 = PAL[Math.floor(R(0, PAL.length))];
          emit(0, 850, (dt, u) => {   // ひゅーっと、のぼる
            const p = base.clone().lerp(top, 1 - Math.pow(1 - u, 2));
            spawn({ pos: p.clone(), vel: V(R(-0.3, 0.3), R(-1.5, 0), R(-0.3, 0.3)), size: 0.28, life: 0.5, add: true, color: 0xffc870, op: 0.9 });
            spawn({ tex: 'spark', pos: p, size: 0.35, life: 0.15, add: true, color: 0xffffff });
          });
          setTimeout(() => burst(top, col, col2, kind), 850);
        }, delay);
      });
    },
    heart() {
      const f = fwd(), r = rgt(f), up = V(0, 1, 0), C = at(f, 7, 0, 0.9);
      for (let i = 0; i < 220; i++) setTimeout(() => {   // 光の粒で、大きなハートを描く
        const a = i / 220 * Math.PI * 2, x = 16 * Math.pow(Math.sin(a), 3), y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
        spawn({ pos: C.clone().addScaledVector(r, x * 0.105).addScaledVector(up, y * 0.105), vel: V(0, 0.12, 0), size: 0.6, life: 3.2, add: true, color: 0xff6fae, op: 0.95, pw: 0.5, fadeIn: 0.05 });
      }, i * 5);
      for (let i = 0; i < 100; i++) setTimeout(() => {
        const a = R(0, 6.283), rr = Math.sqrt(R(0, 1)) * 0.85, x = 16 * Math.pow(Math.sin(a), 3) * rr, y = (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * rr;
        spawn({ pos: C.clone().addScaledVector(r, x * 0.105).addScaledVector(up, y * 0.105), size: R(0.25, 0.5), life: 2.4, add: true, color: 0xff9ad0, op: 0.45, pw: 0.6, fadeIn: 0.1 });
      }, 700 + i * 6);
      setTimeout(() => { spawn({ tex: 'heart', pos: C.clone(), size: 3, grow: 2.2, life: 1.3, op: 0.95, pw: 0.7 }); spawn({ pos: C.clone(), size: 9, life: 0.8, add: true, color: 0xff7ab8, op: 0.6 }); flash('#ff9ad0', 0.3, 700); kick(0.2); buzz([40, 80, 40]); }, 1250);
      emit(0, 2600, (dt) => {
        const n = Math.max(1, Math.round(dt * 14));
        for (let i = 0; i < n; i++) spawn({ tex: 'heart', pos: at(f, R(1.5, 4.5), R(-3, 3), R(-1.2, 0)), vel: V(R(-0.3, 0.3), R(0.7, 1.4), R(-0.3, 0.3)), size: R(0.3, 0.65), grow: 1.3, life: R(2.5, 3.5), pw: 0.4 });
        if (Math.random() < dt * 25) spawn({ tex: 'spark', pos: at(f, R(1.5, 5), R(-3, 3), R(-1, 2.5)), size: R(0.2, 0.5), life: 0.7, add: true, color: 0xffc0e0, op: 0.9 });
      });
      veil('radial-gradient(ellipse at center, rgba(255,140,200,0) 40%, rgba(255,110,180,.4) 100%)', 0.7, 500, 2000, 1200);
      SND.heart();
    },
    star() {
      const f = fwd(), r = rgt(f);
      for (let k = 0; k < 8; k++) setTimeout(() => {
        const start = at(f, R(6, 11), R(-2, 8), R(3, 7)), v = V(0, 0, 0).addScaledVector(r, -R(6, 9)).setY(-R(2, 3.8)).addScaledVector(f, R(-1, 1)), tr0 = performance.now();
        spawn({ tex: 'star', pos: start, vel: v, size: 0.8, life: 1.4, pw: 0.5, spin: 3 });
        spawn({ tex: 'spark', pos: start.clone(), vel: v.clone(), size: 1.6, life: 1.4, add: true, color: 0xfff1a8, pw: 0.5 });
        emit(0, 1300, () => {   // しっぽ
          const p = start.clone().addScaledVector(v, (performance.now() - tr0) / 1000);
          for (let i = 0; i < 3; i++) spawn({ pos: p.clone().add(V(R(-0.1, 0.1), R(-0.1, 0.1), R(-0.1, 0.1))), size: R(0.25, 0.55), life: 0.7, add: true, color: 0xfff1a8, op: 0.8, grow: 0.3 });
        });
      }, k * 200);
      emit(0, 2400, (dt) => { if (Math.random() < dt * 18) spawn({ tex: 'spark', pos: at(f, R(5, 14), R(-8, 8), R(1, 8)), size: R(0.4, 1), life: 1.4, add: true, color: 0xfff3b8, op: 0.9, fadeIn: 0.3 }); });
      flash('#fff3b8', 0.15, 500); SND.star(); buzz(30);
    },
    kamehameha() {
      const CH = 1700, LMAX = 38, TB = 2.7;
      const f = fwd(), P = f.clone().multiplyScalar(0.9).setY(-0.45);
      veil('radial-gradient(ellipse at center, rgba(60,140,255,0) 30%, rgba(60,140,255,.6) 100%)', 1, 900, 800, 900);
      const mk = (hex) => new T.Sprite(new T.SpriteMaterial({ map: tex.glow, color: hex, transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending }));
      const A = mk(0x66ccff), B = mk(0xffffff); A.position.copy(P); B.position.copy(P); A.renderOrder = B.renderOrder = 4;
      addFx([A, B], CH / 1000, (u, t) => { A.scale.setScalar(0.15 + 1.1 * u * u + 0.06 * Math.sin(t * 40)); B.scale.setScalar(0.08 + 0.45 * u); });
      emit(0, CH, (dt, u) => {   // ため: 気が集まる
        for (let i = 0; i < Math.round(dt * 110); i++) {
          const dir = V(R(-1, 1), R(-1, 1), R(-1, 1)).normalize(), pos = P.clone().addScaledVector(dir, R(1.6, 4)), life = 0.6;
          spawn({ tex: 'spark', pos, vel: P.clone().sub(pos).divideScalar(life), size: R(0.12, 0.3), life, add: true, color: Math.random() < 0.5 ? 0x9fe0ff : 0xffffff, pw: 0 });
        }
        if (Math.random() < dt * 70) { const a = R(0, 6.283), rr = R(1, 2.4); spawn({ tex: 'flame', aspect: 0.5, pos: V(Math.cos(a) * rr, GROUND + 0.8, Math.sin(a) * rr), vel: V(0, R(3, 5.5), 0), size: R(1.2, 2), life: 0.7, add: true, color: 0x6ad0ff, op: 0.6, grow: 0.6 }); }
        if (Math.random() < dt * 10) { const b = P.clone().add(V(R(-1, 1), R(-1, 1), R(-1, 1)).normalize().multiplyScalar(R(0.8, 1.7))); boltFx(boltPolys(P.clone(), b, 3, 0.25, false), 0.14, 0.18, 0x66ccff); }
        kick(0.04 + 0.28 * u * u);
      });
      [0, 450, 850, 1200, 1500].forEach((d) => setTimeout(() => spawn({ tex: 'ring', pos: P.clone(), size: 0.6, grow: 6, life: 0.7, add: true, color: 0x88ddff, op: 0.8 }), d));
      setTimeout(() => {   // 発射
        const D = camera.getWorldDirection(new T.Vector3()).normalize(), O = D.clone().multiplyScalar(0.9).add(V(0, -0.45, 0));
        const qd = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), D), s1 = new T.Vector3().crossVectors(D, V(0, 1, 0)).normalize(), s2 = new T.Vector3().crossVectors(D, s1).normalize();
        const LAY = [[0.07, 0xffffff, 1], [0.15, 0xe6f8ff, 0.6], [0.26, 0xa8e4ff, 0.4], [0.4, 0x5ab8ff, 0.28], [0.6, 0x2f80ff, 0.2]];
        const meshes = LAY.map(([rad, col, op]) => { const me = new T.Mesh(new T.CylinderGeometry(rad, rad * 0.3, 1, 20, 1, true), addMat(col, op)); me.renderOrder = 3; return me; });
        const H1 = mk(0x9fe0ff), H2 = new T.Sprite(new T.SpriteMaterial({ map: tex.spark, color: 0xffffff, transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending })), S = mk(0x66ccff);
        H1.renderOrder = H2.renderOrder = S.renderOrder = 4;
        addFx(meshes.concat([H1, H2, S]), TB, (u, t, dt) => {
          const len = Math.min(LMAX, 75 * t), widen = Math.min(1, t / 0.18) * (t > TB - 0.7 ? Math.max(0, (TB - t) / 0.7) : 1), wob = 1 + 0.07 * Math.sin(t * 55) + 0.04 * Math.sin(t * 23);
          meshes.forEach((me) => { me.scale.set(Math.max(0.001, widen * wob), Math.max(0.01, len), Math.max(0.001, widen * wob)); me.position.copy(O).addScaledVector(D, len / 2); me.quaternion.copy(qd); });
          H1.position.copy(O).addScaledVector(D, len); H2.position.copy(H1.position); H1.scale.setScalar((3.5 + Math.sin(t * 30)) * widen + 0.01); H2.scale.setScalar(6 * widen + 0.01);
          S.position.copy(O); S.scale.setScalar((1.4 + 0.2 * Math.sin(t * 35)) * widen + 0.01);
          for (let i = 0; i < Math.round(dt * 420 * widen); i++) {   // ビームのまわりの火花
            const al = R(0, len);
            spawn({ tex: 'spark', pos: O.clone().addScaledVector(D, al).addScaledVector(s1, R(-1, 1) * 0.7).addScaledVector(s2, R(-1, 1) * 0.7), vel: D.clone().multiplyScalar(R(10, 24)).addScaledVector(s1, R(-1.5, 1.5)).addScaledVector(s2, R(-1.5, 1.5)), size: R(0.14, 0.34), life: 0.5, add: true, color: Math.random() < 0.5 ? 0xffffff : 0x8fd8ff, pw: 0.8 });
          }
          kick(0.55 * widen);
        });
        flash('#ffffff', 0.7, 600); buzz([60, 20, 60, 20, 80, 20, 200]);
        veil('radial-gradient(ellipse at center, rgba(120,200,255,.2) 20%, rgba(60,140,255,.5) 100%)', 1, 150, 1800, 700);
        setTimeout(() => {   // 当たって、ドカーン
          const head = O.clone().addScaledVector(D, LMAX);
          for (let i = 0; i < 80; i++) { const dir = V(R(-1, 1), R(-1, 1), R(-1, 1)).normalize(); spawn({ pos: head.clone(), vel: dir.multiplyScalar(R(3, 13)), size: R(2, 5.5), grow: 1.8, life: R(0.9, 1.8), add: true, op: 0.8, pw: 0.8, drag: 1, color: (t, c) => c.setHSL(0.58 - 0.5 * t, 1, 0.85 - 0.45 * t) }); }
          spawn({ pos: head.clone(), size: 30, life: 0.7, add: true, color: 0xffffff, op: 1 });
          spawn({ tex: 'spark', pos: head.clone(), size: 36, life: 0.6, add: true, color: 0xcdeeff });
          [0, 150].forEach((d) => setTimeout(() => spawn({ tex: 'ring', pos: head.clone(), size: 4, grow: 14, life: 0.9, add: true, color: 0x9fe0ff, op: 0.8 }), d));
          flash('#ffffff', 0.9, 900); kick(1); buzz([200, 40, 120]);
        }, 480);
      }, CH);
      SND.kame();
    },
  };


  const lastCast = {};
  function cast(name, source) {
    const now = performance.now();
    if (!MAGIC[name] || now - (lastCast[name] || -1e9) < (SPELLS[name].cd || 500)) return;
    lastCast[name] = now;
    ensureAudio();
    try { MAGIC[name](); } catch (e) { $('diag').textContent = '魔法のエラー: ' + (e && e.message); }
    log('cast ' + name + (source ? ' (' + source + ')' : ''));
    if (!$('book').hidden && source === '声') turn(KEYS.indexOf(name));
  }
  let castLog = [];
  function log(s) { castLog.push(s); castLog = castLog.slice(-3); }

  // ---------- マイクの音の大きさ(メーター) ----------
  let mAn = null, mBuf = null, mStream = null, mLvl = 0, mPeak = 0;
  const flag = (id, text, cls, ms) => { const e = $(id); e.textContent = text; e.className = cls || ''; if (ms) setTimeout(() => { if (e.textContent === text) { e.className = ''; } }, ms); };
  async function startMeter() {
    try {
      mStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
      const src = ac.createMediaStreamSource(mStream);
      mAn = ac.createAnalyser(); mAn.fftSize = 512; mBuf = new Float32Array(mAn.fftSize); src.connect(mAn);
      flag('cMic', 'マイク ○', 'on');
    } catch (e) { mAn = null; flag('cMic', 'マイク ×(' + (e.name || e) + ')', 'bad'); }
  }
  function stopMeter() { if (mStream) mStream.getTracks().forEach((t) => t.stop()); mStream = null; mAn = null; $('mfill').style.width = '0'; flag('cMic', 'マイク -', ''); }
  function meterTick() {
    if (!mAn) return;
    mAn.getFloatTimeDomainData(mBuf);
    let s = 0; for (let i = 0; i < mBuf.length; i++) s += mBuf[i] * mBuf[i];
    const lv = Math.min(1, Math.sqrt(Math.sqrt(s / mBuf.length)) * 1.6);   // 小さい声でも動くように
    mLvl = lv > mLvl ? lv : mLvl * 0.85; mPeak = Math.max(mPeak * 0.97, lv);
    $('mfill').style.width = (mLvl * 100).toFixed(0) + '%';
    if (lv > 0.35) flag('cSound', '音 ○', 'on', 600);
  }
  let resN = 0;

  // ---------- 声 ----------
  let rec = null, wantRec = false, seen = {}, saidTimer = 0, micState = '';
  function setMic(icon, text) { $('mic').textContent = icon; if (text) setSaid(text, true); }
  function setSaid(t, keep) { const s = $('said'); s.textContent = t; clearTimeout(saidTimer); if (!keep) saidTimer = setTimeout(() => { s.textContent = '呪文を言ってください'; }, 4000); }
  // 聞こえた文字(途中の文字も含む)を見て、新しく出てきた呪文だけを唱える
  function heard(results, from) {
    for (let i = from; i < results.length; i++) {
      const text = results[i][0].transcript, c = countSpells(text), prev = seen[i] || {};
      if (i === results.length - 1) { setSaid(text); resN++; $('cRes').textContent = '認識 ' + resN; $('cRes').className = 'on'; $('raw').textContent = '聞こえた文字: ' + text + (Object.keys(c).length ? '  → ' + Object.keys(c).map((k) => SPELLS[k].label).join('・') : '  → 呪文なし'); }
      for (const k in c) { const add = c[k] - (prev[k] || 0); for (let j = 0; j < add; j++) cast(k, '声'); }
      seen[i] = c;
    }
  }
  function startRec() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setMic('🚫', 'このブラウザは、声の聞き取りに対応していません。下のボタンで、魔法を出せます'); return false; }
    wantRec = true;
    const begin = () => {
      if (!wantRec) return;
      rec = new SR(); rec.lang = 'ja-JP'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1; seen = {};
      rec.onstart = () => { setMic('🎤'); flag('cRes', '認識 ' + resN + '(待機中)', ''); };
      rec.onsoundstart = () => flag('cSound', '音 ○', 'on', 1500);
      rec.onspeechstart = () => flag('cVoice', '声 ○', 'on', 1500);
      rec.onspeechend = () => flag('cVoice', '声 -', '');
      rec.onresult = (e) => { try { heard(e.results, e.resultIndex); } catch (x) {} };
      rec.onerror = (e) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { wantRec = false; setMic('🚫', 'マイク(音声認識)が許可されていません。設定で許可してください(iPhone: 設定→一般→キーボード→音声入力をオン)'); }
        else if (e.error === 'network') setMic('📡', '聞き取りの電波がありません。下のボタンで魔法が出せます');
        else setMic('⚠', '聞き取りのエラー: ' + e.error);
      };
      rec.onend = () => { setMic('💤'); if (wantRec) setTimeout(begin, 250); };
      try { rec.start(); } catch (e) { setTimeout(begin, 800); }
    };
    begin(); return true;
  }

  // ---------- ぜんぶ動かす ----------
  let running = false, lastT = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    try {
      const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
      if (Math.floor(t / 1000) !== loop.s) { loop.s = Math.floor(t / 1000); ensureAudio(); }
      meterTick(); look(); updateEmitters(dt); updateFx(dt); updateParts(dt); applyShake(dt); renderer.render(scene, camera);
      if (Math.floor(t / 500) !== loop.k) { loop.k = Math.floor(t / 500); $('diag').textContent = '粒 ' + parts.length + (ori.n ? ' 向き○' : ' 向き×') + (castLog.length ? '\n' + castLog.join(' / ') : '') + '\n版 ' + VER; }
    } catch (e) { $('diag').textContent = 'エラー: ' + (e && e.message); }
  }

  // ---------- 必殺の本(1ページに1つの呪文) ----------
  const KEYS = Object.keys(SPELLS); let pg = 0, flipping = false;
  function fillPage() {
    const k = KEYS[pg], sp = SPELLS[k];
    $('pno').textContent = (pg + 1) + '/' + KEYS.length;
    $('pic').textContent = sp.icon; $('pname').textContent = sp.label;
  }
  function turn(to, dir) {
    to = (to + KEYS.length) % KEYS.length;
    if (flipping || to === pg) return;
    flipping = true; const el = $('page');
    el.classList.add('out');
    setTimeout(() => {
      pg = to; fillPage(); el.classList.remove('out'); el.classList.add('in');
      requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.remove('in'); flipping = false; }));
    }, 170);
  }
  function openBook(on) { $('book').hidden = !on; }
  function buildBook() {
    fillPage();
    $('bookBtn').addEventListener('click', () => openBook($('book').hidden));
    $('pclose').addEventListener('click', () => openBook(false));
    $('pprev').addEventListener('click', () => turn(pg - 1));
    $('pnext').addEventListener('click', () => turn(pg + 1));
    $('pcast').addEventListener('click', () => cast(KEYS[pg], 'ほん'));
    let sx = null;   // 左右になぞって、めくる
    const pe = $('page');
    pe.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    pe.addEventListener('touchend', (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 40) turn(pg + (dx < 0 ? 1 : -1)); });
  }

  async function start() {
    const err = $('err'), step = $('step'); err.textContent = '';
    $('go').disabled = true;
    try {
      initAudio();
      if (ac && ac.state === 'suspended') ac.resume();
      step.textContent = '1/3 スマホの向きの許可';
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') await DeviceOrientationEvent.requestPermission();
      } catch (e) { /* 向きが取れなくても、続ける */ }
      step.textContent = '2/3 カメラの許可';
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        $('cam').srcObject = stream; await $('cam').play().catch(() => {});
      } catch (e) { err.textContent = 'カメラが使えません(' + (e.name || e) + ')。カメラなしで続けます。'; }
      step.textContent = '3/3 画面の準備';
      initGL(); initTex(); initLook(); buildBook();
      $('start').hidden = true; $('stage').hidden = false;
      if (!T) throw new Error('three.js が読み込めませんでした');
      window.addEventListener('resize', () => {});
      requestAnimationFrame(loop);
      try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => {}); } catch (e) {}
      startMeter().then(() => setTimeout(() => startRec(), 400));   // マイクの許可は、画面が出てから
      $('meter').addEventListener('click', () => { if (mAn) stopMeter(); else startMeter(); });
    } catch (e) {
      err.textContent = '始められませんでした: ' + (e && e.name ? e.name + ' ' : '') + (e && e.message || e);
      $('go').disabled = false;
    }
  }
  $('go').addEventListener('click', start);
  window.addEventListener('pointerdown', ensureAudio); window.addEventListener('touchend', ensureAudio);
  $('ver').textContent = '版 ' + VER;
  document.addEventListener('visibilitychange', () => { if (!document.hidden && wantRec && rec) { try { rec.start(); } catch (e) {} } });
  if (/debug/.test(location.hash)) document.body.classList.add('debug');
  window.__mahou = { cast, countSpells, meter: () => ({ on: !!mAn, lvl: mLvl, peak: mPeak }), heard: (t) => heard([[{ transcript: t }]], 0) };
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
