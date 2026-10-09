// Level format, brick and bonus definitions, parsing and validation.
// See README.md "Level format" for the authoring guide.
import { t } from './i18n.js';

export const FORMAT = 'rk-noid-level@1';

export const CELL_W = 1.0;   // brick width  (x)
export const CELL_D = 0.5;   // brick depth  (z)
export const BRICK_H = 0.55; // brick height (y) - one stack layer

// Behaviour of each brick type.
//   hits      - how many hits to destroy (overridable per legend entry)
//   ball      - can the ball damage it
//   laser     - can projectiles damage it
//   counts    - must be destroyed to clear the level
export const BRICK_TYPES = {
  normal:    { hits: 1, points: 50,  ball: true,  laser: true,  counts: true,  tex: 'brick' },
  hard:      { hits: 2, points: 120, ball: true,  laser: true,  counts: true,  tex: 'hard' },
  steel:     { hits: Infinity, points: 0, ball: false, laser: false, counts: false, tex: 'steel' },
  armored:   { hits: 1, points: 200, ball: false, laser: true,  counts: true,  tex: 'armored' },
  explosive: { hits: 1, points: 80,  ball: true,  laser: true,  counts: true,  tex: 'explosive', explodes: true },
};

export const BONUS_TYPES = {
  laser:  { label: 'Laser',      duration: 12, desc: 'Bat fires projectiles (click / Space)' },
  expand: { label: 'Expand',     duration: 15, desc: 'Wider bat' },
  slow:   { label: 'Slow',       duration: 12, desc: 'Slower ball' },
  multi:  { label: 'Multi-ball', duration: 0,  desc: 'Splits every ball into three' },
  catch:  { label: 'Catch',      duration: 15, desc: 'Ball sticks to the bat' },
  life:   { label: 'Extra life', duration: 0,  desc: '+1 life' },
  mega:   { label: 'Mega ball',  duration: 8,  desc: 'Ball smashes through bricks' },
};

// Weighted pool used for "drop": "random".
export const RANDOM_BONUS_POOL = [
  ['laser', 5], ['expand', 4], ['slow', 3], ['multi', 4], ['catch', 3], ['mega', 2], ['life', 1],
];

export function pickRandomBonus(rand = Math.random) {
  const total = RANDOM_BONUS_POOL.reduce((s, [, w]) => s + w, 0);
  let x = rand() * total;
  for (const [id, w] of RANDOM_BONUS_POOL) {
    if ((x -= w) < 0) return id;
  }
  return 'expand';
}

// Built-in legend: any level may use these characters without declaring them,
// and may override or extend them in its own "legend" object.
export const DEFAULT_LEGEND = {
  r: { type: 'normal', color: '#e8473f' },
  o: { type: 'normal', color: '#f08a2c' },
  y: { type: 'normal', color: '#f2d33a' },
  g: { type: 'normal', color: '#55c84a' },
  c: { type: 'normal', color: '#36c9d6' },
  b: { type: 'normal', color: '#3f6fe8' },
  p: { type: 'normal', color: '#a65be0' },
  m: { type: 'normal', color: '#e85bb4' },
  w: { type: 'normal', color: '#e8e8ee' },
  H: { type: 'hard', color: '#b8bcc8' },
  K: { type: 'hard', hits: 3, color: '#e0b84a' },
  '#': { type: 'steel', color: '#ffffff' },
  A: { type: 'armored', color: '#ffffff' },
  X: { type: 'explosive', color: '#ff6a3a' },
  '?': { type: 'normal', color: '#ffd84a', drop: 'random', tex: 'bonus' },
  L: { type: 'normal', color: '#ff5a4a', drop: 'laser', tex: 'bonus' },
  '@': { type: 'normal', color: '#8fdc5a', critter: true, tex: 'critterBrick' },
};

export const EMPTY_CHARS = new Set(['.', ' ', '_']);

export const DEFAULT_SETTINGS = {
  ballSpeed: 8.5,        // units / second at start
  ballSpeedMax: 13,      // speed cap reached gradually
  bonusChance: 0.06,     // chance that a plain brick drops a random bonus
  critterSpeed: 1.7,     // forward speed of critters
  critterMode: 'gameover', // 'gameover' | 'life' - what happens when a critter touches the bat
  depth: 0,              // play-field depth; 0 = auto (rows * CELL_D + 10)
  backGap: 0.8,          // free space between back wall and the first brick row
  floorColor: '#ffffff', // tint for the floor texture
  wallColor: '#ffffff',  // tint for the wall texture
};

/**
 * Turn raw level JSON into a game-ready structure.
 * Returns { level, errors, warnings }. `level` is null when errors are fatal.
 */
