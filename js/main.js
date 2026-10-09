// Game entry point: wires renderer, input, HUD, menu and level loading.
import { Renderer } from './gl.js';
import { createAssets } from './scene.js';
import { OrbitCamera, CAMERA_PRESETS } from './camera.js';
import { Game } from './game.js';
import { parseLevel, BONUS_TYPES } from './level.js';
import { BONUS_STYLE } from './textures.js';
import { Sfx } from './audio.js';
import { t, localized, applyI18n, mountLangSwitch, onLangChange } from './i18n.js';

const $ = (id) => document.getElementById(id);
const canvas = $('view');
mountLangSwitch();
applyI18n();

const storage = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

let renderer;
try {
  renderer = new Renderer(canvas);
} catch (e) {
  $('fatal').hidden = false;
  $('fatal').textContent = t('err.webgl', { msg: e.message });
  throw e;
}

const assets = createAssets(renderer);
const camera = new OrbitCamera();
const sfx = new Sfx();
const game = new Game({ assets, sfx, onEvent });
let levels = [];
let mode = 'menu'; // menu | game | paused
let hiScore = Number(storage.get('rknoid.hiscore', 0)) || 0;
let currentLevelKey = null;
let loadError = null;

// Small built-in level so the menu has something to show when levels/ can't be fetched.
const FALLBACK_LEVEL = {
  name: 'Fallback', cols: 11, rows: 4,
  layers: [['rrooyyggccb', 'r.o.y.g.c.b', '?.........?', 'HHHHHHHHHHH'], ['..r.....b..', '...........', '...........', '...........']],
};

// ------------------------------------------------------------------ levels
async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

function parseOrReport(json, label) {
  const { level, errors, warnings } = parseLevel(json);
  if (warnings.length) console.warn(`[${label}]`, warnings.join('\n'));
  if (!level || errors.length) throw new Error(`${label}: ${errors.join('; ')}`);
  return level;
}

async function loadLevelSet() {
  try {
    const index = await fetchJson('levels/index.json');
    const raws = await Promise.all(index.levels.map((f) => fetchJson(`levels/${f}`)));
    levels = raws.map((j, i) => parseOrReport(j, index.levels[i]));
    loadError = null;
  } catch (e) {
    console.error(e);
    levels = [parseOrReport(FALLBACK_LEVEL, 'fallback')];
    loadError = e.message;
  }
  renderLoadNotice();
  buildLevelButtons();
}

