// rk/noid level editor: paint bricks on a 2D grid (per layer or as stacks),
// edit the legend and settings, preview in 3D, export JSON, test-play.
import { Renderer } from './gl.js';
import { createAssets, drawField, drawBrick, item } from './scene.js';
import { OrbitCamera } from './camera.js';
import {
  parseLevel, blankLevel, DEFAULT_LEGEND, DEFAULT_SETTINGS, BONUS_TYPES, EMPTY_CHARS, FORMAT, BRICK_H,
} from './level.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

// ------------------------------------------------------------------ document state
let doc = loadAutosave() || starterLevel();
const ui = { mode: 'stack', tool: 'paint', layer: 0, brush: 'r', hover: null, rect: null };
const undoStack = [], redoStack = [];

function starterLevel() {
  const d = blankLevel(13, 8);
  d.layers[0][1] = 'rrrrrrrrrrrrr';
  d.layers[0][2] = 'yyyyy?y?yyyyy';
  d.layers[0][3] = 'ggggg@ggggggg';
  return d;
}

function loadAutosave() {
  try { return sanitize(JSON.parse(store.get('rknoid.editorDoc'))); } catch { return null; }
}

function sanitize(j) {
  if (!j || typeof j !== 'object') throw new Error('Not a JSON object');
  const cols = Math.min(31, Math.max(3, j.cols | 0 || 13));
  const rows = Math.min(30, Math.max(1, j.rows | 0 || 8));
  let layers = Array.isArray(j.layers) && j.layers.length ? j.layers : [[]];
  layers = layers.map((L) => Array.from({ length: rows }, (_, r) => fitRow(Array.isArray(L) ? L[r] : '', cols)));
  return {
    format: FORMAT,
    name: String(j.name ?? 'Untitled'),
    author: String(j.author ?? ''),
    description: String(j.description ?? ''),
    cols, rows,
    settings: j.settings && typeof j.settings === 'object' ? { ...j.settings } : {},
    legend: j.legend && typeof j.legend === 'object' ? JSON.parse(JSON.stringify(j.legend)) : {},
    layers,
  };
}

function fitRow(s, cols) {
  s = String(s ?? '').replace(/[ _]/g, '.');
  return s.length >= cols ? s.slice(0, cols) : s + '.'.repeat(cols - s.length);
}

const legend = () => ({ ...DEFAULT_LEGEND, ...doc.legend });

function snapshot() {
  undoStack.push(JSON.stringify(doc));
  if (undoStack.length > 300) undoStack.shift();
  redoStack.length = 0;
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(doc));
  doc = JSON.parse(undoStack.pop());
  changed(true);
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(doc));
  doc = JSON.parse(redoStack.pop());
  changed(true);
}

let saveTimer = 0;
function changed(forms = false) {
  ui.layer = Math.min(ui.layer, doc.layers.length - 1);
  if (!legend()[ui.brush]) ui.brush = 'r';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store.set('rknoid.editorDoc', JSON.stringify(doc)), 300);
  if (forms) fillForms();
  buildLayerTabs();
  buildPalette();
  fillEntryEditor();
  drawGrid();
  validate();
  rebuildPreview();
  if (document.activeElement !== $('jsonArea')) $('jsonArea').value = exportJson();
  $('undoBtn').disabled = !undoStack.length;
  $('redoBtn').disabled = !redoStack.length;
}

// ------------------------------------------------------------------ cell helpers
const getCell = (l, r, c) => doc.layers[l]?.[r]?.[c] ?? '.';
const isEmpty = (ch) => EMPTY_CHARS.has(ch);

function setCell(l, r, c, ch) {
  const row = doc.layers[l][r];
  doc.layers[l][r] = row.slice(0, c) + ch + row.slice(c + 1);
}

function emptyLayer() {
  return Array.from({ length: doc.rows }, () => '.'.repeat(doc.cols));
}

