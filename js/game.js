// Game rules and simulation. Physics runs in the XZ plane (top-down 2D);
// Y is only used for visuals (stacked bricks, ball hop, critters climbing).
import { CELL_W, CELL_D, BRICK_H, BONUS_TYPES, pickRandomBonus } from './level.js';
import { item, childItem, drawBrick, drawField, rgb } from './scene.js';
import { compose, mat4, clamp } from './math.js';
import { BONUS_STYLE } from './textures.js';
import { t, tn, localized } from './i18n.js';

export const BALL_R = 0.18;
const BAT_R = 0.2;            // radius of the bat's rounded body
const BAT_HALF = 1.0;         // half length of the straight part
const BAT_HALF_EXPANDED = 1.7;
const CRITTER_R = 0.3;
const BOLT_SPEED = 20;
const CAPSULE_SPEED = 2.6;
const MAX_BALLS = 12;
const FIRE_COOLDOWN = 0.26;

const sign = (v) => (v < 0 ? -1 : 1);

export class Game {
  constructor({ assets, sfx, onEvent }) {
    this.assets = assets;
    this.sfx = sfx;
    this.onEvent = onEvent || (() => {});
    this.time = 0;
    this.state = 'idle';
    this.score = 0;
    this.lives = 3;
    this.level = null;
  }

  // ---------------------------------------------------------------- setup
  start(levels, index = 0, { testMode = false } = {}) {
    this.levels = levels;
    this.levelIndex = index;
    this.testMode = testMode;
    this.score = 0;
    this.lives = 3;
    this.loadLevel(index);
  }

  loadLevel(index, { silent = false } = {}) {
    const L = this.levels[index];
    this.level = L;
    this.levelIndex = index;
    this.grid = L.stacks.map((row) => row.map((st) => st.map((def, i) => ({
      def, hits: def.hits, y: i * BRICK_H, vy: 0, flash: 0,
    }))));
    this.required = 0;
    for (const row of this.grid) for (const st of row) for (const b of st) if (b.def.counts) this.required++;
    this.particles = [];
    this.explosions = [];
    this.levelTime = 0;
    this.resetLife();
    this.state = 'play';
    if (!silent) {
      this.onEvent('level', { index, level: L });
      this.sfx.play('start');
    }
  }

  resetLife() {
    const L = this.level;
    this.bat = { x: 0, z: L.depth - 1.2, half: BAT_HALF, bounce: 0, alive: true };
    this.balls = [];
    this.bolts = [];
    this.capsules = [];
    this.critters = [];
    this.effects = { laser: 0, expand: 0, slow: 0, catch: 0, mega: 0 };
    this.speedBoost = 0;
    this.fireCooldown = 0;
    this.addServeBall();
  }

  addServeBall() {
    this.balls.push({ x: this.bat.x + 0.25, z: this.bat.z - BAT_R - BALL_R - 0.02, vx: 0, vz: -1, stuck: true, serve: true, offset: 0.25, stuckTime: 0, hop: 0, trail: [] });
  }

  get speed() {
    const s = this.level.settings;
    return Math.min(s.ballSpeedMax, s.ballSpeed + this.speedBoost) * (this.effects.slow > 0 ? 0.62 : 1);
  }

  // ---------------------------------------------------------------- main update
  update(dt, input) {
    this.time += dt;
    if (!this.level) return;
    this.levelTime += dt;
    this.updateBricks(dt);
    this.updateParticles(dt);
    if (this.state === 'play') {
      this.updateBat(dt, input);
      this.updateEffects(dt);
      this.handleFire(dt, input);
      this.updateBalls(dt);
      this.updateBolts(dt);
      this.updateCapsules(dt);
      this.updateCritters(dt);
      this.updateExplosions(dt);
    } else if (this.state === 'dying' || this.state === 'clear') {
      this.updateExplosions(dt);
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.afterTimer();
    }
  }

  afterTimer() {
    if (this.state === 'dying') {
      if (this.lives <= 0) this.gameOver('reason.noLives');
      else { this.resetLife(); this.state = 'play'; }
    } else if (this.state === 'clear') {
      if (this.testMode || this.levelIndex + 1 >= this.levels.length) {
        this.state = 'won';
        this.onEvent('won', { score: this.score });
      } else this.loadLevel(this.levelIndex + 1);
    }
  }

  gameOver(reason) {
    this.state = 'over';
    this.overReason = reason;
    this.onEvent('over', { score: this.score, reason });
  }

