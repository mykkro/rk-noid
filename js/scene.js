// Shared assets and drawing helpers used by both the game and the level editor.
import { mat4, mat3, compose, normalMatrix, multiply, hexToRgb } from './math.js';
import { box, sphere, cylinderX, capsuleX, quadY } from './meshes.js';
import { generateTextureCanvases } from './textures.js';
import { CELL_W, CELL_D, BRICK_H } from './level.js';

export function createAssets(renderer) {
  const meshes = {
    box: renderer.createMesh(box()),
    sphere: renderer.createMesh(sphere(24, 16)),
    sphereLow: renderer.createMesh(sphere(10, 8)),
    cylinder: renderer.createMesh(cylinderX(28)),
    capsule: renderer.createMesh(capsuleX(1.2, 18, 12)),
    quad: renderer.createMesh(quadY()),
  };
  const tex = {};
  for (const [name, c] of Object.entries(generateTextureCanvases())) {
    tex[name] = renderer.createTexture(c, { repeat: name === 'floor' || name === 'wall' });
  }
  return { meshes, tex };
}

const ZERO3 = [0, 0, 0];
const colorCache = new Map();
export function rgb(hex) {
  let c = colorCache.get(hex);
  if (!c) { c = new Float32Array(hexToRgb(hex)); colorCache.set(hex, c); }
  return c;
}

/** Create a draw item. opts: color, tex, emissive, alpha, uvScale, spec, unlit, shadow, additive */
export function item(mesh, pos, rot, scale, opts = {}) {
  const model = compose(mat4(), pos, rot || ZERO3, scale);
  return { mesh, model, nmat: normalMatrix(mat3(), model), ...opts };
}

/** Draw item positioned relative to a parent matrix (for multi-part models). */
export function childItem(parent, mesh, pos, rot, scale, opts = {}) {
  const local = compose(mat4(), pos, rot || ZERO3, scale);
  const model = multiply(mat4(), parent, local);
  return { mesh, model, nmat: normalMatrix(mat3(), model), ...opts };
}

export function brickTexture(assets, def, hitsLeft) {
  const t = assets.tex;
  if (def.type === 'normal' || def.type === 'hard') {
    const base = def.tex === 'hard' || def.type === 'hard' ? 'hard' : def.tex;
    if (base === 'hard' || base === 'brick') {
      const dmg = def.hits - hitsLeft;
      if (dmg > 0) {
        const lvl = Math.min(2, Math.ceil((dmg / def.hits) * 2));
        return t[`${base}Crack${lvl}`];
      }
    }
    return t[base] || t.brick;
  }
  return t[def.tex] || t.brick;
}

/** Push a brick at grid position (row, col) with its bottom at height y. */
export function drawBrick(list, assets, level, def, row, col, y, opts = {}) {
  const x = -level.width / 2 + (col + 0.5) * CELL_W;
  const z = level.settings.backGap + (row + 0.5) * CELL_D;
  const gap = 0.05;
  const flash = opts.flash || 0;
  list.push(item(assets.meshes.box, [x, y + BRICK_H / 2, z], null, [CELL_W - gap, BRICK_H - 0.02, CELL_D - gap], {
    color: rgb(def.color),
    tex: brickTexture(assets, def, opts.hitsLeft ?? def.hits),
    emissive: flash ? [flash, flash, flash * 0.9] : opts.emissive,
    spec: def.type === 'steel' ? 0.8 : 0.3,
    alpha: opts.alpha,
  }));
}

/** Floor, walls and decoration of the arena. */
export function drawField(list, assets, level, time = 0) {
  const W = level.width, D = level.depth;
  const s = level.settings;
  const m = assets.meshes, t = assets.tex;
  const floorTint = rgb(s.floorColor || '#ffffff');
  const wallTint = rgb(s.wallColor || '#ffffff');
  // floor slab: top surface at y = 0
  list.push(item(m.box, [0, -0.15, D / 2], null, [W, 0.3, D], { tex: t.floor, color: floorTint, uvScale: [W / 2, D / 2], spec: 0.12 }));
  // plinth under the floor so the arena floats in space
  list.push(item(m.box, [0, -0.7, D / 2 - 0.2], null, [W + 1.2, 0.8, D + 0.4], { tex: t.wall, color: [0.5, 0.48, 0.65], uvScale: [W / 3, 1], spec: 0.05 }));
  const wh = 0.9, wt = 0.4;
  // back wall
  list.push(item(m.box, [0, wh / 2 - 0.05, -wt / 2], null, [W + wt * 2, wh, wt], { tex: t.wall, color: wallTint, uvScale: [(W + wt * 2) / 3, 1] }));
  // side walls
  for (const sx of [-1, 1]) {
    list.push(item(m.box, [sx * (W / 2 + wt / 2), wh / 2 - 0.05, D / 2 - wt / 2], null, [wt, wh, D + wt], { tex: t.wall, color: wallTint, uvScale: [(D + wt) / 3, 1] }));
    // neon strip on top of the wall
    list.push(item(m.box, [sx * (W / 2 + wt / 2), wh - 0.03, D / 2 - wt / 2], null, [wt * 0.35, 0.06, D + wt], {
      color: [0.3, 0.9, 1.0], emissive: [0.2, 0.6, 0.8], shadow: false,
    }));
    // front pillars with blinking beacons
    const blink = 0.5 + 0.5 * Math.sin(time * 4 + sx);
    list.push(item(m.box, [sx * (W / 2 + wt / 2), 0.7, D + 0.1], null, [wt * 1.4, 1.5, wt * 1.4], { tex: t.steel, color: [0.8, 0.8, 0.9], spec: 0.6 }));
    list.push(item(m.sphere, [sx * (W / 2 + wt / 2), 1.6, D + 0.1], null, [0.18, 0.18, 0.18], {
      color: [1, 0.3, 0.4], emissive: [0.9 * blink, 0.15 * blink, 0.25 * blink], shadow: false,
    }));
  }
  // back wall neon
  list.push(item(m.box, [0, wh - 0.03, -wt / 2], null, [W + wt * 2, 0.06, wt * 0.35], {
    color: [1, 0.4, 0.8], emissive: [0.7, 0.2, 0.5], shadow: false,
  }));
  // dashed danger line behind the bat
  const lineZ = D - 0.35;
  for (let x = -W / 2 + 0.25; x < W / 2; x += 0.7) {
    list.push(item(m.box, [x + 0.15, 0.005, lineZ], null, [0.35, 0.01, 0.06], {
      color: [1, 0.25, 0.2], emissive: [0.5, 0.08, 0.05], shadow: false, receiveShadow: false,
    }));
  }
}
