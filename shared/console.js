// A tiny numpy-STYLE compute console (JS, zero-build, runs in CLI and browser identically).
// It sees only SNAPSHOT data (measured values) — no hidden vectors. The scientist's scratchpad:
// slice the data matrix, fit models, predict hidden instruments from the others.
//
// Note: this is JavaScript with a numpy-like `np` library (np.mean, np.polyfit, np.lstsq, ...),
// not literal CPython. It stays dependency-free so the same code works offline in both UIs.

function flat1(x) { return Array.isArray(x) ? x : [x]; }
function nums(x) { return flat1(x).filter((v) => typeof v === "number" && Number.isFinite(v)); }
const ew = (f) => (x) => (Array.isArray(x) ? x.map((v) => (typeof v === "number" ? f(v) : v)) : f(x));

// solve A x = b (square, Gaussian elimination)
function gsolve(Ain, bin) {
  const n = Ain.length, A = Ain.map((r, i) => [...r, bin[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < n; r++) { if (r === c) continue; const f = A[r][c] / A[c][c]; for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]; }
  }
  return A.map((r, i) => r[n] / r[i]);
}

const np = {
  mean: (x) => { const a = nums(x); return a.reduce((s, v) => s + v, 0) / (a.length || 1); },
  sum: (x) => nums(x).reduce((s, v) => s + v, 0),
  std: (x) => { const a = nums(x), m = np.mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length || 1)); },
  min: (x) => Math.min(...nums(x)), max: (x) => Math.max(...nums(x)),
  median: (x) => { const a = nums(x).sort((p, q) => p - q); const n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : NaN; },
  abs: ew(Math.abs), sqrt: ew(Math.sqrt), exp: ew(Math.exp), log: ew(Math.log), round: ew((v) => Math.round(v * 1000) / 1000),
  linspace: (a, b, n = 11) => Array.from({ length: n }, (_, i) => a + (b - a) * (i / (n - 1))),
  arange: (n) => Array.from({ length: n }, (_, i) => i),
  argmin: (x) => nums(x).indexOf(Math.min(...nums(x))), argmax: (x) => nums(x).indexOf(Math.max(...nums(x))),
  corr: (x, y) => { const ax = nums(x), ay = nums(y), n = Math.min(ax.length, ay.length); const mx = np.mean(ax), my = np.mean(ay); let s = 0, dx = 0, dy = 0; for (let i = 0; i < n; i++) { s += (ax[i] - mx) * (ay[i] - my); dx += (ax[i] - mx) ** 2; dy += (ay[i] - my) ** 2; } return s / (Math.sqrt(dx * dy) || 1); },
  dot: (x, y) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * y[i]; return s; },
  // polynomial least-squares fit of y vs x, returns coeffs [c_deg, ..., c0]; np.polyval evaluates
  polyfit: (x, y, deg = 1) => {
    const X = [], Y = [];
    for (let i = 0; i < x.length; i++) if (Number.isFinite(x[i]) && Number.isFinite(y[i])) { X.push(x[i]); Y.push(y[i]); }
    const A = X.map((xi) => Array.from({ length: deg + 1 }, (_, k) => xi ** (deg - k)));
    return np.lstsq(A, Y);
  },
  polyval: (c, x) => { const f = (xi) => c.reduce((s, ck, k) => s + ck * xi ** (c.length - 1 - k), 0); return Array.isArray(x) ? x.map(f) : f(x); },
  interp: (x, xp, fp) => { const f = (xi) => { if (xi <= xp[0]) return fp[0]; for (let i = 1; i < xp.length; i++) if (xi <= xp[i]) return fp[i - 1] + (fp[i] - fp[i - 1]) * (xi - xp[i - 1]) / (xp[i] - xp[i - 1] || 1); return fp[fp.length - 1]; }; return Array.isArray(x) ? x.map(f) : f(x); },
  // least squares solve of (possibly overdetermined) A x = b via normal equations
  lstsq: (A, b) => {
    const cols = A[0].length, At = Array.from({ length: cols }, (_, j) => A.map((r) => r[j]));
    const AtA = At.map((ri) => At.map((rj) => np.dot(ri, rj)));
    const Atb = At.map((ri) => np.dot(ri, b));
    return gsolve(AtA, Atb);
  },
  ones: (n) => new Array(n).fill(1),
  zeros: (n) => new Array(n).fill(0),
  array: (x) => (Array.isArray(x) ? x.slice() : [x]),
  // stack equal-length column arrays into rows: column_stack([[a,b],[c,d]]) -> [[a,c],[b,d]]
  column_stack: (cols) => cols[0].map((_, i) => cols.map((c) => c[i])),
};