export function parseLevel(json) {
  const errors = [], warnings = [];
  if (!json || typeof json !== 'object') return { level: null, errors: [t('v.notObject')], warnings };
  const cols = json.cols | 0, rows = json.rows | 0;
  if (cols < 3 || cols > 31) errors.push(t('v.cols', { v: json.cols }));
  if (rows < 1 || rows > 30) errors.push(t('v.rows', { v: json.rows }));
  if (!Array.isArray(json.layers) || !json.layers.length) errors.push(t('v.layers'));
  if (errors.length) return { level: null, errors, warnings };

  const legend = { ...DEFAULT_LEGEND, ...(json.legend || {}) };
  const resolved = {};
  for (const [key, entry] of Object.entries(legend)) {
    if (key.length !== 1) { warnings.push(t('v.keyLen', { key })); continue; }
    const type = BRICK_TYPES[entry.type] ? entry.type : 'normal';
    if (!BRICK_TYPES[entry.type]) warnings.push(t('v.unknownType', { key, type: entry.type }));
    const base = BRICK_TYPES[type];
    const drop = entry.drop && entry.drop !== 'none' ? entry.drop : null;
    if (drop && drop !== 'random' && !BONUS_TYPES[drop]) warnings.push(t('v.unknownDrop', { key, drop }));
    resolved[key] = {
      key,
      type,
      color: entry.color || '#ffffff',
      hits: type === 'steel' ? Infinity : Math.max(1, entry.hits | 0 || base.hits),
      points: entry.points ?? base.points,
      drop,
      critter: !!entry.critter,
      tex: entry.tex || base.tex,
      ball: base.ball,
      laser: base.laser,
      counts: base.counts,
      explodes: !!base.explodes,
    };
  }

  // stacks[r][c] = array of brick defs, bottom first. Gaps collapse (gravity).
  const stacks = [];
  let floating = 0;
  for (let r = 0; r < rows; r++) {
    stacks.push([]);
    for (let c = 0; c < cols; c++) stacks[r].push([]);
  }
  json.layers.forEach((layer, li) => {
    if (!Array.isArray(layer)) { errors.push(t('v.layerNotArray', { l: li })); return; }
    if (layer.length !== rows) warnings.push(t('v.layerRows', { l: li, n: layer.length, rows }));
    for (let r = 0; r < rows; r++) {
      const line = String(layer[r] ?? '');
      if (line.length && line.length !== cols) warnings.push(t('v.rowLen', { l: li, r, n: line.length, cols }));
      for (let c = 0; c < cols; c++) {
        const ch = line[c] ?? '.';
        if (EMPTY_CHARS.has(ch)) continue;
        const def = resolved[ch];
        if (!def) { warnings.push(t('v.unknownBrick', { ch, l: li, r, c })); continue; }
        if (stacks[r][c].length < li) floating++;
        stacks[r][c].push(def);
      }
    }
  });
  if (floating) warnings.push(t('v.floating', { n: floating }));

  let required = 0, armored = 0, laserSources = 0;
  for (const row of stacks) for (const st of row) for (const d of st) {
    if (d.counts) required++;
    if (d.type === 'armored') armored++;
    if (d.drop === 'laser') laserSources++;
  }
  if (!required) errors.push(t('v.noBricks'));
  // Steel never breaks, so anything stacked above it can never be cleared.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const st = stacks[r][c];
      const steelAt = st.findIndex((d) => d.type === 'steel');
      if (steelAt >= 0 && st.slice(steelAt + 1).some((d) => d.counts)) errors.push(t('v.onSteel', { r, c }));
    }
  }
  // Projectiles fly straight from the bat toward the back wall, so an armored
  // brick with indestructible steel anywhere in front of it can never be cleared.
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (!stacks[r][c].some((d) => d.type === 'armored')) continue;
      for (let r2 = r + 1; r2 < rows; r2++) {
        if (stacks[r2][c].some((d) => d.type === 'steel')) {
          errors.push(t('v.shielded', { r, c, r2 }));
          break;
        }
      }
    }
  }
  if (armored && !laserSources) warnings.push(t('v.noLaser'));

  const settings = { ...DEFAULT_SETTINGS, ...(json.settings || {}) };
  const depth = settings.depth > 0 ? settings.depth : rows * CELL_D + settings.backGap + 10;

  return {
    level: {
      name: json.name || 'Untitled',
      author: json.author || '',
      description: json.description || '',
      i18n: json.i18n && typeof json.i18n === 'object' ? json.i18n : {},
      cols, rows, depth, settings, legend: resolved, stacks,
      width: cols * CELL_W,
    },
    errors,
    warnings,
  };
}

/** A blank level, used by the editor. */
export function blankLevel(cols = 13, rows = 8) {
  return {
    format: FORMAT,
    name: 'New level',
    author: '',
    description: '',
    cols,
    rows,
    settings: {},
    legend: {},
    layers: [Array.from({ length: rows }, () => '.'.repeat(cols))],
  };
}