function stack(r, c) {
  const out = [];
  for (let l = 0; l < doc.layers.length; l++) { const ch = getCell(l, r, c); if (!isEmpty(ch)) out.push(ch); }
  return out;
}

function pushBrick(r, c, ch) {
  let l = 0;
  while (l < doc.layers.length && !isEmpty(getCell(l, r, c))) l++;
  if (l >= doc.layers.length) {
    if (doc.layers.length >= 12) return;
    doc.layers.push(emptyLayer());
  }
  setCell(l, r, c, ch);
}

function popBrick(r, c) {
  for (let l = doc.layers.length - 1; l >= 0; l--) {
    if (!isEmpty(getCell(l, r, c))) { setCell(l, r, c, '.'); break; }
  }
  trimLayers();
}

function trimLayers() {
  while (doc.layers.length > 1 && doc.layers[doc.layers.length - 1].every((row) => /^[._ ]*$/.test(row))) doc.layers.pop();
}

function resize(cols, rows) {
  cols = Math.min(31, Math.max(3, cols | 0));
  rows = Math.min(30, Math.max(1, rows | 0));
  doc.layers = doc.layers.map((L) => Array.from({ length: rows }, (_, r) => fitRow(L[r] || '', cols)));
  doc.cols = cols;
  doc.rows = rows;
}

// ------------------------------------------------------------------ export
function exportObject() {
  const layers = doc.layers.map((L) => L.slice());
  while (layers.length > 1 && layers[layers.length - 1].every((row) => /^[._ ]*$/.test(row))) layers.pop();
  return {
    format: FORMAT,
    name: doc.name,
    author: doc.author,
    description: doc.description,
    cols: doc.cols,
    rows: doc.rows,
    settings: doc.settings,
    legend: doc.legend,
    layers,
  };
}

function exportJson() {
  // keep each legend entry on one line for readability
  let s = JSON.stringify(exportObject(), null, 2);
  s = s.replace(/\{\n\s+("type"[^}]*?)\n\s+\}/g, (m, body) => '{ ' + body.replace(/\n\s+/g, ' ') + ' }');
  return s;
}

function slug(s) {
  return (s || 'level').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'level';
}

// ------------------------------------------------------------------ forms
const SETTINGS_FIELDS = ['ballSpeed', 'ballSpeedMax', 'bonusChance', 'critterSpeed', 'depth', 'backGap', 'floorColor', 'wallColor', 'critterMode'];

function fillForms() {
  $('f_name').value = doc.name;
  $('f_author').value = doc.author;
  $('f_description').value = doc.description;
  $('f_cols').value = doc.cols;
  $('f_rows').value = doc.rows;
  for (const k of SETTINGS_FIELDS) {
    const el = $('s_' + k);
    el.value = doc.settings[k] ?? DEFAULT_SETTINGS[k];
  }
}

function bindForms() {
  for (const k of ['name', 'author', 'description']) {
    $('f_' + k).addEventListener('change', (e) => { snapshot(); doc[k] = e.target.value; changed(); });
  }
  for (const k of ['cols', 'rows']) {
    $('f_' + k).addEventListener('change', () => {
      snapshot();
      resize(+$('f_cols').value, +$('f_rows').value);
      changed(true);
    });
  }
  for (const k of SETTINGS_FIELDS) {
    $('s_' + k).addEventListener('change', (e) => {
      snapshot();
      const el = e.target;
      let v = el.type === 'number' ? parseFloat(el.value) : el.value;
      if (el.type === 'number' && Number.isNaN(v)) v = undefined;
      if (v === undefined || v === DEFAULT_SETTINGS[k]) delete doc.settings[k];
      else doc.settings[k] = v;
      changed(true);
    });
  }
}

// ------------------------------------------------------------------ layers & tools
function buildLayerTabs() {
  const seg = $('layerSeg');
  seg.innerHTML = '';
  doc.layers.forEach((_, i) => {
    const b = document.createElement('button');
    b.textContent = i === 0 ? 'L0 ground' : `L${i}`;
    b.className = ui.layer === i ? 'on' : '';
    b.disabled = ui.mode !== 'layer';
    b.onclick = () => { ui.layer = i; changed(); };
    seg.appendChild(b);
  });
  $('addLayerBtn').disabled = ui.mode !== 'layer';
  $('delLayerBtn').disabled = ui.mode !== 'layer' || doc.layers.length < 2;
}

