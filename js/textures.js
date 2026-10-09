// Procedurally generated textures, painted onto 2D canvases at startup.
// Brick textures are mostly light grey so they can be tinted per brick colour.
import { rng } from './math.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function noise(ctx, w, h, rand, amount, alpha = 1) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
    d[i + 3] = Math.min(255, d[i + 3] * alpha + 0);
  }
  ctx.putImageData(img, 0, 0);
}

function bevel(ctx, w, h, size, light = 'rgba(255,255,255,0.55)', dark = 'rgba(0,0,0,0.45)') {
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w - size, size); ctx.lineTo(size, size); ctx.lineTo(size, h - size); ctx.lineTo(0, h);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(w, h); ctx.lineTo(0, h); ctx.lineTo(size, h - size); ctx.lineTo(w - size, h - size); ctx.lineTo(w - size, size); ctx.lineTo(w, 0);
  ctx.fill();
}

function cracks(ctx, w, h, rand, count) {
  ctx.strokeStyle = 'rgba(20,10,10,0.85)';
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    let x = w * (0.25 + rand() * 0.5), y = h * (0.25 + rand() * 0.5);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const a0 = rand() * Math.PI * 2;
    for (let k = 0; k < 6; k++) {
      const a = a0 + (rand() - 0.5) * 1.6;
      x += Math.cos(a) * w * 0.09;
      y += Math.sin(a) * h * 0.12;
      ctx.lineTo(x, y);
      ctx.lineWidth *= 0.85;
    }
    ctx.stroke();
  }
}

function basicBrick(seed, crackLevel = 0) {
  const w = 128, h = 64, c = canvas(w, h), ctx = c.getContext('2d'), r = rng(seed);
  ctx.fillStyle = '#d8d8d8';
  ctx.fillRect(0, 0, w, h);
  // soft vertical gradient
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  noise(ctx, w, h, r, 26);
  bevel(ctx, w, h, 7);
  // glossy highlight stripe
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(12, 11, w - 24, 6);
  if (crackLevel) cracks(ctx, w, h, r, crackLevel * 2);
  return c;
}

function hardBrick(seed, crackLevel = 0) {
  const w = 128, h = 64, c = canvas(w, h), ctx = c.getContext('2d'), r = rng(seed);
  ctx.fillStyle = '#c8c8c8';
  ctx.fillRect(0, 0, w, h);
  noise(ctx, w, h, r, 18);
  bevel(ctx, w, h, 8);
  // inner plate
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 14, w - 32, h - 28);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(18, 16, w - 36, h - 32);
  // rivets
  for (const [x, y] of [[13, 12], [w - 13, 12], [13, h - 12], [w - 13, h - 12]]) rivet(ctx, x, y, 3.5);
  if (crackLevel) cracks(ctx, w, h, r, crackLevel * 2);
  return c;
}

function rivet(ctx, x, y, rad) {
  const g = ctx.createRadialGradient(x - rad * 0.4, y - rad * 0.4, 0.5, x, y, rad);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#9a9a9a');
  g.addColorStop(1, '#3a3a3a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, Math.PI * 2);
  ctx.fill();
}

function steelBrick(seed) {
  const w = 128, h = 64, c = canvas(w, h), ctx = c.getContext('2d'), r = rng(seed);
  ctx.fillStyle = '#9aa3ad';
  ctx.fillRect(0, 0, w, h);
  // brushed metal: horizontal streaks
  for (let i = 0; i < 260; i++) {
    const y = r() * h, l = 10 + r() * 60, x = r() * w;
    ctx.strokeStyle = r() > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l, y); ctx.stroke();
  }
  bevel(ctx, w, h, 6, 'rgba(255,255,255,0.7)', 'rgba(0,0,0,0.55)');
  for (const [x, y] of [[12, 12], [w - 12, 12], [12, h - 12], [w - 12, h - 12]]) rivet(ctx, x, y, 4);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(w / 2, 8); ctx.lineTo(w / 2, h - 8); ctx.stroke();
  return c;
}

function armoredBrick(seed) {
  const w = 128, h = 64, c = canvas(w, h), ctx = c.getContext('2d'), r = rng(seed);
  // hazard stripes border = "only lasers can crack this"
  ctx.fillStyle = '#f2c400';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#151515';
  for (let x = -h; x < w + h; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + 10, 0); ctx.lineTo(x + 10 - h, h); ctx.lineTo(x - h, h);
    ctx.fill();
  }
  ctx.fillStyle = '#2b2f36';
  ctx.fillRect(12, 11, w - 24, h - 22);
  noise(ctx, w, h, r, 14);
  // lightning bolt symbol
  ctx.fillStyle = '#ff4030';
  ctx.beginPath();
  ctx.moveTo(70, 15); ctx.lineTo(52, 35); ctx.lineTo(63, 35); ctx.lineTo(56, 50); ctx.lineTo(76, 29); ctx.lineTo(65, 29);
  ctx.closePath();
  ctx.fill();
  bevel(ctx, w, h, 4, 'rgba(255,255,255,0.4)', 'rgba(0,0,0,0.5)');
  return c;
}

function explosiveBrick(seed) {
  const w = 128, h = 64, c = canvas(w, h), ctx = c.getContext('2d'), r = rng(seed);
  ctx.fillStyle = '#d8d8d8';
  ctx.fillRect(0, 0, w, h);
  noise(ctx, w, h, r, 20);
  bevel(ctx, w, h, 6);
  // warning triangle
  ctx.fillStyle = '#ffd400';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w / 2, 10); ctx.lineTo(w / 2 + 24, h - 10); ctx.lineTo(w / 2 - 24, h - 10);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', w / 2, h / 2 + 6);
  return c;
}

