// Tiny, dependency-free linear algebra for small dense vectors/matrices.
// Vectors are plain number[]. Matrices are number[][] (row-major).
// Everything here is sized n<=~24, r<=~6, so naive O(r^3) is fine.

export const add = (a, b) => a.map((x, i) => x + b[i]);
export const sub = (a, b) => a.map((x, i) => x - b[i]);
export const scale = (a, s) => a.map((x) => x * s);
export const lerp = (a, b, t) => a.map((x, i) => (1 - t) * x + t * b[i]);
export const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
export const norm = (a) => Math.sqrt(dot(a, a));
export const dist = (a, b) => norm(sub(a, b));
export const zeros = (n) => new Array(n).fill(0);

export function normalize(a) {
  const n = norm(a);
  return n < 1e-12 ? a.slice() : scale(a, 1 / n);
}

export function gaussianVec(n, rng) {
  return Array.from({ length: n }, () => rng.gauss());
}

// A·x where A is m×k (rows), x is length k → length m
export function matVec(A, x) {
  return A.map((row) => dot(row, x));
}

// A·B, A is m×k, B is k×p
export function matMul(A, B) {
  const m = A.length, k = B.length, p = B[0].length;
  const out = Array.from({ length: m }, () => zeros(p));
  for (let i = 0; i < m; i++)
    for (let j = 0; j < p; j++) {
      let s = 0;
      for (let t = 0; t < k; t++) s += A[i][t] * B[t][j];
      out[i][j] = s;
    }
  return out;
}

export function transpose(A) {
  const m = A.length, n = A[0].length;
  const out = Array.from({ length: n }, () => zeros(m));
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) out[j][i] = A[i][j];
  return out;
}

export function identity(n) {
  const I = Array.from({ length: n }, () => zeros(n));
  for (let i = 0; i < n; i++) I[i][i] = 1;
  return I;
}

// ---- column basis ----------------------------------------------------------
// Return r orthonormal columns in R^n as an array of r length-n vectors (column-major).
// Modified Gram–Schmidt on random Gaussian columns.
export function columnOrthonormal(n, r, rng) {
  const cols = [];
  for (let k = 0; k < r; k++) {
    let v = gaussianVec(n, rng);
    for (const q of cols) v = sub(v, scale(q, dot(v, q)));
    cols.push(normalize(v));
  }
  return cols; // cols[k] is the k-th orthonormal column (length n)
}

// s = U·c, where U is given as columns (each length n), c length r
export function fromLatent(Ucols, c) {
  const n = Ucols[0].length;
  const out = zeros(n);
  for (let k = 0; k < c.length; k++)
    for (let i = 0; i < n; i++) out[i] += c[k] * Ucols[k][i];
  return out;
}

// c = Uᵀ·s (exact recovery when s ∈ col(U) and columns orthonormal)
export function toLatent(Ucols, s) {
  return Ucols.map((col) => dot(col, s));
}

// random orthogonal r×r matrix (rows), via Gram–Schmidt on Gaussian
export function randomOrthogonal(r, rng) {
  const cols = columnOrthonormal(r, r, rng); // r orthonormal columns in R^r
  // assemble as rows of a matrix A where A·x rotates x: use the columns as basis
  const A = Array.from({ length: r }, () => zeros(r));
  for (let j = 0; j < r; j++) for (let i = 0; i < r; i++) A[i][j] = cols[j][i];
  return A;
}

// ---- small symmetric eigenvalues (Jacobi) for rank/conditioning checks -----
export function jacobiEig(Sin, sweeps = 60) {
  const n = Sin.length;
  const S = Sin.map((row) => row.slice());
  for (let sweep = 0; sweep < sweeps; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += S[p][q] * S[p][q];
    if (off < 1e-18) break;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(S[p][q]) < 1e-15) continue;
        const theta = (S[q][q] - S[p][p]) / (2 * S[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const skp = S[k][p], skq = S[k][q];
          S[k][p] = c * skp - s * skq;
          S[k][q] = s * skp + c * skq;
        }
        for (let k = 0; k < n; k++) {
          const spk = S[p][k], sqk = S[q][k];
          S[p][k] = c * spk - s * sqk;
          S[q][k] = s * spk + c * sqk;
        }
      }
  }
  return S.map((row, i) => row[i]).sort((a, b) => b - a); // eigenvalues, descending
}

// singular values of A (m×r) via eig of AᵀA
export function singularValues(A) {
  const At = transpose(A);
  const G = matMul(At, A); // r×r
  return jacobiEig(G).map((e) => Math.sqrt(Math.max(0, e)));
}

// ---- small linear solve (Gaussian elimination with partial pivoting) -------
// Solve A·x = b for square A (n×n). Returns null if singular.
export function solve(Ain, bin) {
  const n = Ain.length;
  const A = Ain.map((row, i) => [...row, bin[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-12) return null;
    [A[col], A[piv]] = [A[piv], A[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      for (let c = col; c <= n; c++) A[r][c] -= f * A[col][c];
    }
  }
  // after full elimination A is diagonal; x[i] = A[i][n] / A[i][i]
  return A.map((row, i) => row[n] / row[i]);
}