function renderLoadNotice() {
  $('loadNotice').hidden = !loadError;
  if (loadError) $('loadNotice').innerHTML = t('menu.loadNotice', { msg: escapeHtml(loadError) });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function buildLevelButtons() {
  const box = $('levelList');
  box.innerHTML = '';
  levels.forEach((L, i) => {
    const b = document.createElement('button');
    b.className = 'level-btn';
    b.innerHTML = `<span class="num">${i + 1}</span><span class="name">${escapeHtml(localized(L, 'name'))}</span><span class="desc">${escapeHtml(localized(L, 'description'))}</span>`;
    b.onclick = () => startGame(levels, i);
    b.onmouseenter = () => showPreview(L);
    box.appendChild(b);
  });
}

// ------------------------------------------------------------------ game flow
function frameLevel(L, instant) {
  const size = Math.max(L.width, L.depth);
  camera.frame([0, 0, L.depth / 2 + 0.3], size * 1.32);
  renderer.setLightFrame([0, 0, L.depth / 2], size * 0.8);
  camera.applyPreset(camera.presetIndex, instant);
}

// Attract mode: the menu background is the real game, played by the autopilot, muted.
function showPreview(L) {
  if (currentLevelKey === L) return;
  currentLevelKey = L;
  sfx.suppressed = true;
  game.start([L], 0, { testMode: true });
  frameLevel(L, false);
}

function startGame(set, index, opts = {}) {
  sfx.unlock();
  sfx.suppressed = false;
  mode = 'game';
  $('menu').hidden = true;
  $('hud').hidden = false;
  game.start(set, index, opts);
  frameLevel(set[index], false);
  updateHud(true);
}

function backToMenu() {
  saveHiScore();
  mode = 'menu';
  $('menu').hidden = false;
  $('hud').hidden = true;
  $('pause').hidden = true;
  $('message').hidden = true;
  currentLevelKey = null;
  if (levels.length) showPreview(levels[0]);
  $('hiscoreMenu').textContent = String(hiScore).padStart(6, '0');
}

function saveHiScore() {
  if (game.score > hiScore) {
    hiScore = game.score;
    storage.set('rknoid.hiscore', String(hiScore));
  }
}

function setPaused(p) {
  if (mode === 'menu') return;
  mode = p ? 'paused' : 'game';
  $('pause').hidden = !p;
}

function onEvent(type, data) {
  if (mode === 'menu') return;
  switch (type) {
    case 'level': if (mode !== 'menu') frameLevel(data.level, false); break;
    case 'bonus': toast(t(`bonus.${data.type}`), BONUS_STYLE[data.type][0]); break;
    case 'critter': toast(t('toast.critter'), '#8fdc5a'); break;
    case 'shake': camera.shake = Math.max(camera.shake, data); break;
    case 'over': case 'won': saveHiScore(); break;
    default: break;
  }
}

// ------------------------------------------------------------------ input
const input = { targetX: null, axis: 0, firePressed: false, fireHeld: false };
const keys = new Set();
const pointer = { nx: 0, ny: 0, active: false, dragging: false, lx: 0, ly: 0 };

function toNdc(e) {
  const r = canvas.getBoundingClientRect();
  pointer.nx = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
}

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  sfx.unlock();
  toNdc(e);
  if (e.button === 2 || e.button === 1 || (e.button === 0 && e.shiftKey)) {
    pointer.dragging = true;
    pointer.lx = e.clientX; pointer.ly = e.clientY;
    return;
  }
  if (e.button === 0) {
    pointer.active = true;
    if (mode === 'game' && (game.state === 'over' || game.state === 'won')) { backToMenu(); return; }
    if (mode === 'paused') { setPaused(false); return; }
    input.firePressed = true;
    input.fireHeld = true;
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (pointer.dragging) {
    camera.orbit(e.clientX - pointer.lx, e.clientY - pointer.ly);
    pointer.lx = e.clientX; pointer.ly = e.clientY;
    return;
  }
  toNdc(e);
  pointer.active = true;
});
canvas.addEventListener('pointerup', (e) => {
  if (pointer.dragging) pointer.dragging = false;
  if (e.button === 0) input.fireHeld = false;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  camera.zoom(Math.sign(e.deltaY));
}, { passive: false });

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  keys.add(e.code);
  switch (e.code) {
    case 'Space':
      e.preventDefault();
      if (!e.repeat) {
        if (mode === 'game' && (game.state === 'over' || game.state === 'won')) backToMenu();
        else { input.firePressed = true; input.fireHeld = true; }
      }
      break;
    case 'Escape': case 'KeyP': setPaused(mode === 'game'); break;
    case 'KeyV': toast(t('toast.camera', { name: t(`cam.${camera.applyPreset(camera.presetIndex + 1).id}`) }), '#9fd8ff'); break;
    case 'KeyO': camera.ortho = !camera.ortho; toast(t(camera.ortho ? 'toast.ortho' : 'toast.persp'), '#9fd8ff'); break;
    case 'KeyR': camera.applyPreset(camera.presetIndex); break;
    case 'KeyM': toast(t(sfx.toggleMute() ? 'toast.soundOff' : 'toast.soundOn'), '#ddd'); break;
    case 'KeyH': $('helpBar').classList.toggle('hidden'); break;
    default: break;
  }
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'Space') input.fireHeld = false;
});
window.addEventListener('blur', () => { keys.clear(); if (mode === 'game') setPaused(true); });

function readInput() {
  const right = keys.has('ArrowRight') || keys.has('KeyD');
  const left = keys.has('ArrowLeft') || keys.has('KeyA');
  const dir = Math.cos(camera.yaw) >= 0 ? 1 : -1;
  input.axis = ((right ? 1 : 0) - (left ? 1 : 0)) * dir;
  if (input.axis) pointer.active = false;
  input.targetX = null;
  if (pointer.active && !pointer.dragging) {
    const hit = camera.pickPlane(pointer.nx, pointer.ny, 0.2);
    if (hit) input.targetX = hit[0];
  }
}

// ------------------------------------------------------------------ HUD
const hudCache = {};
function setText(id, v) {
  if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; }
}