function bindTools() {
  for (const b of $('modeSeg').children) {
    b.onclick = () => {
      ui.mode = b.dataset.mode;
      for (const x of $('modeSeg').children) x.classList.toggle('on', x === b);
      changed();
    };
  }
  for (const b of $('toolSeg').children) {
    b.onclick = () => setTool(b.dataset.tool);
  }
  $('addLayerBtn').onclick = () => {
    snapshot();
    doc.layers.splice(ui.layer + 1, 0, emptyLayer());
    ui.layer++;
    changed();
  };
  $('delLayerBtn').onclick = () => {
    if (doc.layers.length < 2) return;
    snapshot();
    doc.layers.splice(ui.layer, 1);
    changed();
  };
  $('mirrorBtn').onclick = () => {
    snapshot();
    for (const L of doc.layers) {
      for (let r = 0; r < doc.rows; r++) {
        const row = L[r].split('');
        for (let c = 0; c < Math.floor(doc.cols / 2); c++) row[doc.cols - 1 - c] = row[c];
        L[r] = row.join('');
      }
    }
    changed();
  };
  $('clearBtn').onclick = () => {
    if (!confirm('Remove all bricks?')) return;
    snapshot();
    doc.layers = [emptyLayer()];
    changed();
  };
}

function setTool(t) {
  ui.tool = t;
  for (const x of $('toolSeg').children) x.classList.toggle('on', x.dataset.tool === t);
}

// ------------------------------------------------------------------ palette & legend entry editor
function buildPalette() {
  const box = $('palette');
  box.innerHTML = '';
  const L = legend();
  for (const [key, e] of Object.entries(L)) {
    const b = document.createElement('button');
    b.className = `pal ${e.type} ${key === ui.brush ? 'on' : ''}`;
    b.style.setProperty('--c', e.color || '#fff');
    const extra = e.critter ? 'oo' : e.drop ? (e.drop === 'random' ? '?' : '+') : '';
    b.innerHTML = `${escapeHtml(key)}${extra ? ' ' + extra : ''}<small>${TYPE_ABBR[e.type] || ''}</small>`;
    b.title = describe(key, e);
    b.onclick = () => { ui.brush = key; if (ui.tool === 'erase' || ui.tool === 'pick') setTool('paint'); changed(); };
    box.appendChild(b);
  }
}

const TYPE_ABBR = { normal: '', hard: 'hard', steel: 'steel', armored: 'armor', explosive: 'boom' };

