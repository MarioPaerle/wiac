// The DEFAULT world kernel (v0.2: smooth NONLINEAR). Substances are low-rank clustered vectors;
// measures are QUADRATIC in the latent code (curved + possibly non-monotone), so along a blend
// path the measured value bends — naive bisection fails, you must MODEL the curve. Operations
// stay smooth/stable. Solvability is preserved by generating the target ON a real blend path and
// requiring several base pairs whose curve crosses it (so a curve-fitting solver always wins).

import {
  columnOrthonormal, fromLatent, toLatent, gaussianVec, normalize,
  matVec, add, scale, lerp, randomOrthogonal, singularValues, jacobiEig,
} from "../linalg.js";
import { applyReadout } from "../readout.js";

// quadratic form cᵀHc
function quadForm(H, c) {
  let s = 0;
  for (let i = 0; i < c.length; i++) for (let j = 0; j < c.length; j++) s += H[i][j] * c[i] * c[j];
  return s;
}
// latent measure: ℓ(c) = a·c + ½ cᵀHc + b   (linear core, before readout)
function lin(meas, c) {
  let s = meas.b;
  for (let i = 0; i < c.length; i++) s += meas.a[i] * c[i];
  return s + 0.5 * quadForm(meas.H, c);
}
function randomSymmetric(r, rng, scaleTo) {
  const S = Array.from({ length: r }, () => new Array(r).fill(0));
  for (let i = 0; i < r; i++) for (let j = i; j < r; j++) { const v = rng.gauss(); S[i][j] = v; S[j][i] = v; }
  if (scaleTo > 0) {
    const eig = jacobiEig(S);
    const spec = Math.max(Math.abs(eig[0]), Math.abs(eig[eig.length - 1])) || 1;
    for (let i = 0; i < r; i++) for (let j = 0; j < r; j++) S[i][j] = (S[i][j] / spec) * scaleTo;
  }
  return S;
}

// quadratic coefficients of ℓ along the blend cᵢ→cⱼ:  ℓ(λ)=A2 λ² + A1 λ + A0
function pairQuadratic(meas, ci, cj) {
  const d = cj.map((x, k) => x - ci[k]);
  const A0 = lin(meas, ci);
  // A1 = a·d + ciᵀ H d ; A2 = ½ dᵀ H d
  let aDotD = 0; for (let k = 0; k < d.length; k++) aDotD += meas.a[k] * d[k];
  let ciHd = 0, dHd = 0;
  for (let i = 0; i < d.length; i++) for (let j = 0; j < d.length; j++) { ciHd += ci[i] * meas.H[i][j] * d[j]; dHd += d[i] * meas.H[i][j] * d[j]; }
  return { A2: 0.5 * dHd, A1: aDotD + ciHd, A0 };
}
// real roots of A2λ²+A1λ+(A0−T) in [0,1]
function rootsInUnit(A2, A1, A0, T) {
  const c0 = A0 - T, out = [];
  if (Math.abs(A2) < 1e-9) { if (Math.abs(A1) > 1e-12) { const x = -c0 / A1; if (x >= -1e-6 && x <= 1 + 1e-6) out.push(x); } return out; }
  const disc = A1 * A1 - 4 * A2 * c0;
  if (disc < 0) return out;
  const sq = Math.sqrt(disc);
  for (const x of [(-A1 + sq) / (2 * A2), (-A1 - sq) / (2 * A2)]) if (x >= -1e-6 && x <= 1 + 1e-6) out.push(x);
  return out;
}

