// Small WebGL2 forward renderer: textured Blinn-Phong + hemisphere ambient,
// one directional light with a PCF shadow map, and an alpha-blended pass.
import { mat4, multiply, lookAt, ortho, normalize3 } from './math.js';

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
uniform mat4 uModel, uViewProj, uLightVP;
uniform mat3 uNMat;
uniform vec2 uUVScale;
out vec3 vWorld; out vec3 vNormal; out vec2 vUV; out vec4 vLightPos;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  vNormal = uNMat * aNormal;
  vUV = aUV * uUVScale;
  vLightPos = uLightVP * w;
  gl_Position = uViewProj * w;
}`;

const FS = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vWorld; in vec3 vNormal; in vec2 vUV; in vec4 vLightPos;
uniform sampler2D uTex;
uniform sampler2DShadow uShadow;
uniform vec3 uColor, uEmissive, uLightDir, uCamPos, uFogColor;
uniform float uAlpha, uShadowOn, uSpec, uUnlit;
uniform vec2 uFog;
out vec4 outColor;

float shadowAt() {
  vec3 p = vLightPos.xyz / vLightPos.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  vec2 ts = 1.0 / vec2(textureSize(uShadow, 0));
  float s = 0.0;
  for (int x = -1; x <= 1; x++)
    for (int y = -1; y <= 1; y++)
      s += texture(uShadow, vec3(p.xy + vec2(x, y) * ts * 1.2, p.z - 0.0012));
  return s / 9.0;
}

void main() {
  vec4 tex = texture(uTex, vUV);
  vec3 base = tex.rgb * uColor;
  if (uUnlit > 0.5) { outColor = vec4(base + uEmissive, uAlpha * tex.a); return; }
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  float sh = uShadowOn > 0.5 ? shadowAt() : 1.0;
  float ndl = max(dot(n, uLightDir), 0.0);
  vec3 hemi = mix(vec3(0.20, 0.17, 0.26), vec3(0.46, 0.50, 0.62), n.y * 0.5 + 0.5);
  vec3 V = normalize(uCamPos - vWorld);
  vec3 H = normalize(V + uLightDir);
  float spec = pow(max(dot(n, H), 0.0), 40.0) * uSpec * sh;
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0) * 0.18;
  vec3 col = base * (hemi + vec3(1.0, 0.94, 0.84) * ndl * sh * 0.95) + vec3(spec) + rim * base + uEmissive;
  float d = length(uCamPos - vWorld);
  float f = clamp((d - uFog.x) / (uFog.y - uFog.x), 0.0, 1.0);
  col = mix(col, uFogColor, f * 0.6);
  outColor = vec4(col, uAlpha * tex.a);
}`;

const SHADOW_VS = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uModel, uLightVP;
void main() { gl_Position = uLightVP * uModel * vec4(aPos, 1.0); }`;

const SHADOW_FS = `#version 300 es
precision mediump float;
void main() {}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    u[info.name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

export class Renderer {
  constructor(canvas, { shadowSize = 2048 } = {}) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 is not supported by this browser.');
    this.gl = gl;
    this.canvas = canvas;
    this.main = program(gl, VS, FS);
    this.shadow = program(gl, SHADOW_VS, SHADOW_FS);
    this.shadowSize = shadowSize;
    this.lightVP = mat4();
    this.viewProj = mat4();
    this.fogColor = [0.08, 0.07, 0.14];
    this.fog = [30, 80];
    this.lightDir = normalize3([-0.45, 1.0, 0.55]);
    this._initShadow();
    // 1x1 white texture used for untextured meshes
    this.white = this.createTexture(null);
  }

  _initShadow() {
    const gl = this.gl;
    this.shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, this.shadowSize, this.shadowSize);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.shadowFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  createMesh({ positions, normals, uvs, indices }) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = (data, loc, size) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    buf(positions, 0, 3);
    buf(normals, 1, 3);
    buf(uvs, 2, 2);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: indices.length };
  }

  // source: a canvas (or null for a 1x1 white texel)
  createTexture(source, { repeat = true } = {}) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (source) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
      if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    }
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    return w / h;
  }

  // Fit the orthographic light frustum around the play field.
  setLightFrame(center, radius) {
    const d = this.lightDir;
    const eye = [center[0] + d[0] * radius * 2, center[1] + d[1] * radius * 2, center[2] + d[2] * radius * 2];
    const view = lookAt(mat4(), eye, center, [0, 1, 0]);
    const proj = ortho(mat4(), -radius, radius, -radius, radius, 0.1, radius * 4);
    multiply(this.lightVP, proj, view);
  }

  /**
   * items: [{ mesh, model, nmat, color, tex, emissive, alpha, uvScale, spec, unlit, shadow }]
   * camera: { viewProj, eye }
   */
  render(items, camera) {
    const gl = this.gl;
    // --- shadow pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.viewport(0, 0, this.shadowSize, this.shadowSize);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2, 4);
    gl.disable(gl.CULL_FACE);
    const sp = this.shadow;
    gl.useProgram(sp.p);
    gl.uniformMatrix4fv(sp.u.uLightVP, false, this.lightVP);
    for (const it of items) {
      if (it.shadow === false || (it.alpha ?? 1) < 0.99) continue;
      gl.uniformMatrix4fv(sp.u.uModel, false, it.model);
      gl.bindVertexArray(it.mesh.vao);
      gl.drawElements(gl.TRIANGLES, it.mesh.count, gl.UNSIGNED_SHORT, 0);
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // --- main pass
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    const mp = this.main;
    const u = mp.u;
    gl.useProgram(mp.p);
    gl.uniformMatrix4fv(u.uViewProj, false, camera.viewProj);
    gl.uniformMatrix4fv(u.uLightVP, false, this.lightVP);
    gl.uniform3fv(u.uLightDir, this.lightDir);
    gl.uniform3fv(u.uCamPos, camera.eye);
    gl.uniform3fv(u.uFogColor, this.fogColor);
    gl.uniform2fv(u.uFog, this.fog);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.uniform1i(u.uShadow, 1);
    gl.uniform1i(u.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);

    const draw = (it) => {
      gl.uniformMatrix4fv(u.uModel, false, it.model);
      gl.uniformMatrix3fv(u.uNMat, false, it.nmat);
      gl.uniform3fv(u.uColor, it.color || WHITE);
      gl.uniform3fv(u.uEmissive, it.emissive || BLACK);
      gl.uniform1f(u.uAlpha, it.alpha ?? 1);
      gl.uniform2fv(u.uUVScale, it.uvScale || ONE2);
      gl.uniform1f(u.uSpec, it.spec ?? 0.25);
      gl.uniform1f(u.uUnlit, it.unlit ? 1 : 0);
      gl.uniform1f(u.uShadowOn, it.receiveShadow === false ? 0 : 1);
      gl.bindTexture(gl.TEXTURE_2D, it.tex || this.white);
      gl.bindVertexArray(it.mesh.vao);
      gl.drawElements(gl.TRIANGLES, it.mesh.count, gl.UNSIGNED_SHORT, 0);
    };

    const transparent = [];
    gl.disable(gl.BLEND);
    for (const it of items) {
      if ((it.alpha ?? 1) < 0.99 || it.additive) transparent.push(it);
      else draw(it);
    }
    if (transparent.length) {
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      for (const it of transparent) {
        if (it.additive) gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE);
        else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        draw(it);
      }
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
    gl.bindVertexArray(null);
  }
}

const WHITE = new Float32Array([1, 1, 1]);
const BLACK = new Float32Array([0, 0, 0]);
const ONE2 = new Float32Array([1, 1]);