export function buildScope(snapshot) {
  const subIds = snapshot.substances.map((s) => s.id);
  const measIds = snapshot.measures.map((m) => m.id);
  const labels = snapshot.measures.map((m) => m.label);
  const M = snapshot.substances.map((s) => measIds.map((mi) => (mi in s.measurements && s.measurements[mi] != null ? s.measurements[mi] : null)));
  const colIndex = (key) => { if (typeof key === "number") return key; const i = labels.findIndex((l) => l.toLowerCase().startsWith(String(key).toLowerCase())); return i >= 0 ? i : measIds.indexOf(key); };
  const col = (key) => { const j = colIndex(key); return M.map((r) => r[j]); };
  const row = (id) => M[subIds.indexOf(id)];
  const isBase = snapshot.substances.map((s) => s.origin.kind === "genesis");
  const goal = snapshot.goal.constraints.map((c) => ({ measure: c.measureLabel, target: c.target, eps: c.tol, hidden: c.hidden }));

  // design(features, target?): build a regression design matrix over substances where every listed
  // feature (and target, if given) is known. Returns {X (rows of [features…, 1]), y, ids}.
  const design = (features, target) => {
    const fs = (Array.isArray(features) ? features : [features]).map(colIndex);
    const tj = target != null ? colIndex(target) : -1;
    const X = [], y = [], ids = [];
    M.forEach((r, i) => {
      const fv = fs.map((j) => r[j]);
      const tv = tj >= 0 ? r[tj] : 0;
      if (fv.every((v) => v != null) && (tj < 0 || tv != null)) { X.push([...fv, 1]); if (tj >= 0) y.push(tv); ids.push(subIds[i]); }
    });
    return tj >= 0 ? { X, y, ids } : { X, ids };
  };
  // leave-one-out CV of a LINEAR fit target ~ features → {mae, max, n}. High mae ⇒ don't trust a global model.
  const loocv = (features, target) => {
    const d = design(features, target);
    if (d.X.length < 3) return { mae: NaN, max: NaN, n: d.X.length };
    let s = 0, mx = 0, cnt = 0;
    for (let k = 0; k < d.X.length; k++) {
      const Xt = d.X.filter((_, i) => i !== k), yt = d.y.filter((_, i) => i !== k);
      const coef = np.lstsq(Xt, yt); if (!coef) continue;
      const e = Math.abs(np.dot(coef, d.X[k]) - d.y[k]); s += e; mx = Math.max(mx, e); cnt++;
    }
    return { mae: s / cnt, max: mx, n: cnt };
  };
  const predict = (coef, xs) => np.dot(coef, [...(Array.isArray(xs) ? xs : [xs]), 1]);

  return { np, M, subs: subIds, measures: labels, col, row, isBase, goal, design, loocv, predict,
    // rows where every listed column is known
    pairs: (a, b) => { const ca = col(a), cb = col(b), xs = [], ys = []; for (let i = 0; i < ca.length; i++) if (ca[i] != null && cb[i] != null) { xs.push(ca[i]); ys.push(cb[i]); } return [xs, ys]; } };
}

// Evaluate one line. Supports `name = expr` (persists in vars) or a bare expression.
export function runConsole(snapshot, line, vars = {}) {
  const scope = { ...buildScope(snapshot), ...vars };
  const m = /^\s*([A-Za-z_$][\w$]*)\s*=\s*([^=].*)$/s.exec(line);
  const expr = m ? m[2] : line;
  const keys = Object.keys(scope);
  try {
    const fn = new Function(...keys, `"use strict"; return ( ${expr} );`);
    const value = fn(...keys.map((k) => scope[k]));
    if (m) vars[m[1]] = value;
    return { ok: true, assigned: m ? m[1] : null, value, vars };
  } catch (e) {
    return { ok: false, error: e.message, vars };
  }
}

export function formatValue(v) {
  if (v == null) return String(v);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(4);
  if (Array.isArray(v)) {
    if (v.length && Array.isArray(v[0])) return "[\n  " + v.map((r) => "[" + r.map(formatValue).join(", ") + "]").join(",\n  ") + "\n]";
    return "[" + v.map(formatValue).join(", ") + "]";
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
