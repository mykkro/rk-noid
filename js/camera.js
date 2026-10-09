// Orbit camera with smooth transitions, perspective/orthographic modes and picking rays.
import { mat4, multiply, perspective, ortho, lookAt, invert, transformVec4, clamp } from './math.js';

export const CAMERA_PRESETS = [
  { id: 'iso', name: 'Isometric', yaw: 0.52, pitch: 0.66, dist: 1.0, ortho: true },
  { id: 'iso45', name: 'True iso 45°', yaw: Math.PI / 4, pitch: 0.6155, dist: 1.0, ortho: true },
  { id: 'arcade', name: 'Arcade', yaw: 0, pitch: 0.95, dist: 1.0, ortho: false },
  { id: 'chase', name: 'Low chase', yaw: 0, pitch: 0.42, dist: 0.8, ortho: false },
  { id: 'top', name: 'Top-down', yaw: 0, pitch: 1.5, dist: 1.05, ortho: true },
];

export class OrbitCamera {
  constructor() {
    this.target = [0, 0, 0];
    this.yaw = 0.5; this.pitch = 0.7; this.dist = 20;
    this.goal = { yaw: this.yaw, pitch: this.pitch, dist: this.dist };
    this.ortho = true;
    this.orthoBlend = 1; // 1 = ortho, 0 = perspective (animated)
    this.fov = 0.7;
    this.baseDist = 20;
    this.shake = 0;
    this.view = mat4();
    this.proj = mat4();
    this.viewProj = mat4();
    this.invViewProj = mat4();
    this.eye = new Float32Array(3);
    this.presetIndex = 0;
  }

  frame(target, size) {
    this.target = target;
    this.baseDist = size;
  }

  applyPreset(i, instant = false) {
    this.presetIndex = (i + CAMERA_PRESETS.length) % CAMERA_PRESETS.length;
    const p = CAMERA_PRESETS[this.presetIndex];
    // pick the equivalent yaw closest to the current one (no full spins)
    const turns = Math.round((this.yaw - p.yaw) / (Math.PI * 2));
    this.goal = { yaw: p.yaw + turns * Math.PI * 2, pitch: p.pitch, dist: p.dist * this.baseDist };
    this.ortho = p.ortho;
    if (instant) {
      this.yaw = this.goal.yaw; this.pitch = this.goal.pitch; this.dist = this.goal.dist;
      this.orthoBlend = p.ortho ? 1 : 0;
    }
    return p;
  }

  orbit(dx, dy) {
    this.goal.yaw -= dx * 0.008;
    this.goal.pitch = clamp(this.goal.pitch + dy * 0.008, 0.12, 1.55);
  }

  zoom(delta) {
    this.goal.dist = clamp(this.goal.dist * Math.pow(1.1, delta), this.baseDist * 0.35, this.baseDist * 2.5);
  }

  update(dt, aspect) {
    const k = 1 - Math.exp(-dt * 8);
    this.yaw += (this.goal.yaw - this.yaw) * k;
    this.pitch += (this.goal.pitch - this.pitch) * k;
    this.dist += (this.goal.dist - this.dist) * k;
    this.orthoBlend += ((this.ortho ? 1 : 0) - this.orthoBlend) * k;

    const t = this.target;
    const cp = Math.cos(this.pitch);
    // In "ortho" we still use a perspective camera, pushed far away with a narrow FOV.
    // Blending the FOV gives a smooth dolly-zoom between the two modes.
    const fovP = this.fov, fovO = 0.06;
    const fov = fovP + (fovO - fovP) * this.orthoBlend;
    // keep framing constant; on narrow/portrait viewports pull back so the width still fits
    const fit = Math.max(1, 1.45 / aspect);
    const viewH = 2 * this.dist * fit * Math.tan(fovP / 2);
    const d = viewH / (2 * Math.tan(fov / 2));
    let sx = 0, sy = 0;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      sx = (Math.random() - 0.5) * this.shake * 0.6;
      sy = (Math.random() - 0.5) * this.shake * 0.6;
    }
    const center = [t[0] + sx, t[1] + sy, t[2]];
    this.eye[0] = center[0] + d * cp * Math.sin(this.yaw);
    this.eye[1] = center[1] + d * Math.sin(this.pitch);
    this.eye[2] = center[2] + d * cp * Math.cos(this.yaw);
    lookAt(this.view, this.eye, center, [0, 1, 0]);
    if (this.orthoBlend > 0.999) {
      const hh = viewH / 2;
      ortho(this.proj, -hh * aspect, hh * aspect, -hh, hh, 0.1, d + this.baseDist * 4);
    } else {
      perspective(this.proj, fov, aspect, Math.max(0.1, d - this.baseDist * 2), d + this.baseDist * 4);
    }
    multiply(this.viewProj, this.proj, this.view);
    invert(this.invViewProj, this.viewProj);
  }

  // Ray from normalized device coords (-1..1).
  ray(nx, ny) {
    const a = transformVec4([0, 0, 0, 0], this.invViewProj, [nx, ny, -1, 1]);
    const b = transformVec4([0, 0, 0, 0], this.invViewProj, [nx, ny, 1, 1]);
    const o = [a[0] / a[3], a[1] / a[3], a[2] / a[3]];
    const e = [b[0] / b[3], b[1] / b[3], b[2] / b[3]];
    const dir = [e[0] - o[0], e[1] - o[1], e[2] - o[2]];
    const l = Math.hypot(...dir);
    return { o, d: [dir[0] / l, dir[1] / l, dir[2] / l] };
  }

  // Intersection of a picking ray with the horizontal plane y = h.
  pickPlane(nx, ny, h = 0) {
    const { o, d } = this.ray(nx, ny);
    if (Math.abs(d[1]) < 1e-5) return null;
    const t = (h - o[1]) / d[1];
    if (t < 0) return null;
    return [o[0] + d[0] * t, h, o[2] + d[2] * t];
  }

  // Screen-space right vector projected on the ground (for keyboard control).
  rightX() {
    return Math.cos(this.yaw);
  }
}
