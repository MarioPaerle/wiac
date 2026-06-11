// Player-side data analysis over SNAPSHOT data (revealed measurements only — no hidden vectors).
// Runtime-neutral: imported by both the CLI and the web UI.

// Substances that have ALL the given measures revealed → { ids, names, X (rows) }.
export function collectMatrix(snapshot, measureIds) {
  const ids = [], names = [], X = [];
  for (const s of snapshot.substances) {
    if (measureIds.every((m) => s.measurements[m] != null)) {
      ids.push(s.id); names.push(s.name);
      X.push(measureIds.map((m) => s.measurements[m]));
    }
  }
  return { ids, names, X };
}

export function standardize(X) {
  if (X.length === 0) return { Z: [], mean: [], std: [] };
  const d = X[0].length;
  const mean = new Array(d).fill(0), std = new Array(d).fill(0);
  for (const row of X) row.forEach((v, j) => (mean[j] += v));
  mean.forEach((_, j) => (mean[j] /= X.length));
  for (const row of X) row.forEach((v, j) => (std[j] += (v - mean[j]) ** 2));
  std.forEach((_, j) => (std[j] = Math.sqrt(std[j] / Math.max(1, X.length)) || 1));
  const Z = X.map((row) => row.map((v, j) => (v - mean[j]) / std[j]));
  return { Z, mean, std };
}

export function pearson(a, b) {
  const n = a.length;
  if (n < 2) return NaN;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2;
  }
  const den = Math.sqrt(da * db);
  return den < 1e-12 ? NaN : num / den;
}

// Correlation matrix across measures, using pairwise-complete substances.
export function correlationMatrix(snapshot) {
  const ms = snapshot.measures.map((m) => m.id);
  const mat = ms.map(() => ms.map(() => NaN));
  for (let i = 0; i < ms.length; i++)
    for (let j = i; j < ms.length; j++) {
      const a = [], b = [];
      for (const s of snapshot.substances) {
        const va = s.measurements[ms[i]], vb = s.measurements[ms[j]];
        if (va != null && vb != null) { a.push(va); b.push(vb); }
      }
      const r = i === j ? 1 : pearson(a, b);
      mat[i][j] = r; mat[j][i] = r;
    }
  return { labels: snapshot.measures.map((m) => m.label), ids: ms, matrix: mat };
}

// Deterministic k-means on standardized rows. Init = farthest-point (k-means++ flavour, no RNG).
export function kmeans(Z, k, iters = 30) {
  if (Z.length === 0) return { assign: [], centroids: [] };
  k = Math.min(k, Z.length);
  const dist2 = (a, b) => a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0);
  const centroids = [Z[0]];
  while (centroids.length < k) {
    let best = -1, bestD = -1;
    for (let i = 0; i < Z.length; i++) {
      const d = Math.min(...centroids.map((c) => dist2(Z[i], c)));
      if (d > bestD) { bestD = d; best = i; }
    }
    centroids.push(Z[best]);
  }
  let assign = new Array(Z.length).fill(0);
  for (let it = 0; it < iters; it++) {
    assign = Z.map((z) => {
      let bi = 0, bd = Infinity;
      centroids.forEach((c, ci) => { const d = dist2(z, c); if (d < bd) { bd = d; bi = ci; } });
      return bi;
    });
    for (let ci = 0; ci < k; ci++) {
      const members = Z.filter((_, i) => assign[i] === ci);
      if (members.length === 0) continue;
      centroids[ci] = members[0].map((_, j) => members.reduce((s, m) => s + m[j], 0) / members.length);
    }
  }
  return { assign, centroids };
}

// Least-squares quadratic fit y ≈ A2·x² + A1·x + A0 over points [{x,y}] (needs ≥3 distinct x).
export function fitQuad(points) {
  const xs = new Set(points.map((p) => +p.x.toFixed(6)));
  if (points.length < 3 || xs.size < 3) return null;
  // normal equations for [x², x, 1]
  let Sxx4 = 0, Sxx3 = 0, Sxx2 = 0, Sx = 0, S0 = 0, Tx2 = 0, Tx = 0, T = 0;
  for (const { x, y } of points) {
    const x2 = x * x;
    Sxx4 += x2 * x2; Sxx3 += x2 * x; Sxx2 += x2; Sx += x; S0 += 1;
    Tx2 += y * x2; Tx += y * x; T += y;
  }
  const M = [[Sxx4, Sxx3, Sxx2], [Sxx3, Sxx2, Sx], [Sxx2, Sx, S0]];
  const sol = solveLinear(M, [Tx2, Tx, T]);
  return sol ? { A2: sol[0], A1: sol[1], A0: sol[2] } : null;
}

// roots of A2·x²+A1·x+(A0−T) within [0,1]
export function quadRootsInUnit(A2, A1, A0, T) {
  const c0 = A0 - T, out = [];
  if (Math.abs(A2) < 1e-9) { if (Math.abs(A1) > 1e-12) { const x = -c0 / A1; if (x >= 0 && x <= 1) out.push(x); } return out; }
  const disc = A1 * A1 - 4 * A2 * c0;
  if (disc < 0) return out;
  const sq = Math.sqrt(disc);
  for (const x of [(-A1 + sq) / (2 * A2), (-A1 - sq) / (2 * A2)]) if (x >= -1e-9 && x <= 1 + 1e-9) out.push(Math.max(0, Math.min(1, x)));
  return out;
}

// tiny Gaussian-elimination solve (kept local so analysis stays engine-independent)
function solveLinear(Ain, bin) {
  const n = Ain.length, A = Ain.map((row, i) => [...row, bin[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-12) return null;
    [A[col], A[piv]] = [A[piv], A[col]];
    for (let r = 0; r < n; r++) { if (r === col) continue; const f = A[r][col] / A[col][col]; for (let c = col; c <= n; c++) A[r][c] -= f * A[col][c]; }
  }
  return A.map((row, i) => row[n] / row[i]);
}

// Euclidean distance between two substances in standardized known-measure space.
export function substanceDistance(snapshot, idA, idB) {
  const ms = snapshot.measures.map((m) => m.id).filter((m) => {
    const a = snapshot.substances.find((s) => s.id === idA)?.measurements[m];
    const b = snapshot.substances.find((s) => s.id === idB)?.measurements[m];
    return a != null && b != null;
  });
  if (ms.length === 0) return null;
  const { Z, ids } = (() => {
    const sub = { ...snapshot };
    const cm = collectMatrix(snapshot, ms);
    const { Z } = standardize(cm.X);
    return { Z, ids: cm.ids };
  })();
  const ia = ids.indexOf(idA), ib = ids.indexOf(idB);
  if (ia < 0 || ib < 0) return null;
  return Math.sqrt(Z[ia].reduce((s, x, i) => s + (x - Z[ib][i]) ** 2, 0));
}