  // ---------------------------------------------------------------- bat & input
  updateBat(dt, input) {
    const bat = this.bat, W2 = this.level.width / 2;
    const targetHalf = this.effects.expand > 0 ? BAT_HALF_EXPANDED : BAT_HALF;
    bat.half += (targetHalf - bat.half) * Math.min(1, dt * 8);
    if (input.axis) bat.x += input.axis * 15 * dt;
    else if (input.targetX != null) {
      const d = input.targetX - bat.x;
      bat.x += clamp(d, -45 * dt, 45 * dt);
    }
    const lim = W2 - bat.half - BAT_R;
    bat.x = clamp(bat.x, -lim, lim);
    bat.bounce = Math.max(0, bat.bounce - dt * 5);
  }

  handleFire(dt, input) {
    this.fireCooldown -= dt;
    if (input.firePressed) {
      const stuck = this.balls.filter((b) => b.stuck);
      if (stuck.length) { stuck.forEach((b) => this.launch(b)); return; }
    }
    if (this.effects.laser > 0 && (input.firePressed || input.fireHeld) && this.fireCooldown <= 0) {
      this.fireCooldown = FIRE_COOLDOWN;
      const bat = this.bat;
      for (const s of [-1, 1]) this.bolts.push({ x: bat.x + s * bat.half * 0.85, z: bat.z - 0.3, dead: false });
      this.sfx.play('laser');
    }
  }

  launch(ball) {
    const off = clamp(ball.offset / (this.bat.half + BAT_R), -1, 1);
    const a = off * 0.9 + (Math.abs(off) < 0.05 ? 0.2 : 0);
    ball.vx = Math.sin(a);
    ball.vz = -Math.cos(a);
    ball.stuck = false;
    ball.serve = false;
    this.sfx.play('launch');
  }

  updateEffects(dt) {
    for (const k of Object.keys(this.effects)) {
      if (this.effects[k] > 0) {
        this.effects[k] = Math.max(0, this.effects[k] - dt);
        if (this.effects[k] === 0) this.onEvent('effectEnd', { type: k });
      }
    }
  }