export const linearKernel = {
  id: "smooth",

  generate(rng, params) {
    const { n, r, kCenters, kBase, clusterNoise, mMeasures, readout, bRange, curvature } = params;
    const Ucols = columnOrthonormal(n, r, rng);

    // clustered base substances
    const centers = Array.from({ length: kCenters }, () => Array.from({ length: r }, () => rng.range(-1, 1)));
    const baseCodes = [];
    for (let i = 0; i < kBase; i++) {
      const ctr = rng.pick(centers);
      baseCodes.push(ctr.map((x) => x + rng.gauss() * clusterNoise));
    }
    const substances = baseCodes.map((c, i) => ({ id: `s${i}`, vec: fromLatent(Ucols, c), origin: { kind: "genesis" } }));
    const mu = centers.reduce((acc, c) => add(acc, c), new Array(r).fill(0)).map((x) => x / centers.length);

    // quadratic measures (latent)
    const measures = [];
    for (let j = 0; j < mMeasures; j++) {
      measures.push({
        id: `m${j}`,
        a: normalize(gaussianVec(r, rng)),
        H: randomSymmetric(r, rng, curvature),
        b: rng.range(-bRange, bRange),
        readout,
      });
    }

    // operations (latent affine, stable)
    const ops = [{ id: "blend", kind: "blend", arity: 2 }];
    if (params.ops.includes("cook")) {
      const Q = randomOrthogonal(r, rng), rho = 0.8;
      const A = Q.map((row) => row.map((x) => x * rho));
      const bvec = matVec(A, mu).map((x, i) => mu[i] - x);
      ops.push({ id: "cook", kind: "affineLatent", arity: 1, latent: { A, b: bvec } });
    }
    if (params.ops.includes("refine")) {
      const Q = randomOrthogonal(r, rng);
      ops.push({ id: "refine", kind: "affineLatent", arity: 1, latent: { A: Q, b: new Array(r).fill(0) } });
    }

    const world = { n, r, Ucols, centers, mu, substances, measures, ops };
    const obs = (c, m) => applyReadout(m.readout, lin(m, c));
    const rangeOf = (m) => { const v = baseCodes.map((c) => obs(c, m)); return Math.max(...v) - Math.min(...v); };

    // ---- target: a point ON a base blend path, crossed by several base pairs ----
    let goal = null;
    for (let attempt = 0; attempt < 200 && !goal; attempt++) {
      const i = rng.int(kBase); let j = rng.int(kBase); if (j === i) j = (j + 1) % kBase;
      const lamStar = rng.range(0.25, 0.75);
      const cStar = lerp(baseCodes[i], baseCodes[j], lamStar);
      const m = rng.pick(measures);
      const targetLin = lin(m, cStar);
      const targetObs = applyReadout(m.readout, targetLin);
      const span = rangeOf(m) || 1;
      const eps = params.epsFraction * span;

      // the goal path itself must be NON-MONOTONE (vertex strictly inside) so naive bisection
      // fails and the player must model the curve.
      const wq = pairQuadratic(m, baseCodes[i], baseCodes[j]);
      const vertex = Math.abs(wq.A2) < 1e-9 ? -1 : -wq.A1 / (2 * wq.A2);
      if (!(vertex > 0.15 && vertex < 0.85)) continue;

      // count base pairs whose curve crosses the target in [0,1]
      let crossings = 0;
      for (let p = 0; p < kBase; p++)
        for (let q = p + 1; q < kBase; q++) {
          const { A2, A1, A0 } = pairQuadratic(m, baseCodes[p], baseCodes[q]);
          if (rootsInUnit(A2, A1, A0, targetLin).length > 0) crossings++;
        }
      // non-degeneracy: no base substance already within eps
      const trivial = baseCodes.some((c) => Math.abs(obs(c, m) - targetObs) <= eps);
      if (crossings >= 3 && !trivial) {
        goal = {
          constraints: [{ measureId: m.id, target: targetObs, eps, span }],
          witness: { baseIds: [substances[i].id, substances[j].id], lambda: lamStar, starVec: fromLatent(Ucols, cStar) },
        };
      }
    }
    if (!goal) goal = { constraints: [], witness: null, _failed: true };

    return { substances, measures, ops, goal, hidden: { Ucols, centers, mu, n, r } };
  },

  measure(world, vec, measureId) {
    const m = world.measures.find((x) => x.id === measureId);
    return applyReadout(m.readout, lin(m, toLatent(world.hidden.Ucols, vec)));
  },
  measureLinear(world, vec, measureId) {
    const m = world.measures.find((x) => x.id === measureId);
    return lin(m, toLatent(world.hidden.Ucols, vec));
  },

  apply(world, opId, vecs, lambda) {
    const op = world.ops.find((o) => o.id === opId);
    if (op.kind === "blend") return lerp(vecs[0], vecs[1], lambda);
    const c = toLatent(world.hidden.Ucols, vecs[0]);
    return fromLatent(world.hidden.Ucols, add(matVec(op.latent.A, c), op.latent.b));
  },

  satisfiesGoal(world, vec) {
    const c = toLatent(world.hidden.Ucols, vec);
    const perError = world.goal.constraints.map((cc) => {
      const m = world.measures.find((x) => x.id === cc.measureId);
      const obs = applyReadout(m.readout, lin(m, c));
      return { measureId: cc.measureId, error: Math.abs(obs - cc.target), eps: cc.eps, value: obs };
    });
    return { solved: perError.every((e) => e.error <= e.eps), worstRatio: Math.max(...perError.map((e) => e.error / e.eps), 0), perError };
  },

  referenceSolve(world) {
    const w = world.goal.witness;
    if (!w) return { recipe: [], experiments: Infinity };
    return { recipe: { baseIds: w.baseIds, lambda: w.lambda }, experiments: w.baseIds.length + 4 };
  },
};
