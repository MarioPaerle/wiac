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
