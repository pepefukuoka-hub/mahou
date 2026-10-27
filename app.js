(() => {
  'use strict';
  const VER = 2;
  const $ = (id) => document.getElementById(id);
  const GROUND = -1.4;   // 目の高さ 1.4 m と見なした、地面の高さ

  // ---------- 呪文(ことば) ----------
  const SPELLS = {
    thunder: { icon: '⚡', label: 'サンダー', words: ['サンダー', 'サンダ', 'サンダァ', '雷', 'カミナリ', 'ライトニング', 'イナズマ', '稲妻', 'thunder', 'lightning'] },
    fire: { icon: '🔥', label: 'ファイヤー', words: ['ファイヤー', 'ファイアー', 'ファイア', 'ファイヤ', 'ファイ', 'ファイヤーー', '火', '炎', 'ホノオ', 'fire'] },
    water: { icon: '💧', label: 'ウォーター', words: ['ウォーター', 'ウォータ', 'ウオーター', 'ウォター', 'ワーター', 'ウォーラー', '水', 'ミズ', 'アクア', 'water'] },
    onigiri: { icon: '🍙', label: 'にぎにぎ', words: ['ニギニギ', '握握', '握り握り', 'ニギ二ギ', 'nigi nigi', 'niginigi'] },
    ice: { icon: '❄️', label: 'アイス', words: ['アイス', '氷', 'コオリ', '雪', 'ユキ', 'ブリザード', 'ice', 'snow'] },
    hanabi: { icon: '🎆', label: '花火', words: ['花火', 'ハナビ', 'ファイヤーワークス', 'ファイアーワークス', 'fireworks'] },
    heart: { icon: '💖', label: 'ハート', words: ['ハート', 'ラブ', '愛', 'heart', 'love'] },
    star: { icon: '⭐', label: 'スター', words: ['スター', '流れ星', 'ナガレボシ', '星', 'ホシ', 'star'] },
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
  function glowTex() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
  }
  function emojiTex(ch) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.font = '96px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 64, 70); return new T.CanvasTexture(c);
  }
  function initTex() {
    tex.glow = glowTex();
    ['🍙', '❄️', '💖', '⭐', '✨'].forEach((e) => { tex[e] = emojiTex(e); });
  }

  // ---------- 粒 ----------
  const parts = [], emitters = [];
  // o: tex, pos, vel, life, size, grow, g, color(hex または (t,color)=>void), add, op, pw, floor, onDie
  function spawn(o) {
    if (parts.length > 1100) return;
    const m = new T.SpriteMaterial({ map: tex[o.tex || 'glow'], transparent: true, depthWrite: false, depthTest: false, blending: o.add ? T.AdditiveBlending : T.NormalBlending, opacity: o.op == null ? 1 : o.op });
    if (typeof o.color === 'number') m.color.setHex(o.color);
    const s = new T.Sprite(m); s.position.copy(o.pos); s.scale.setScalar(o.size);
    scene.add(s);
    parts.push({ s, m, v: o.vel || new T.Vector3(), age: 0, o: Object.assign({ life: 1, grow: 1, g: 0, op: 1, pw: 1 }, o) });
  }
  function updateParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i], o = p.o; p.age += dt;
      const t = p.age / o.life;
      p.v.y += o.g * dt; p.s.position.addScaledVector(p.v, dt);
      let dead = t >= 1;
      if (o.floor && p.s.position.y < GROUND) { dead = true; if (o.onFloor) o.onFloor(p.s.position); }
      if (dead) { scene.remove(p.s); p.m.dispose(); parts.splice(i, 1); continue; }
      p.s.scale.setScalar(o.size * (1 + (o.grow - 1) * t));
      p.m.opacity = o.op * Math.pow(1 - t, o.pw) * Math.min(1, t / (o.fadeIn || 0.001));
      if (typeof o.color === 'function') o.color(t, p.m.color);
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

  const flashEl = () => $('flash');
  function flash(color, op, ms) {
    const f = flashEl(); f.style.transition = 'none'; f.style.background = color; f.style.opacity = op;
    requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transition = 'opacity ' + ms + 'ms ease-out'; f.style.opacity = 0; }));
  }
  const buzz = (n) => { try { navigator.vibrate && navigator.vibrate(n); } catch (e) {} };

  // ---------- 音(その場で作る) ----------
  let ac = null, nb = null;
  function initAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; ac = new AC();
      nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      if (navigator.audioSession) navigator.audioSession.type = 'play-and-record';
    } catch (e) { ac = null; }
  }
  function env(g, t0, a, d, peak) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); }
  function noise(delay, dur, type, freq, peak, q) {
    if (!ac) return; const t0 = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = nb; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    const g = ac.createGain(); env(g, t0, Math.min(0.03, dur / 3), dur, peak);
    s.connect(f); f.connect(g); g.connect(ac.destination); s.start(t0, Math.random()); s.stop(t0 + dur + 0.1);
  }
  function tone(delay, f0, f1, dur, peak, type) {
    if (!ac) return; const t0 = ac.currentTime + delay;
    const o = ac.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ac.createGain(); env(g, t0, 0.02, dur, peak); o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + 0.1);
  }
  const SND = {
    thunder() { noise(0, 0.25, 'highpass', 2500, 0.8); noise(0.05, 2.4, 'lowpass', 220, 1.0); tone(0.05, 70, 35, 1.6, 0.6); },
    fire() { for (let i = 0; i < 18; i++) noise(R(0, 3), 0.04, 'bandpass', R(900, 2500), 0.5, 2); noise(0, 3.4, 'lowpass', 500, 0.25); },
    water() { noise(0, 3.6, 'bandpass', 1400, 0.3, 0.7); for (let i = 0; i < 10; i++) tone(R(0, 3), R(500, 900), R(1200, 1800), 0.08, 0.15); },
    onigiri() { for (let i = 0; i < 10; i++) tone(i * 0.09, R(500, 700), R(900, 1300), 0.1, 0.3, 'triangle'); },
    ice() { [1319, 1568, 1976, 2349, 2637].forEach((f, i) => tone(i * 0.12, f, f * 0.99, 0.7, 0.2)); },
    hanabi() { for (let i = 0; i < 3; i++) { noise(i * 0.55, 0.5, 'lowpass', 160, 1.0); tone(i * 0.55, 90, 40, 0.5, 0.6); noise(i * 0.55 + 0.1, 1.2, 'highpass', 5000, 0.25); } },
    heart() { tone(0, 660, 700, 0.4, 0.3); tone(0.15, 880, 920, 0.5, 0.3); tone(0.3, 1320, 1350, 0.6, 0.2); },
    star() { tone(0, 2600, 500, 0.9, 0.25, 'triangle'); [0.3, 0.5, 0.7].forEach((d) => tone(d, R(2000, 3000), 1500, 0.3, 0.12)); },
  };

  // ---------- 魔法のしくみ ----------
  const MAGIC = {
    thunder() {
      const f = fwd();
      [0, 0.22].forEach((delay, k) => setTimeout(() => {
        const base = at(f, R(4, 7), R(-2.5, 2.5), GROUND), top = base.clone().add(new T.Vector3(R(-1, 1), 9, R(-1, 1)));
        const N = 26; let prev = top.clone();
        for (let i = 0; i <= N; i++) {
          const u = i / N, p = top.clone().lerp(base, u); if (i > 0 && i < N) { p.x += R(-0.45, 0.45); p.z += R(-0.45, 0.45); }
          for (let s = 0; s <= 3; s++) {   // 点と点の間を、光でつなぐ
            const q = prev.clone().lerp(p, s / 3);
            spawn({ pos: q, size: 0.9, life: 0.35, add: true, color: 0x8fb4ff, op: 0.9, pw: 1.5 });
            spawn({ pos: q.clone(), size: 0.3, life: 0.28, add: true, color: 0xffffff, op: 1, pw: 1.2 });
          }
          if (i % 6 === 3) {   // 枝わかれ
            let b = p.clone(); const dir = new T.Vector3(R(-1, 1), R(-1, -0.2), R(-1, 1)).normalize();
            for (let j = 0; j < 5; j++) { b.addScaledVector(dir, 0.5).add(new T.Vector3(R(-0.15, 0.15), 0, R(-0.15, 0.15))); spawn({ pos: b.clone(), size: 0.35, life: 0.25, add: true, color: 0xbcd0ff, op: 0.8 }); }
          }
          prev = p;
        }
        for (let i = 0; i < 40; i++) spawn({ pos: base.clone(), vel: new T.Vector3(R(-3, 3), R(1, 6), R(-3, 3)), g: -9, size: 0.16, life: R(0.5, 1), add: true, color: 0xffee88, pw: 1 });
        spawn({ pos: base.clone().setY(GROUND + 0.3), size: 3, life: 0.5, add: true, color: 0xaac4ff, op: 0.8 });
        flash('#dfe8ff', k === 0 ? 0.85 : 0.6, 350); buzz(k === 0 ? 120 : 60);
      }, delay * 1000));
      SND.thunder();
    },
    fire() {
      const f = fwd(), spots = [];
      for (let i = 0; i < 14; i++) spots.push(at(f, R(2.5, 6), R(-3.5, 3.5), GROUND));
      emit(0, 3800, (dt) => {
        spots.forEach((p) => {
          if (Math.random() > dt * 22) return;
          spawn({ pos: p.clone().add(new T.Vector3(R(-0.25, 0.25), 0, R(-0.25, 0.25))), vel: new T.Vector3(R(-0.2, 0.2), R(0.9, 1.9), R(-0.2, 0.2)), size: R(0.45, 0.8), grow: 0.25, life: R(0.8, 1.4), add: true, op: 0.45, pw: 0.7,
            color: (t, c) => c.setHSL(0.1 - 0.1 * t, 1, 0.5 - 0.15 * t) });
        });
      });
      emit(0, 3800, (dt) => { if (Math.random() < dt * 8) { const p = spots[Math.floor(Math.random() * spots.length)]; spawn({ pos: p.clone().setY(GROUND + 0.5), vel: new T.Vector3(R(-0.4, 0.4), R(1.5, 3), R(-0.4, 0.4)), size: 0.1, life: R(0.8, 1.6), add: true, color: 0xffcc66, g: 0.5 }); } });
      flash('#ff7a1a', 0.25, 600); SND.fire(); buzz(40);
    },
    water() {
      const f = fwd(), spots = [];
      for (let i = 0; i < 7; i++) spots.push(at(f, R(2, 5), R(-4, 4), GROUND));
      const splash = (p) => { for (let i = 0; i < 3; i++) spawn({ pos: p.clone().setY(GROUND + 0.02), vel: new T.Vector3(R(-0.8, 0.8), R(0.8, 1.6), R(-0.8, 0.8)), g: -9, size: 0.08, life: 0.5, color: 0xcdeaff, op: 0.8 }); };
      emit(0, 3500, (dt) => {
        spots.forEach((p) => {
          const n = Math.round(dt * 70);
          for (let i = 0; i < n; i++) spawn({ pos: p.clone(), vel: new T.Vector3(R(-0.9, 0.9), R(3.8, 6), R(-0.9, 0.9)), g: -9.8, size: R(0.1, 0.2), life: 3, floor: true, onFloor: splash, color: 0x7fc4ff, op: 0.85, pw: 0.2 });
        });
      });
      flash('#3a8bff', 0.18, 500); SND.water(); buzz(30);
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
      emit(0, 3200, (dt) => {
        const n = Math.round(dt * 70);
        for (let i = 0; i < n; i++) {
          const a = R(0, Math.PI * 2), rr = R(1, 5);
          spawn({ tex: '❄️', pos: new T.Vector3(Math.cos(a) * rr, R(1.5, 3.5), Math.sin(a) * rr), vel: new T.Vector3(R(-0.3, 0.3), R(-1.1, -0.5), R(-0.3, 0.3)), size: R(0.18, 0.4), life: R(3, 4.5), op: 1, pw: 0.3 });
        }
        if (Math.random() < dt * 20) { const a = R(0, 6.28), rr = R(1.5, 5); spawn({ pos: new T.Vector3(Math.cos(a) * rr, R(-1, 2.5), Math.sin(a) * rr), size: R(0.2, 0.5), life: 0.7, add: true, color: 0xbfe8ff, op: 0.9 }); }
      });
      flash('#aee6ff', 0.4, 700); SND.ice(); buzz(30);
    },
    hanabi() {
      const f = fwd();
      [0, 450, 950].forEach((delay) => setTimeout(() => {
        const c = at(f, R(8, 12), R(-5, 5), R(2.5, 6)), hue = Math.random();
        const hh = (hue + 0.5) % 1;
        for (let i = 0; i < 110; i++) {
          const d = new T.Vector3(R(-1, 1), R(-1, 1), R(-1, 1)).normalize().multiplyScalar(R(2, 4));
          spawn({ pos: c.clone(), vel: d, g: -1.8, size: R(0.35, 0.55), life: R(1.4, 2.0), add: true, pw: 0.8,
            color: (t, col) => col.setHSL(i % 3 === 0 ? hh : hue, 1, 0.7 - 0.2 * t) });
        }
        spawn({ pos: c.clone(), size: 5, life: 0.35, add: true, color: 0xffffff, op: 0.7 });
        flash('#ffffff', 0.12, 300); buzz(50);
      }, delay));
      SND.hanabi();
    },
    heart() {
      const f = fwd();
      emit(0, 1800, (dt) => {
        const n = Math.max(1, Math.round(dt * 14));
        for (let i = 0; i < n; i++) spawn({ tex: '💖', pos: at(f, R(1.5, 4), R(-2.5, 2.5), R(-1.2, 0)), vel: new T.Vector3(R(-0.3, 0.3), R(0.6, 1.3), R(-0.3, 0.3)), size: R(0.3, 0.65), grow: 1.3, life: R(2.5, 3.5), pw: 0.4 });
        if (Math.random() < dt * 20) spawn({ pos: at(f, R(1.5, 4), R(-2.5, 2.5), R(-1, 1)), size: 0.3, life: 0.6, add: true, color: 0xff9ad0, op: 0.8 });
      });
      flash('#ff9ad0', 0.2, 600); SND.heart(); buzz(30);
    },
    star() {
      const f = fwd();
      for (let k = 0; k < 6; k++) setTimeout(() => {
        const start = at(f, R(6, 10), R(-2, 7), R(3, 6)), v = new T.Vector3(0, 0, 0).addScaledVector(rgt(f), -R(5, 8)).setY(-R(2, 3.5)).addScaledVector(f, R(-1, 1));
        spawn({ tex: '⭐', pos: start, vel: v, size: 0.55, life: 1.3, pw: 0.5 });
        emit(0, 1250, (dt) => {   // しっぽ
          const p = start.clone().addScaledVector(v, (performance.now() - tr0) / 1000);
          for (let i = 0; i < 2; i++) spawn({ pos: p.clone().add(new T.Vector3(R(-0.1, 0.1), R(-0.1, 0.1), R(-0.1, 0.1))), size: R(0.25, 0.5), life: 0.6, add: true, color: 0xfff1a8, op: 0.8, grow: 0.3 });
        });
        const tr0 = performance.now();
      }, k * 220);
      SND.star(); buzz(30);
    },
  };

  const lastCast = {};
  function cast(name, source) {
    const now = performance.now();
    if (!MAGIC[name] || now - (lastCast[name] || 0) < 500) return;
    lastCast[name] = now;
    if (ac && ac.state === 'suspended') ac.resume();
    try { MAGIC[name](); } catch (e) { $('diag').textContent = '魔法のエラー: ' + (e && e.message); }
    log('cast ' + name + (source ? ' (' + source + ')' : ''));
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
      meterTick(); look(); updateEmitters(dt); updateParts(dt); renderer.render(scene, camera);
      if (Math.floor(t / 500) !== loop.k) { loop.k = Math.floor(t / 500); $('diag').textContent = '粒 ' + parts.length + (ori.n ? ' 向き○' : ' 向き×') + (castLog.length ? '\n' + castLog.join(' / ') : '') + '\n版 ' + VER; }
    } catch (e) { $('diag').textContent = 'エラー: ' + (e && e.message); }
  }

  function buildBar() {
    const bar = $('bar');
    Object.keys(SPELLS).forEach((k) => {
      const b = document.createElement('button'); b.type = 'button';
      b.innerHTML = '<span>' + SPELLS[k].icon + '</span>' + SPELLS[k].label;
      b.addEventListener('click', () => cast(k, 'ボタン'));
      bar.appendChild(b);
    });
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
      initGL(); initTex(); initLook(); buildBar();
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
  $('ver').textContent = '版 ' + VER;
  document.addEventListener('visibilitychange', () => { if (!document.hidden && wantRec && rec) { try { rec.start(); } catch (e) {} } });
  window.__mahou = { cast, countSpells, meter: () => ({ on: !!mAn, lvl: mLvl, peak: mPeak }), heard: (t) => heard([[{ transcript: t }]], 0) };
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