function describe(key, e) {
  const parts = [`"${key}" ${e.type}`];
  if (e.hits) parts.push(`${e.hits} hits`);
  if (e.drop) parts.push(`drops ${e.drop}`);
  if (e.critter) parts.push('releases a critter');
  if (doc.legend[key]) parts.push(DEFAULT_LEGEND[key] ? '(overridden)' : '(custom)');
  return parts.join(', ');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function fillEntryEditor() {
  const key = ui.brush, e = legend()[key];
  if (!e) return;
  $('entryKey').textContent = key;
  $('e_key').value = key;
  $('e_type').value = e.type;
  $('e_color').value = normalizeHex(e.color);
  $('e_hits').value = e.hits || (e.type === 'hard' ? 2 : 1);
  $('e_hits').disabled = e.type === 'steel';
  $('e_drop').value = e.drop || '';
  $('e_tex').value = e.tex || '';
  $('e_critter').checked = !!e.critter;
  $('delEntryBtn').textContent = DEFAULT_LEGEND[key] ? 'Reset to default' : 'Delete type';
  $('delEntryBtn').disabled = DEFAULT_LEGEND[key] && !doc.legend[key];
}

function normalizeHex(c) {
  let h = String(c || '#ffffff').trim();
  if (/^#[0-9a-f]{3}$/i.test(h)) h = '#' + h.slice(1).split('').map((x) => x + x).join('');
  return /^#[0-9a-f]{6}$/i.test(h) ? h : '#ffffff';
}

function updateEntry(patch) {
  snapshot();
  const key = ui.brush;
  const next = { ...legend()[key], ...patch };
  for (const k of Object.keys(next)) if (next[k] === '' || next[k] === false || next[k] == null) delete next[k];
  if (next.type === 'steel') delete next.hits;
  if (DEFAULT_LEGEND[key] && JSON.stringify(next) === JSON.stringify(DEFAULT_LEGEND[key])) delete doc.legend[key];
  else doc.legend[key] = next;
  changed();
}

function bindEntryEditor() {
  const drop = $('e_drop');
  drop.innerHTML = '<option value="">none</option><option value="random">random bonus</option>' +
    Object.entries(BONUS_TYPES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  $('e_type').onchange = (e) => updateEntry({ type: e.target.value });
  $('e_color').onchange = (e) => updateEntry({ color: e.target.value });
  $('e_hits').onchange = (e) => updateEntry({ hits: Math.max(1, Math.min(9, e.target.value | 0)) });
  $('e_drop').onchange = (e) => updateEntry({ drop: e.target.value });
  $('e_tex').onchange = (e) => updateEntry({ tex: e.target.value });
  $('e_critter').onchange = (e) => updateEntry({ critter: e.target.checked });
  $('e_key').onchange = (e) => {
    const nk = e.target.value;
    const old = ui.brush;
    if (nk === old) return;
    if (nk.length !== 1 || isEmpty(nk) || nk === '"' || nk === '\\') { toast('Pick a single character other than . _ space " \\'); fillEntryEditor(); return; }
    if (legend()[nk]) { toast(`"${nk}" is already used`); fillEntryEditor(); return; }
    snapshot();
    doc.legend[nk] = { ...legend()[old] };
    if (!DEFAULT_LEGEND[old]) delete doc.legend[old];
    doc.layers = doc.layers.map((L) => L.map((row) => row.split(old).join(nk)));
    ui.brush = nk;
    changed();
  };
  $('newEntryBtn').onclick = () => {
    const pool = 'abdefhijklnqstuvxzBCDEFGIJMNOPRSTUVWYZ0123456789!$%&*+=<>';
    const L = legend();
    const ch = [...pool].find((x) => !L[x]);
    if (!ch) { toast('No free characters left'); return; }
    snapshot();
    const hue = Math.floor(Math.random() * 360);
    doc.legend[ch] = { type: 'normal', color: hslHex(hue, 70, 58) };
    ui.brush = ch;
    changed();
  };
  $('delEntryBtn').onclick = () => {
    const key = ui.brush;
    snapshot();
    if (DEFAULT_LEGEND[key]) { delete doc.legend[key]; toast(`"${key}" reset to default`); changed(); return; }
    const used = doc.layers.some((L) => L.some((row) => row.includes(key)));
    if (used && !confirm(`"${key}" is used in the level. Delete it and remove those bricks?`)) { undoStack.pop(); return; }
    doc.layers = doc.layers.map((L) => L.map((row) => row.split(key).join('.')));
    delete doc.legend[key];
    ui.brush = 'r';
    changed();
  };
}

function hslHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return '#' + [f(0), f(8), f(4)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// ------------------------------------------------------------------ grid canvas
const grid = $('grid');
let geo = null;

function drawGrid() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = grid.clientWidth, H = grid.clientHeight;
  if (!W || !H) return;
  grid.width = W * dpr; grid.height = H * dpr;
  const ctx = grid.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const pad = 12;
  const cw = Math.min((W - pad * 2) / doc.cols, (2 * (H - pad * 2)) / doc.rows);
  const ch = cw / 2;
  const ox = (W - cw * doc.cols) / 2, oy = (H - ch * doc.rows) / 2;
  geo = { cw, ch, ox, oy };
  const L = legend();

  // floor
  for (let r = 0; r < doc.rows; r++) {
    for (let c = 0; c < doc.cols; c++) {
      ctx.fillStyle = (r + c) % 2 ? '#2b2650' : '#24203f';
      ctx.fillRect(ox + c * cw, oy + r * ch, cw, ch);
    }
  }
  // back wall
  ctx.fillStyle = '#ff4fa3';
  ctx.fillRect(ox - 4, oy - 6, cw * doc.cols + 8, 3);

  for (let r = 0; r < doc.rows; r++) {
    for (let c = 0; c < doc.cols; c++) {
      const x = ox + c * cw, y = oy + r * ch;
      if (ui.mode === 'stack') {
        const st = stack(r, c);
        if (!st.length) continue;
        drawCell(ctx, x, y, cw, ch, st[st.length - 1], L[st[st.length - 1]], 1);
        if (st.length > 1) badge(ctx, x + cw - 2, y + 2, String(st.length));
      } else {
        let ghost = null;
        for (let l = ui.layer - 1; l >= 0 && !ghost; l--) { const k = getCell(l, r, c); if (!isEmpty(k)) ghost = k; }
        const k = getCell(ui.layer, r, c);
        if (!isEmpty(k)) drawCell(ctx, x, y, cw, ch, k, L[k], 1);
        else if (ghost) drawCell(ctx, x, y, cw, ch, ghost, L[ghost], 0.22);
        if (ui.layer + 1 < doc.layers.length && !isEmpty(getCell(ui.layer + 1, r, c))) {
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.fillRect(x + cw - 7, y + 3, 4, 4); // something sits above
        }
      }
    }
  }
  // grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= doc.cols; c++) { ctx.moveTo(ox + c * cw + 0.5, oy); ctx.lineTo(ox + c * cw + 0.5, oy + ch * doc.rows); }
  for (let r = 0; r <= doc.rows; r++) { ctx.moveTo(ox, oy + r * ch + 0.5); ctx.lineTo(ox + cw * doc.cols, oy + r * ch + 0.5); }
  ctx.stroke();
  // centre line helps symmetric designs
  ctx.strokeStyle = 'rgba(70,200,255,0.25)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(ox + (cw * doc.cols) / 2, oy); ctx.lineTo(ox + (cw * doc.cols) / 2, oy + ch * doc.rows); ctx.stroke();
  ctx.setLineDash([]);

  if (ui.rect) {
    const { r0, c0, r1, c1 } = normRect(ui.rect);
    ctx.strokeStyle = ui.rect.erase ? '#ff6a5a' : '#46c8ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox + c0 * cw + 1, oy + r0 * ch + 1, (c1 - c0 + 1) * cw - 2, (r1 - r0 + 1) * ch - 2);
  } else if (ui.hover) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox + ui.hover.c * cw + 1, oy + ui.hover.r * ch + 1, cw - 2, ch - 2);
  }
}

function drawCell(ctx, x, y, w, h, key, e, alpha) {
  if (!e) {
    ctx.fillStyle = '#f0f';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    return;
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = 1.5;
  if (e.type === 'steel') {
    const gr = ctx.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, '#d8dee8'); gr.addColorStop(1, '#6c7480');
    ctx.fillStyle = gr;
  } else if (e.type === 'armored') {
    ctx.fillStyle = '#f2c400';
  } else ctx.fillStyle = e.color || '#fff';
  ctx.fillRect(x + g, y + g, w - g * 2, h - g * 2);
  if (e.type === 'armored') {
    ctx.save();
    ctx.beginPath(); ctx.rect(x + g, y + g, w - g * 2, h - g * 2); ctx.clip();
    ctx.fillStyle = '#151515';
    for (let s = -h; s < w + h; s += 10) { ctx.beginPath(); ctx.moveTo(x + s, y); ctx.lineTo(x + s + 5, y); ctx.lineTo(x + s + 5 - h, y + h); ctx.lineTo(x + s - h, y + h); ctx.fill(); }
    ctx.restore();
  }
  // bevel
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x + g, y + g, w - g * 2, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x + g, y + h - g - 2, w - g * 2, 2);
  // symbol
  let sym = '';
  if (e.critter) sym = '👀';
  else if (e.type === 'explosive') sym = '!';
  else if (e.drop === 'random') sym = '?';
  else if (e.drop) sym = (BONUS_TYPES[e.drop] ? e.drop[0].toUpperCase() : '+');
  else if (e.type === 'hard') sym = String(e.hits || 2);
  ctx.font = `bold ${Math.max(9, h * 0.6)}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (sym) {
    ctx.fillStyle = e.type === 'armored' ? '#fff' : '#000';
    ctx.fillText(sym, x + w / 2, y + h / 2 + 1);
  } else if (w > 26) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.font = `${Math.max(8, h * 0.45)}px "Courier New", monospace`;
    ctx.fillText(key, x + w / 2, y + h / 2 + 1);
  }
  ctx.restore();
}

function badge(ctx, x, y, text) {
  ctx.font = 'bold 10px sans-serif';
  const w = ctx.measureText(text).width + 6;
  ctx.fillStyle = 'rgba(10,8,30,0.85)';
  ctx.fillRect(x - w, y, w, 12);
  ctx.fillStyle = '#9ff0ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x - w / 2, y + 6.5);
}

function cellFromEvent(e) {
  if (!geo) return null;
  const rect = grid.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  const c = Math.floor((x - geo.ox) / geo.cw), r = Math.floor((y - geo.oy) / geo.ch);
  if (r < 0 || c < 0 || r >= doc.rows || c >= doc.cols) return null;
  return { r, c };
}

function normRect(rc) {
  return { r0: Math.min(rc.a.r, rc.b.r), r1: Math.max(rc.a.r, rc.b.r), c0: Math.min(rc.a.c, rc.b.c), c1: Math.max(rc.a.c, rc.b.c) };
}

let stroke = null;
function applyAt(cell, erase) {
  const key = `${cell.r},${cell.c}`;
  if (ui.mode === 'stack') {
    if (stroke.visited.has(key)) return;
    stroke.visited.add(key);
    if (erase) popBrick(cell.r, cell.c); else pushBrick(cell.r, cell.c, ui.brush);
  } else {
    setCell(ui.layer, cell.r, cell.c, erase ? '.' : ui.brush);
  }
}

function pickAt(cell) {
  let k = null;
  if (ui.mode === 'stack') { const st = stack(cell.r, cell.c); k = st[st.length - 1]; }
  else k = getCell(ui.layer, cell.r, cell.c);
  if (k && !isEmpty(k)) { ui.brush = k; setTool('paint'); changed(); }
}

grid.addEventListener('contextmenu', (e) => e.preventDefault());
grid.addEventListener('pointerdown', (e) => {
  const cell = cellFromEvent(e);
  if (!cell) return;
  grid.setPointerCapture(e.pointerId);
  const erase = e.button === 2 || ui.tool === 'erase';
  if (e.altKey || ui.tool === 'pick') { pickAt(cell); return; }
  snapshot();
  stroke = { erase, visited: new Set() };
  if (ui.tool === 'fill') { ui.rect = { a: cell, b: cell, erase }; drawGrid(); return; }
  applyAt(cell, erase);
  changed();
});
grid.addEventListener('pointermove', (e) => {
  const cell = cellFromEvent(e);
  ui.hover = cell;
  $('cellInfo').textContent = cell ? `row ${cell.r}, col ${cell.c}, stack ${stack(cell.r, cell.c).join('') || '—'}` : '';
  if (stroke && cell) {
    if (ui.rect) ui.rect.b = cell;
    else { applyAt(cell, stroke.erase); changed(); return; }
  }
  drawGrid();
});
grid.addEventListener('pointerleave', () => { ui.hover = null; drawGrid(); });
grid.addEventListener('pointerup', () => {
  if (!stroke) return;
  if (ui.rect) {
    const { r0, r1, c0, c1 } = normRect(ui.rect);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) applyAt({ r, c }, stroke.erase);
    ui.rect = null;
  }
  stroke = null;
  if (ui.mode === 'stack') trimLayers();
  changed();
});

// ------------------------------------------------------------------ validation
function validate() {
  const { level, errors, warnings } = parseLevel(exportObject());
  const L = legend();
  let bricks = 0, req = 0, critters = 0, drops = 0, maxH = 0;
  for (let r = 0; r < doc.rows; r++) {
    for (let c = 0; c < doc.cols; c++) {
      const st = stack(r, c);
      maxH = Math.max(maxH, st.length);
      for (const k of st) {
        const e = L[k];
        if (!e) continue;
        bricks++;
        if (e.type !== 'steel') req++;
        if (e.critter) critters++;
        if (e.drop) drops++;
      }
    }
  }
  $('stats').innerHTML = `Bricks: ${bricks} (${req} to clear)<br>Bonus bricks: ${drops} · Critter nests: ${critters}<br>Tallest stack: ${maxH} · Field depth: ${level ? level.depth.toFixed(1) : '?'}`;
  const ul = $('problems');
  ul.innerHTML = '';
  const add = (cls, t) => { const li = document.createElement('li'); li.className = cls; li.textContent = t; ul.appendChild(li); };
  errors.forEach((t) => add('err', t));
  [...new Set(warnings)].slice(0, 8).forEach((t) => add('warn', t));
  if (!errors.length && !warnings.length) add('ok', 'Looks good');
}

// ------------------------------------------------------------------ 3D preview
const pcanvas = $('preview');
const renderer = new Renderer(pcanvas, { shadowSize: 1024 });
const assets = createAssets(renderer);
const camera = new OrbitCamera();
let previewLevel = null, framedKey = '';

function rebuildPreview() {
  const { level } = parseLevel(exportObject());
  previewLevel = level;
  if (!level) return;
  const key = `${level.cols}x${level.rows}x${level.depth}`;
  if (key !== framedKey) {
    const size = Math.max(level.width, level.depth);
    camera.frame([0, 0, level.depth / 2], size * 1.35);
    renderer.setLightFrame([0, 0, level.depth / 2], size * 0.8);
    camera.applyPreset(camera.presetIndex, !framedKey);
    framedKey = key;
  }
}

let drag = null;
pcanvas.addEventListener('pointerdown', (e) => { pcanvas.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY }; });
pcanvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  camera.orbit(e.clientX - drag.x, e.clientY - drag.y);
  drag = { x: e.clientX, y: e.clientY };
});
pcanvas.addEventListener('pointerup', () => { drag = null; });
pcanvas.addEventListener('wheel', (e) => { e.preventDefault(); camera.zoom(Math.sign(e.deltaY)); }, { passive: false });

let last = performance.now(), time = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  const aspect = renderer.resize();
  camera.update(dt, aspect);
  const ed = Math.hypot(camera.eye[0] - camera.target[0], camera.eye[1] - camera.target[1], camera.eye[2] - camera.target[2]);
  renderer.fog = [ed + camera.baseDist * 0.2, ed + camera.baseDist * 1.5];
  const list = [];
  const Lv = previewLevel;
  if (Lv) {
    drawField(list, assets, Lv, time);
    for (let r = 0; r < Lv.rows; r++) {
      for (let c = 0; c < Lv.cols; c++) {
        Lv.stacks[r][c].forEach((def, i) => drawBrick(list, assets, Lv, def, r, c, i * BRICK_H));
      }
    }
    // hovered cell marker
    const h = ui.hover;
    if (h) {
      const y = ui.mode === 'stack' ? Lv.stacks[h.r][h.c].length * BRICK_H : ui.layer * BRICK_H;
      drawBrick(list, assets, Lv, { type: 'normal', color: '#46c8ff', hits: 1, tex: 'brick' }, h.r, h.c, y, {
        alpha: 0.45 + 0.2 * Math.sin(time * 8), emissive: [0.1, 0.4, 0.6],
      });
    }
    // bat for scale
    list.push(item(assets.meshes.cylinder, [0, 0.22, Lv.depth - 1.2], null, [2, 0.2, 0.2], { tex: assets.tex.bat, spec: 0.9 }));
    for (const s of [-1, 1]) list.push(item(assets.meshes.sphere, [s, 0.22, Lv.depth - 1.2], null, [0.24, 0.24, 0.24], { color: [0.95, 0.3, 0.35] }));
  }
  renderer.render(list, camera);
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ file actions
function loadDoc(json, label) {
  try {
    const d = sanitize(json);
    snapshot();
    doc = d;
    ui.layer = 0;
    changed(true);
    toast(`Loaded ${label || doc.name}`);
  } catch (e) {
    alert(`Could not load level: ${e.message}`);
  }
}

$('newBtn').onclick = () => {
  if (!confirm('Start a new empty level? (Undo can bring the old one back.)')) return;
  snapshot();
  doc = sanitize(blankLevel(13, 8));
  changed(true);
};
$('openBtn').onclick = () => $('openInput').click();
$('openInput').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try { loadDoc(JSON.parse(await f.text()), f.name); } catch (err) { alert(`Invalid JSON: ${err.message}`); }
  e.target.value = '';
};
$('downloadBtn').onclick = () => {
  const blob = new Blob([exportJson() + '\n'], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${slug(doc.name)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('copyBtn').onclick = async () => {
  try { await navigator.clipboard.writeText(exportJson()); toast('JSON copied'); } catch { toast('Clipboard not available'); }
};
$('testBtn').onclick = () => {
  const { errors } = parseLevel(exportObject());
  if (errors.length) { alert(`Fix these first:\n${errors.join('\n')}`); return; }
  store.set('rknoid.testLevel', exportJson());
  window.open('index.html?test=1', 'rknoid-test');
};
$('undoBtn').onclick = undo;
$('redoBtn').onclick = redo;
$('applyJsonBtn').onclick = () => {
  try { loadDoc(JSON.parse($('jsonArea').value), 'JSON'); } catch (e) { alert(`Invalid JSON: ${e.message}`); }
};
$('demoSelect').onchange = async (e) => {
  const f = e.target.value;
  e.target.value = '';
  if (!f) return;
  try {
    const r = await fetch(`levels/${f}`, { cache: 'no-cache' });
    loadDoc(await r.json(), f);
  } catch (err) { alert(`Could not fetch ${f}: ${err.message}`); }
};

window.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
  else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); redo(); }
  else if (e.code === 'KeyV') camera.applyPreset(camera.presetIndex + 1);
  else if (e.code === 'KeyO') camera.ortho = !camera.ortho;
  else if (/^Digit[0-9]$/.test(e.code) && ui.mode === 'layer') {
    const n = +e.code.slice(5);
    if (n < doc.layers.length) { ui.layer = n; changed(); }
  }
});
window.addEventListener('resize', () => drawGrid());

let toastTimer = 0;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.style.setProperty('--c', '#9ff0ff');
  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1400);
}

// ------------------------------------------------------------------ boot
(async function boot() {
  bindForms();
  bindTools();
  bindEntryEditor();
  changed(true);
  requestAnimationFrame(frame);
  new ResizeObserver(() => drawGrid()).observe(grid);
  try {
    const r = await fetch('levels/index.json', { cache: 'no-cache' });
    const idx = await r.json();
    for (const f of idx.levels) {
      const o = document.createElement('option');
      o.value = f;
      o.textContent = f.replace(/\.json$/, '');
      $('demoSelect').appendChild(o);
    }
  } catch {
    $('demoSelect').hidden = true; // opened from file:// - bundled levels unavailable
  }
})();