  // ---------------------------------------------------------------- balls
  updateBalls(dt) {
    const L = this.level, bat = this.bat;
    for (const ball of this.balls) {
      if (ball.stuck) {
        ball.x = bat.x + ball.offset;
        ball.z = bat.z - BAT_R - BALL_R - 0.02;
        ball.stuckTime += dt;
        // caught (not served) balls release automatically
        if (!ball.serve && ball.stuckTime > 3) this.launch(ball);
        ball.trail.length = 0;
        continue;
      }
      const spd = this.speed;
      let len = Math.hypot(ball.vx, ball.vz) || 1;
      ball.vx = (ball.vx / len) * spd;
      ball.vz = (ball.vz / len) * spd;
      const dist = spd * dt;
      const steps = Math.max(1, Math.ceil(dist / (BALL_R * 0.4)));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        ball.x += ball.vx * h;
        ball.z += ball.vz * h;
        this.collideWalls(ball);
        this.collideCritters(ball);
        this.collideBricks(ball);
        this.collideBat(ball);
        if (ball.stuck) break;
        if (ball.z > L.depth + 0.6) { ball.dead = true; break; }
      }
      // avoid near-horizontal loops
      len = Math.hypot(ball.vx, ball.vz);
      if (Math.abs(ball.vz) < 0.3 * len) {
        ball.vz = sign(ball.vz) * 0.3 * len;
        ball.vx = sign(ball.vx) * Math.sqrt(len * len - ball.vz * ball.vz);
      }
      ball.hop += dist * 1.6;
      ball.trail.unshift([ball.x, this.ballY(ball), ball.z]);
      if (ball.trail.length > 8) ball.trail.pop();
    }
    const before = this.balls.length;
    this.balls = this.balls.filter((b) => !b.dead);
    if (before && !this.balls.length) this.loseLife('ball');
  }

  ballY(ball) {
    return BALL_R + Math.abs(Math.sin(ball.hop)) * 0.22;
  }

  collideWalls(ball) {
    const W2 = this.level.width / 2;
    if (ball.x < -W2 + BALL_R) { ball.x = -W2 + BALL_R; ball.vx = Math.abs(ball.vx); this.sfx.play('wall'); }
    if (ball.x > W2 - BALL_R) { ball.x = W2 - BALL_R; ball.vx = -Math.abs(ball.vx); this.sfx.play('wall'); }
    if (ball.z < BALL_R) { ball.z = BALL_R; ball.vz = Math.abs(ball.vz); this.sfx.play('wall'); }
  }

  cellAt(x, z) {
    const L = this.level;
    return [Math.floor((z - L.settings.backGap) / CELL_D), Math.floor((x + L.width / 2) / CELL_W)];
  }

  // A cell blocks the ball when its bottom brick is (nearly) on the ground.
  solid(r, c) {
    const L = this.level;
    if (r < 0 || c < 0 || r >= L.rows || c >= L.cols) return false;
    const st = this.grid[r][c];
    return st.length > 0 && st[0].y < BRICK_H * 0.6;
  }

  collideBricks(ball) {
    const L = this.level, W2 = L.width / 2, g = L.settings.backGap, R = BALL_R;
    const c0 = Math.max(0, Math.floor((ball.x - R + W2) / CELL_W)), c1 = Math.min(L.cols - 1, Math.floor((ball.x + R + W2) / CELL_W));
    const r0 = Math.max(0, Math.floor((ball.z - R - g) / CELL_D)), r1 = Math.min(L.rows - 1, Math.floor((ball.z + R - g) / CELL_D));
    let best = null;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (!this.solid(r, c)) continue;
        const bx0 = -W2 + c * CELL_W, bx1 = bx0 + CELL_W, bz0 = g + r * CELL_D, bz1 = bz0 + CELL_D;
        const px = clamp(ball.x, bx0, bx1), pz = clamp(ball.z, bz0, bz1);
        const dx = ball.x - px, dz = ball.z - pz, d2 = dx * dx + dz * dz;
        if (d2 >= R * R) continue;
        let nx, nz, pen;
        const d = Math.sqrt(d2);
        if (d > 1e-6) { nx = dx / d; nz = dz / d; pen = R - d; }
        else {
          // centre inside the box: push out along the shortest axis
          const opts = [[ball.x - bx0, -1, 0], [bx1 - ball.x, 1, 0], [ball.z - bz0, 0, -1], [bz1 - ball.z, 0, 1]];
          opts.sort((a, b) => a[0] - b[0]);
          [pen, nx, nz] = [opts[0][0] + R, opts[0][1], opts[0][2]];
        }
        if (!best || pen > best.pen) best = { r, c, nx, nz, pen };
      }
    }
    if (!best) return;
    let { nx, nz } = best;
    if (nx && nz) {
      // corner contact: if the neighbour continues the face, treat it as a flat face
      if (this.solid(best.r, best.c + sign(nx))) { nx = 0; nz = sign(nz); }
      else if (this.solid(best.r + sign(nz), best.c)) { nx = sign(nx); nz = 0; }
    }
    const brick = this.grid[best.r][best.c][0];
    const pierce = this.effects.mega > 0 && brick.def.ball;
    if (!pierce) {
      ball.x += nx * best.pen;
      ball.z += nz * best.pen;
      const vd = ball.vx * nx + ball.vz * nz;
      if (vd < 0) { ball.vx -= 2 * vd * nx; ball.vz -= 2 * vd * nz; }
    }
    this.hitBrick(best.r, best.c, pierce ? 'mega' : 'ball');
  }

  collideBat(ball) {
    const bat = this.bat;
    if (!bat.alive || ball.vz <= 0) return;
    const px = clamp(ball.x, bat.x - bat.half, bat.x + bat.half);
    const dx = ball.x - px, dz = ball.z - bat.z;
    const d = Math.hypot(dx, dz), rr = BALL_R + BAT_R;
    if (d >= rr) return;
    const nx = d > 1e-6 ? dx / d : 0, nz = d > 1e-6 ? dz / d : -1;
    ball.x = px + nx * rr;
    ball.z = bat.z + nz * rr;
    if (ball.z <= bat.z) {
      // classic arkanoid: the exit angle depends on where the ball hit the bat
      const off = clamp((ball.x - bat.x) / (bat.half + BAT_R), -1, 1);
      const a = off * 1.05;
      ball.vx = Math.sin(a);
      ball.vz = -Math.cos(a);
      bat.bounce = 1;
      if (this.effects.catch > 0) {
        ball.stuck = true;
        ball.stuckTime = 0;
        ball.offset = ball.x - bat.x;
      }
      this.sfx.play('bat');
    } else {
      const vd = ball.vx * nx + ball.vz * nz;
      if (vd < 0) { ball.vx -= 2 * vd * nx; ball.vz -= 2 * vd * nz; }
    }
  }

  collideCritters(ball) {
    for (const cr of this.critters) {
      if (cr.dead || cr.y > BRICK_H * 0.7) continue;
      const dx = ball.x - cr.x, dz = ball.z - cr.z, d = Math.hypot(dx, dz);
      if (d < BALL_R + CRITTER_R) {
        // the ball can't hurt a critter: it just bounces off (only lasers and explosions kill it)
        const nx = d > 1e-6 ? dx / d : 0, nz = d > 1e-6 ? dz / d : -1;
        ball.x = cr.x + nx * (BALL_R + CRITTER_R);
        ball.z = cr.z + nz * (BALL_R + CRITTER_R);
        const vd = ball.vx * nx + ball.vz * nz;
        if (vd < 0) { ball.vx -= 2 * vd * nx; ball.vz -= 2 * vd * nz; }
        if (cr.flinch <= 0) this.sfx.play('wall');
        cr.flinch = 0.3;
      }
    }
  }

  // ---------------------------------------------------------------- bricks
  cellCenter(r, c) {
    const L = this.level;
    return [-L.width / 2 + (c + 0.5) * CELL_W, L.settings.backGap + (r + 0.5) * CELL_D];
  }

  hitBrick(r, c, source) {
    const st = this.grid[r][c];
    const b = st[0];
    if (!b) return;
    const d = b.def;
    const immune = (source === 'ball' && !d.ball) || (source === 'laser' && !d.laser) || d.type === 'steel';
    if (immune) {
      b.flash = 0.6;
      this.sfx.play('steel');
      if (source === 'ball' && d.type === 'armored') this.pityLaser(r, c);
      return;
    }
    b.hits -= source === 'mega' || source === 'explosion' ? b.hits : 1;
    b.flash = 1;
    if (b.hits <= 0) this.destroyBrick(r, c, source);
    else this.sfx.play('hit');
  }

  destroyBrick(r, c, source) {
    const st = this.grid[r][c];
    const b = st.shift();
    const d = b.def;
    const [x, z] = this.cellCenter(r, c);
    this.score += d.points;
    if (d.counts) this.required--;
    this.speedBoost += 0.06;
    this.burst(x, b.y + BRICK_H / 2, z, d.color, 10, d.tex === 'steel' ? null : this.assets.tex.brick);
    this.sfx.play('break');
    if (d.critter) this.spawnCritter(x, z);
    else if (d.drop) this.spawnCapsule(d.drop === 'random' ? pickRandomBonus() : d.drop, x, z);
    else if (d.type !== 'armored' && Math.random() < this.level.settings.bonusChance) this.spawnCapsule(pickRandomBonus(), x, z);
    if (d.explodes) this.explosions.push({ r, c, t: 0.12 });
    if (this.required <= 0 && this.state === 'play') this.levelClear();
  }

  // Ball can't break armored bricks. If nothing else is left and no laser is
  // available, the armored brick coughs up a laser capsule so the level is winnable.
  pityLaser(r, c) {
    if (this.effects.laser > 0 || this.capsules.some((k) => k.type === 'laser')) return;
    // only bottom bricks are reachable by the ball; bricks stacked on armor are not
    let ballBreakable = 0;
    for (const row of this.grid) for (const st of row) if (st[0] && st[0].def.counts && st[0].def.ball) ballBreakable++;
    if (ballBreakable === 0 || Math.random() < 0.06) {
      const [x, z] = this.cellCenter(r, c);
      this.spawnCapsule('laser', x, z);
      this.pityCount = (this.pityCount || 0) + 1;
    }
  }

  updateBricks(dt) {
    if (!this.grid) return;
    for (const row of this.grid) {
      for (const st of row) {
        for (let i = 0; i < st.length; i++) {
          const b = st[i];
          if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 4);
          const target = i * BRICK_H;
          if (b.y > target) {
            b.vy -= 22 * dt;
            b.y += b.vy * dt;
            if (b.y <= target) { b.y = target; b.vy = 0; }
          }
        }
      }
    }
  }

  updateExplosions(dt) {
    const L = this.level;
    for (const e of this.explosions) {
      e.t -= dt;
      if (e.t > 0) continue;
      e.done = true;
      const [x, z] = this.cellCenter(e.r, e.c);
      this.sfx.play('explode');
      this.onEvent('shake', 0.5);
      this.burst(x, 0.4, z, '#ffb030', 26, null, true);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = e.r + dr, c = e.c + dc;
          if (r < 0 || c < 0 || r >= L.rows || c >= L.cols) continue;
          if (this.grid[r][c].length) this.hitBrick(r, c, 'explosion');
        }
      }
      for (const cr of this.critters) if (Math.hypot(cr.x - x, cr.z - z) < 1.6) this.killCritter(cr);
    }
    this.explosions = this.explosions.filter((e) => !e.done);
  }

  levelClear() {
    this.state = 'clear';
    this.stateTimer = 3.2;
    const bonus = 1000 + this.lives * 250;
    this.score += bonus;
    this.clearBonus = bonus;
    this.sfx.play('clear');
    this.onEvent('clear', { bonus });
  }

  loseLife(reason) {
    if (this.state !== 'play') return;
    this.lives--;
    this.state = 'dying';
    this.stateTimer = 2;
    this.deathReason = reason;
    this.bat.alive = false;
    this.burst(this.bat.x, 0.3, this.bat.z, '#e0e4f0', 24, this.assets.tex.bat, true);
    this.balls = [];
    this.bolts = [];
    this.sfx.play(reason === 'critter' ? 'eaten' : 'lost');
    this.onEvent('lifeLost', { reason, lives: this.lives });
  }

  // ---------------------------------------------------------------- projectiles
  updateBolts(dt) {
    const L = this.level;
    for (const bolt of this.bolts) {
      const dist = BOLT_SPEED * dt;
      const steps = Math.ceil(dist / 0.2);
      for (let i = 0; i < steps && !bolt.dead; i++) {
        bolt.z -= dist / steps;
        if (bolt.z < 0) { bolt.dead = true; this.sparks(bolt.x, 0.3, 0.05, '#ff6040'); break; }
        const [r, c] = this.cellAt(bolt.x, bolt.z);
        if (this.solid(r, c)) {
          bolt.dead = true;
          this.sparks(bolt.x, 0.3, bolt.z, '#ff6040');
          this.hitBrick(r, c, 'laser');
          break;
        }
        for (const cr of this.critters) {
          if (!cr.dead && Math.hypot(cr.x - bolt.x, cr.z - bolt.z) < CRITTER_R + 0.08) {
            bolt.dead = true;
            this.killCritter(cr);
            break;
          }
        }
      }
      if (bolt.z > L.depth + 2) bolt.dead = true;
    }
    this.bolts = this.bolts.filter((b) => !b.dead);
  }

  // ---------------------------------------------------------------- capsules / bonuses
  spawnCapsule(type, x, z) {
    if (!BONUS_TYPES[type]) return;
    this.capsules.push({ type, x, z, spin: 0 });
  }

  updateCapsules(dt) {
    const bat = this.bat, L = this.level;
    for (const k of this.capsules) {
      k.z += CAPSULE_SPEED * dt;
      k.spin += dt * 4;
      if (bat.alive && Math.abs(k.x - bat.x) < bat.half + BAT_R + 0.35 && Math.abs(k.z - bat.z) < 0.35) {
        k.dead = true;
        this.applyBonus(k.type);
      }
      if (k.z > L.depth + 1) k.dead = true;
    }
    this.capsules = this.capsules.filter((k) => !k.dead);
  }

  applyBonus(type) {
    const def = BONUS_TYPES[type];
    this.score += 100;
    if (type === 'life') { this.lives++; this.sfx.play('life'); }
    else if (type === 'multi') { this.splitBalls(); this.sfx.play('bonus'); }
    else { this.effects[type] = def.duration; this.sfx.play('bonus'); }
    this.onEvent('bonus', { type, label: def.label });
  }

  splitBalls() {
    for (const b of this.balls) if (b.stuck) this.launch(b);
    const extra = [];
    for (const b of this.balls) {
      for (const a of [-0.45, 0.45]) {
        if (this.balls.length + extra.length >= MAX_BALLS) break;
        const ca = Math.cos(a), sa = Math.sin(a);
        extra.push({ ...b, trail: [], vx: b.vx * ca - b.vz * sa, vz: b.vx * sa + b.vz * ca });
      }
    }
    this.balls.push(...extra);
  }

  // ---------------------------------------------------------------- critters
  spawnCritter(x, z) {
    this.critters.push({ x, z: z + CELL_D * 0.6, y: 0, vy: 0, vx: 0, phase: Math.random() * 6, heading: 0, spawn: 0, flinch: 0 });
    this.sfx.play('critter');
    this.onEvent('critter', {});
  }

  heightAt(x, z) {
    let h = 0;
    for (const [ox, oz] of [[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]]) {
      const [r, c] = this.cellAt(x + ox, z + oz);
      if (r < 0 || c < 0 || r >= this.level.rows || c >= this.level.cols) continue;
      const st = this.grid[r][c];
      if (st.length) h = Math.max(h, st[st.length - 1].y + BRICK_H);
    }
    return h;
  }

  updateCritters(dt) {
    const L = this.level, bat = this.bat, W2 = L.width / 2;
    const speed = L.settings.critterSpeed;
    for (const cr of this.critters) {
      cr.spawn = Math.min(1, cr.spawn + dt * 2);
      cr.phase += dt * 9;
      cr.flinch = Math.max(0, cr.flinch - dt);
      // home in on the bat, but with limited sideways speed so it can be dodged
      const lat = speed * 0.75;
      const want = clamp((bat.x - cr.x) * 1.5, -lat, lat) + Math.sin(this.time * 2.3 + cr.phase * 0.1) * 0.4;
      cr.vx += (want - cr.vx) * Math.min(1, dt * 3);
      cr.x = clamp(cr.x + cr.vx * dt, -W2 + CRITTER_R, W2 - CRITTER_R);
      cr.z += speed * dt;
      cr.heading = Math.atan2(cr.vx, speed);
      // walk over brick stacks: climb up, fall down
      const ground = this.heightAt(cr.x, cr.z);
      if (cr.y < ground) { cr.y = Math.min(ground, cr.y + dt * 3); cr.vy = 0; }
      else if (cr.y > ground) {
        cr.vy -= 20 * dt;
        cr.y = Math.max(ground, cr.y + cr.vy * dt);
        if (cr.y === ground) cr.vy = 0;
      }
      if (bat.alive && cr.y < 0.5) {
        const px = clamp(cr.x, bat.x - bat.half, bat.x + bat.half);
        if (Math.hypot(cr.x - px, cr.z - bat.z) < CRITTER_R + BAT_R) this.critterHitsBat(cr);
      }
      if (cr.z > L.depth + 1) cr.dead = true;
    }
    this.critters = this.critters.filter((c) => !c.dead);
  }

  killCritter(cr) {
    if (cr.dead) return;
    cr.dead = true;
    this.score += 250;
    this.burst(cr.x, cr.y + 0.3, cr.z, '#7fd34a', 16, this.assets.tex.critter);
    this.sfx.play('squash');
  }

  critterHitsBat(cr) {
    cr.dead = true;
    if (this.level.settings.critterMode === 'life') { this.loseLife('critter'); return; }
    this.bat.alive = false;
    this.burst(this.bat.x, 0.3, this.bat.z, '#e0e4f0', 30, this.assets.tex.bat, true);
    this.balls = [];
    this.sfx.play('eaten');
    this.lives = 0;
    this.gameOver('reason.eaten');
  }

  // ---------------------------------------------------------------- particles
  burst(x, y, z, color, n, tex, hot = false) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 3.5;
      this.particles.push({
        x, y, z,
        vx: Math.cos(a) * s, vy: 2 + Math.random() * 5, vz: Math.sin(a) * s,
        rot: [Math.random() * 6, Math.random() * 6, 0], vr: [Math.random() * 10 - 5, Math.random() * 10 - 5],
        size: 0.06 + Math.random() * 0.12,
        life: 0.8 + Math.random() * 0.8, max: 1.6,
        color: rgb(color), tex, hot,
      });
    }
  }

  sparks(x, y, z, color) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x, y, z,
        vx: (Math.random() - 0.5) * 4, vy: Math.random() * 4, vz: Math.random() * 3,
        rot: [0, 0, 0], vr: [0, 0], size: 0.05, life: 0.3, max: 0.3, color: rgb(color), spark: true,
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.vy -= 16 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rot[0] += p.vr[0] * dt; p.rot[1] += p.vr[1] * dt;
      if (p.y < p.size / 2) {
        p.y = p.size / 2;
        p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6;
        p.vr[0] *= 0.5; p.vr[1] *= 0.5;
      }
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  }

  // ---------------------------------------------------------------- rendering
  draw(list) {
    const L = this.level;
    if (!L) return;
    const A = this.assets, m = A.meshes, t = A.tex;
    drawField(list, A, L, this.time);

    for (let r = 0; r < L.rows; r++) {
      for (let c = 0; c < L.cols; c++) {
        for (const b of this.grid[r][c]) drawBrick(list, A, L, b.def, r, c, b.y, { hitsLeft: b.hits, flash: b.flash });
      }
    }

    // bat
    const bat = this.bat;
    if (bat.alive) {
      const y = BAT_R + 0.02, sq = 1 + bat.bounce * 0.25;
      const laser = this.effects.laser > 0, caught = this.effects.catch > 0;
      list.push(item(m.cylinder, [bat.x, y, bat.z], null, [bat.half * 2, BAT_R, BAT_R * sq], {
        tex: t.bat, color: caught ? [0.7, 1, 0.75] : [1, 1, 1], spec: 0.9,
      }));
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 10);
      const capColor = laser ? [1, 0.25, 0.2] : caught ? [0.3, 0.9, 0.4] : [0.95, 0.3, 0.35];
      for (const s of [-1, 1]) {
        list.push(item(m.sphere, [bat.x + s * bat.half, y, bat.z], null, [BAT_R * 1.18, BAT_R * 1.18, BAT_R * 1.18 * sq], {
          color: capColor, spec: 0.9, emissive: laser ? [0.6 * pulse, 0.05, 0.02] : null,
        }));
        if (laser) {
          list.push(item(m.box, [bat.x + s * bat.half * 0.85, y + 0.22, bat.z - 0.05], null, [0.1, 0.22, 0.24], {
            color: [0.3, 0.3, 0.35], tex: t.steel, spec: 0.7,
          }));
          list.push(item(m.box, [bat.x + s * bat.half * 0.85, y + 0.28, bat.z - 0.19], null, [0.06, 0.06, 0.06], {
            color: [1, 0.3, 0.2], emissive: [0.9 * pulse, 0.2, 0.1], shadow: false,
          }));
        }
      }
    }

    // balls (+ glowing trail)
    const mega = this.effects.mega > 0;
    for (const b of this.balls) {
      const y = b.stuck ? BALL_R : this.ballY(b);
      list.push(item(m.sphere, [b.x, y, b.z], null, [BALL_R, BALL_R, BALL_R], {
        color: mega ? [1, 0.45, 1] : [1, 1, 1], spec: 1.2, emissive: mega ? [0.5, 0.1, 0.5] : [0.12, 0.12, 0.15],
      }));
      b.trail.forEach((p, i) => {
        const a = (1 - i / b.trail.length) * 0.35;
        const s = BALL_R * (1 - i / (b.trail.length + 2));
        list.push(item(m.sphereLow, p, null, [s, s, s], {
          color: mega ? [1, 0.3, 1] : [0.6, 0.85, 1], alpha: a, additive: true, unlit: true, shadow: false,
        }));
      });
    }

    for (const bolt of this.bolts) {
      list.push(item(m.box, [bolt.x, 0.3, bolt.z], null, [0.07, 0.07, 0.55], {
        color: [1, 0.5, 0.3], emissive: [1, 0.3, 0.1], unlit: true, shadow: false,
      }));
    }

    for (const k of this.capsules) {
      const [color] = BONUS_STYLE[k.type];
      const c = rgb(color);
      list.push(item(m.capsule, [k.x, 0.24 + Math.sin(k.spin) * 0.04, k.z], [k.spin, 0, 0], [0.15, 0.15, 0.15], {
        tex: t['capsule_' + k.type], spec: 1, emissive: [c[0] * 0.25, c[1] * 0.25, c[2] * 0.25],
      }));
      list.push(item(m.quad, [k.x, 0.01, k.z], null, [1.2, 1, 0.7], {
        tex: t.glow, color: c, alpha: 0.6, additive: true, unlit: true, shadow: false,
      }));
    }

    for (const cr of this.critters) this.drawCritter(list, cr);

    for (const p of this.particles) {
      const a = Math.min(1, p.life / 0.4);
      if (p.spark) {
        list.push(item(m.sphereLow, [p.x, p.y, p.z], null, [p.size, p.size, p.size], {
          color: p.color, alpha: a, additive: true, unlit: true, shadow: false,
        }));
        continue;
      }
      const hot = p.hot ? Math.max(0, p.life - 0.6) : 0;
      list.push(item(m.box, [p.x, p.y, p.z], [p.rot[0], p.rot[1], 0], [p.size, p.size, p.size], {
        color: p.color, tex: p.tex || null, alpha: a, emissive: hot ? [hot, hot * 0.5, 0] : null,
      }));
    }
  }

  drawCritter(list, cr) {
    const m = this.assets.meshes, t = this.assets.tex;
    const s = 0.3 + cr.spawn * 0.7;
    const bob = Math.abs(Math.sin(cr.phase)) * 0.05;
    const f = cr.flinch / 0.3; // squash + flash when the ball bounces off it
    const parent = compose(mat4(), [cr.x, cr.y + bob, cr.z], [0, cr.heading, 0], [s * (1 + f * 0.25), s * (1 - f * 0.3), s * (1 + f * 0.25)]);
    list.push(childItem(parent, m.sphere, [0, 0.3, 0], [0.15, 0, 0], [0.3, 0.24, 0.34], {
      tex: t.critter, spec: 0.5, emissive: f ? [f * 0.5, f * 0.5, f * 0.4] : null,
    }));
    for (const sx of [-1, 1]) {
      list.push(childItem(parent, m.sphere, [sx * 0.12, 0.44, 0.22], null, [0.09, 0.1, 0.09], { color: [1, 1, 1], spec: 1 }));
      list.push(childItem(parent, m.sphereLow, [sx * 0.12, 0.45, 0.3], null, [0.045, 0.05, 0.03], { color: [0.05, 0.05, 0.05] }));
      // antennae
      list.push(childItem(parent, m.box, [sx * 0.08, 0.58, 0.05], [0, 0, sx * -0.4], [0.025, 0.22, 0.025], { color: [0.3, 0.5, 0.2] }));
      list.push(childItem(parent, m.sphereLow, [sx * 0.13, 0.69, 0.05], null, [0.045, 0.045, 0.045], {
        color: [1, 0.2, 0.2], emissive: [0.8, 0.1, 0.1], shadow: false,
      }));
      // legs, alternating stride
      for (const sz of [-1, 1]) {
        const swing = Math.sin(cr.phase + (sx * sz > 0 ? 0 : Math.PI)) * 0.6;
        list.push(childItem(parent, m.box, [sx * 0.24, 0.1, sz * 0.14], [swing, 0, sx * 0.4], [0.06, 0.22, 0.06], { color: [0.35, 0.6, 0.25] }));
      }
    }
    // mouth
    list.push(childItem(parent, m.box, [0, 0.24, 0.32], [0.3, 0, 0], [0.16, 0.03, 0.03], { color: [0.4, 0.05, 0.05] }));
  }

  // ---------------------------------------------------------------- autopilot
  // Simple AI used for the attract mode behind the menu and for automated tests.
  autopilot() {
    const L = this.level, bat = this.bat, W2 = L.width / 2;
    let threat = null;
    for (const b of this.balls) {
      if (b.stuck || b.vz <= 0) continue;
      if (!threat || b.z > threat.z) threat = b;
    }
    if (this.autoAim == null) this.autoAim = 0;
    let targetX = bat.x;
    if (threat) {
      // predict where the ball crosses the bat line, folding wall reflections
      const t = (bat.z - BAT_R - BALL_R - threat.z) / threat.vz;
      const span = 2 * (W2 - BALL_R);
      let x = threat.x + threat.vx * t + W2 - BALL_R;
      x = ((x % (2 * span)) + 2 * span) % (2 * span);
      if (x > span) x = 2 * span - x;
      targetX = x - W2 + BALL_R - this.autoAim * bat.half;
    } else if (this.capsules.length) {
      targetX = this.capsules.reduce((a, k) => (k.z > a.z ? k : a)).x;
    } else if (this.balls[0]) {
      targetX = this.balls[0].x;
    }
    // dodge critters that are about to reach the bat line when no ball is incoming
    for (const cr of this.critters) {
      if (cr.z > bat.z - 2.5 && Math.abs(cr.x - bat.x) < bat.half + 1 && (!threat || threat.z < bat.z - 4)) {
        targetX = cr.x > 0 ? -W2 : W2;
      }
    }
    if (Math.random() < 0.01) this.autoAim = (Math.random() - 0.5) * 1.2;
    const stuck = this.balls.some((b) => b.stuck);
    return {
      targetX, axis: 0,
      firePressed: (stuck && Math.random() < 0.02) || (this.effects.laser > 0 && Math.random() < 0.2),
      fireHeld: this.effects.laser > 0,
    };
  }

  // ---------------------------------------------------------------- HUD helpers
  getMessage() {
    switch (this.state) {
      case 'play': {
        const serving = this.balls.some((b) => b.serve);
        if (serving) {
          const L = this.level;
          const intro = this.levelTime < 3;
          return { title: intro ? t('msg.level', { n: this.levelIndex + 1 }) : '', sub: intro ? localized(L, 'name') : '', hint: t('msg.launch') };
        }
        return null;
      }
      case 'dying': return { title: t(this.deathReason === 'critter' ? 'msg.critterAttack' : 'msg.ballLost'), sub: tn('msg.livesLeft', this.lives) };
      case 'clear': return { title: t('msg.clear'), sub: t('msg.bonus', { n: this.clearBonus }) };
      case 'over': return { title: t('msg.over'), sub: t(this.overReason), hint: t('msg.toMenu') };
      case 'won': return { title: t(this.testMode ? 'msg.testDone' : 'msg.win'), sub: t('msg.final', { n: this.score }), hint: t('msg.return') };
      default: return null;
    }
  }
}