function symbolBrick(seed, draw) {
  const c = basicBrick(seed);
  draw(c.getContext('2d'), c.width, c.height);
  return c;
}

function floorTexture(seed) {
  const w = 256, h = 256, c = canvas(w, h), ctx = c.getContext('2d'), r = rng(seed);
  const t = w / 2;
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#5d5a7a' : '#4a4766';
      ctx.fillRect(x * t, y * t, t, t);
    }
  }
  noise(ctx, w, h, r, 22);
  // grime blotches
  for (let i = 0; i < 40; i++) {
    const x = r() * w, y = r() * h, rad = 6 + r() * 26;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(0,0,0,${0.05 + r() * 0.08})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // grout lines with a highlight on one side
  ctx.fillStyle = 'rgba(15,12,30,0.8)';
  for (let i = 0; i <= 2; i++) {
    ctx.fillRect(i * t - 2, 0, 4, h);
    ctx.fillRect(0, i * t - 2, w, 4);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 2; i++) {
    ctx.fillRect(i * t + 2, 0, 2, h);
    ctx.fillRect(0, i * t + 2, w, 2);
  }
  return c;
}

function wallTexture(seed) {
  const w = 256, h = 128, c = canvas(w, h), ctx = c.getContext('2d'), r = rng(seed);
  ctx.fillStyle = '#2a2740';
  ctx.fillRect(0, 0, w, h);
  // tech panels
  const rows = 2, bh = h / rows;
  for (let y = 0; y < rows; y++) {
    const off = y % 2 ? 32 : 0;
    for (let x = -off; x < w; x += 64) {
      const shade = 70 + Math.floor(r() * 30);
      ctx.fillStyle = `rgb(${shade},${shade - 8},${shade + 40})`;
      ctx.fillRect(x + 2, y * bh + 2, 60, bh - 4);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + 2, y * bh + 2, 60, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x + 2, y * bh + bh - 5, 60, 3);
      if (r() > 0.6) {
        ctx.fillStyle = r() > 0.5 ? '#46e3ff' : '#ff4fa3';
        ctx.fillRect(x + 10, y * bh + bh / 2 - 2, 14, 4);
      }
    }
  }
  noise(ctx, w, h, r, 16);
  return c;
}

const BONUS_STYLE = {
  laser: ['#e8382e', 'L'],
  expand: ['#2e6be8', 'E'],
  slow: ['#ff9a1f', 'S'],
  multi: ['#19c6d6', 'M'],
  catch: ['#38c24a', 'C'],
  life: ['#b0b0c0', 'P'],
  mega: ['#c33be0', 'X'],
};

function capsuleTexture(color, letter) {
  const w = 128, h = 64, c = canvas(w, h), ctx = c.getContext('2d');
  // u runs along the pill (x), v around it
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0.0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(0, 0, 14, h);
  ctx.fillRect(w - 14, 0, 14, h);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const y of [h * 0.25, h * 0.75]) {
    ctx.save();
    ctx.translate(w / 2, y);
    ctx.rotate(-Math.PI / 2);
    ctx.scale(1, 1.4);
    ctx.fillText(letter, 0, 1);
    ctx.restore();
  }
  return c;
}

function critterTexture(seed) {
  const w = 128, h = 64, c = canvas(w, h), ctx = c.getContext('2d'), r = rng(seed);
  ctx.fillStyle = '#7fd34a';
  ctx.fillRect(0, 0, w, h);
  noise(ctx, w, h, r, 30);
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(30,90,20,${0.4 + r() * 0.4})`;
    ctx.beginPath();
    ctx.arc(r() * w, r() * h, 2 + r() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

function batTexture() {
  const w = 128, h = 64, c = canvas(w, h), ctx = c.getContext('2d');
  // u along bat length, v around
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#d9dde6');
  g.addColorStop(0.5, '#ffffff');
  g.addColorStop(1, '#8a90a0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(40,40,60,0.6)';
  for (let x = 8; x < w; x += 16) ctx.fillRect(x, 0, 2, h);
  return c;
}

function glowTexture() {
  const s = 64, c = canvas(s, s), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return c;
}

function shadowBlobTexture() {
  const s = 64, c = canvas(s, s), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.6)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return c;
}

/** Build every texture the game needs. Returns a map of name -> canvas. */
export function generateTextureCanvases() {
  const t = {
    brick: basicBrick(11),
    brickCrack1: basicBrick(11, 1),
    brickCrack2: basicBrick(11, 2),
    hard: hardBrick(21),
    hardCrack1: hardBrick(21, 1),
    hardCrack2: hardBrick(21, 2),
    steel: steelBrick(31),
    armored: armoredBrick(41),
    explosive: explosiveBrick(51),
    bonus: symbolBrick(61, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 3;
      ctx.font = 'bold 40px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText('?', w / 2, h / 2 + 2);
      ctx.fillText('?', w / 2, h / 2 + 2);
    }),
    critterBrick: symbolBrick(71, (ctx, w, h) => {
      // a pair of eyes peeking out of the brick
      for (const x of [w / 2 - 16, w / 2 + 16]) {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(x, h / 2, 11, 13, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(x + 3, h / 2 + 4, 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(w / 2 - 28, h / 2 - 16); ctx.lineTo(w / 2 - 6, h / 2 - 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w / 2 + 28, h / 2 - 16); ctx.lineTo(w / 2 + 6, h / 2 - 10); ctx.stroke();
    }),
    floor: floorTexture(81),
    wall: wallTexture(91),
    critter: critterTexture(101),
    bat: batTexture(),
    glow: glowTexture(),
    blob: shadowBlobTexture(),
  };
  for (const [id, [color, letter]] of Object.entries(BONUS_STYLE)) t['capsule_' + id] = capsuleTexture(color, letter);
  return t;
}

export { BONUS_STYLE };