function updateHud(force = false) {
  if (force) for (const k of Object.keys(hudCache)) delete hudCache[k];
  setText('score', String(game.score).padStart(6, '0'));
  setText('hiscore', String(Math.max(hiScore, game.score)).padStart(6, '0'));
  setText('lives', '●'.repeat(Math.max(0, Math.min(game.lives, 9))) + (game.lives > 9 ? '+' : ''));
  if (game.level) setText('levelName', `${game.levelIndex + 1}. ${localized(game.level, 'name')}`);
  setText('camName', t(`cam.${CAMERA_PRESETS[camera.presetIndex].id}`) + (camera.ortho ? '' : t('cam.persp')));

  // active bonus timers
  const chips = [];
  if (game.effects) {
    for (const [k, v] of Object.entries(game.effects)) {
      if (v > 0) chips.push(`<div class="chip" style="--c:${BONUS_STYLE[k][0]}"><b>${BONUS_STYLE[k][1]}</b>${t(`bonus.${k}`)}<i style="width:${(v / BONUS_TYPES[k].duration) * 100}%"></i></div>`);
    }
  }
  const html = chips.join('');
  if (hudCache.chips !== html) { hudCache.chips = html; $('effects').innerHTML = html; }

  const msg = mode === 'game' ? game.getMessage() : null;
  const msgKey = msg ? `${msg.title}|${msg.sub}|${msg.hint}` : '';
  if (hudCache.msg !== msgKey) {
    hudCache.msg = msgKey;
    $('message').hidden = !msg;
    if (msg) {
      $('msgTitle').textContent = msg.title || '';
      $('msgSub').textContent = msg.sub || '';
      $('msgHint').textContent = msg.hint || '';
    }
  }
}

let toastTimer = 0;
function toast(text, color) {
  const t = $('toast');
  t.textContent = text;
  t.style.setProperty('--c', color || '#fff');
  t.classList.remove('show');
  void t.offsetWidth; // restart animation
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1400);
}

// ------------------------------------------------------------------ menu buttons
$('playBtn').onclick = () => startGame(levels, 0);
$('resumeBtn').onclick = () => setPaused(false);
$('quitBtn').onclick = () => backToMenu();
$('fileBtn').onclick = () => $('fileInput').click();
$('fileInput').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const L = parseOrReport(JSON.parse(await f.text()), f.name);
    startGame([L], 0, { testMode: true });
  } catch (err) {
    alert(t('err.loadLevel', { msg: err.message }));
  }
  e.target.value = '';
};

onLangChange(() => {
  renderLoadNotice();
  buildLevelButtons();
  updateHud(true);
});

// ------------------------------------------------------------------ main loop
let last = performance.now();
let attractTimer = 0;
const demo = new URLSearchParams(location.search).has('demo');
let fpsAcc = 0, fpsFrames = 0;
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  const aspect = renderer.resize();

  if (mode === 'game') {
    readInput();
    game.update(dt, demo ? game.autopilot() : input);
  } else if (mode === 'menu') {
    game.update(dt, game.autopilot());
    camera.goal.yaw += dt * 0.08;
    if (game.state === 'over' || game.state === 'won') {
      attractTimer += dt;
      if (attractTimer > 3) { attractTimer = 0; currentLevelKey = null; showPreview(game.level); }
    }
  }
  input.firePressed = false;

  camera.update(dt, aspect);
  const ed = Math.hypot(camera.eye[0] - camera.target[0], camera.eye[1] - camera.target[1], camera.eye[2] - camera.target[2]);
  renderer.fog = [ed + camera.baseDist * 0.15, ed + camera.baseDist * 1.4];
  const list = [];
  game.draw(list);
  renderer.render(list, camera);
  if (mode !== 'menu') updateHud();

  fpsAcc += dt; fpsFrames++;
  if (fpsAcc > 1) { $('fps').textContent = `${Math.round(fpsFrames / fpsAcc)} fps`; fpsAcc = 0; fpsFrames = 0; }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ boot
(async function boot() {
  const params = new URLSearchParams(location.search);
  if (params.has('cam')) camera.presetIndex = Number(params.get('cam')) || 0;
  await loadLevelSet();
  $('hiscoreMenu').textContent = String(hiScore).padStart(6, '0');
  if (params.get('test')) {
    // launched from the level editor
    try {
      const L = parseOrReport(JSON.parse(storage.get('rknoid.testLevel', 'null')), 'editor test level');
      startGame([L], 0, { testMode: true });
    } catch (e) {
      alert(e.message);
      backToMenu();
    }
  } else if (params.get('level')) {
    const n = Math.max(1, Number(params.get('level')) || 1) - 1;
    startGame(levels, Math.min(n, levels.length - 1));
  } else {
    backToMenu();
    frameLevel(levels[0], true);
  }
  if (params.has('warp') && mode === 'game') {
    // dev aid: fast-forward N seconds of autopilot play (for screenshots / tests)
    const secs = Number(params.get('warp')) || 10;
    for (let t = 0; t < secs && game.state === 'play'; t += 1 / 60) game.update(1 / 60, game.autopilot());
  }
  window.rknoid = { game, camera, renderer }; // handy for debugging in the console
  requestAnimationFrame(frame);
})();
