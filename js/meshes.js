// Procedural geometry. All meshes are unit-sized and scaled via model matrices.

export function box() {
  // Unit cube centred on the origin; each face gets its own 0..1 UVs.
  const faces = [
    { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
    { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
  ];
  const positions = [], normals = [], uvs = [], indices = [];
  for (const f of faces) {
    const base = positions.length / 3;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      positions.push(
        (f.n[0] + f.u[0] * a + f.v[0] * b) * 0.5,
        (f.n[1] + f.u[1] * a + f.v[1] * b) * 0.5,
        (f.n[2] + f.u[2] * a + f.v[2] * b) * 0.5,
      );
      normals.push(...f.n);
      uvs.push((a + 1) / 2, 1 - (b + 1) / 2);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, normals, uvs, indices };
}

export function sphere(seg = 20, rings = 14) {
  const positions = [], normals = [], uvs = [], indices = [];
  for (let r = 0; r <= rings; r++) {
    const th = (r / rings) * Math.PI;
    for (let s = 0; s <= seg; s++) {
      const ph = (s / seg) * Math.PI * 2;
      const x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
      positions.push(x, y, z);
      normals.push(x, y, z);
      uvs.push(s / seg, r / rings);
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < seg; s++) {
      const a = r * (seg + 1) + s, b = a + seg + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  return { positions, normals, uvs, indices };
}

// Open cylinder along the X axis, radius 1, length 1 (x in -0.5..0.5).
export function cylinderX(seg = 24) {
  const positions = [], normals = [], uvs = [], indices = [];
  for (let i = 0; i <= 1; i++) {
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      const y = Math.cos(a), z = Math.sin(a);
      positions.push(i - 0.5, y, z);
      normals.push(0, y, z);
      uvs.push(i, s / seg);
    }
  }
  for (let s = 0; s < seg; s++) {
    const a = s, b = s + seg + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  return { positions, normals, uvs, indices };
}

// Pill shape along X: radius 1, cylindrical part from -half..half.
export function capsuleX(half = 1, seg = 20, rings = 16) {
  const positions = [], normals = [], uvs = [], indices = [];
  const total = rings + 1; // rings + duplicated equator
  let row = 0;
  for (let r = 0; r <= rings; r++) {
    const th = (r / rings) * Math.PI;
    const copies = r === rings / 2 ? 2 : 1;
    for (let c = 0; c < copies; c++) {
      const nx = Math.cos(th);
      const shift = r < rings / 2 || (r === rings / 2 && c === 0) ? half : -half;
      for (let s = 0; s <= seg; s++) {
        const ph = (s / seg) * Math.PI * 2;
        const ny = Math.sin(th) * Math.cos(ph), nz = Math.sin(th) * Math.sin(ph);
        positions.push(nx + shift, ny, nz);
        normals.push(nx, ny, nz);
        uvs.push(row / total, s / seg);
      }
      row++;
    }
  }
  for (let r = 0; r < total; r++) {
    for (let s = 0; s < seg; s++) {
      const a = r * (seg + 1) + s, b = a + seg + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return { positions, normals, uvs, indices };
}

// Flat quad in the XZ plane facing +Y (used for blob shadows / glows).
export function quadY() {
  return {
    positions: [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5],
    normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    uvs: [0, 0, 1, 0, 1, 1, 0, 1],
    indices: [0, 2, 1, 0, 3, 2],
  };
}
