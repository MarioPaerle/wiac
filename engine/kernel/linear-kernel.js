// The DEFAULT world kernel (v0.3: smooth NONLINEAR with VARIED hidden response shapes).
// Substances are low-rank clustered vectors. Each measure has one of several hidden shapes:
//   - "quad": ℓ(c) = a·c + ½ cᵀHc + b          (uniformly curved)
//   - "bump": ℓ(c) = a·c + amp·exp(-‖c−μ‖²/2σ²) + b   (a RESONANCE — peaks near a hidden archetype)
// So a player can't assume "it's a parabola": you must CHARACTERIZE each instrument by sampling.
// Along a blend path the measured value is some smooth, often NON-MONOTONE curve → naive bisection
// fails. Solvability is preserved by generating the target ON a real blend path that is non-monotone
// and crossed by several base pairs; a shape-agnostic curve-sampling bot always wins.

import {
  columnOrthonormal, fromLatent, toLatent, gaussianVec, normalize,
  matVec, add, scale, lerp, randomOrthogonal, singularValues, jacobiEig,
} from "../linalg.js";
import { applyReadout } from "../readout.js";

function quadForm(H, c) { let s = 0; for (let i = 0; i < c.length; i++) for (let j = 0; j < c.length; j++) s += H[i][j] * c[i] * c[j]; return s; }
function sumsq(v) { return v.reduce((s, x) => s + x * x, 0); }

// latent linear-core value of a measure (before readout) — dispatches on hidden shape
function lin(meas, c) {
  let s = meas.b;
  for (let i = 0; i < c.length; i++) s += meas.a[i] * c[i];
  if (meas.shape === "bump") return s + meas.amp * Math.exp(-sumsq(c.map((x, i) => x - meas.center[i])) * meas.invSig2);
  return s + 0.5 * quadForm(meas.H, c); // quad
}

function randomSymmetric(r, rng, scaleTo) {
  const S = Array.from({ length: r }, () => new Array(r).fill(0));
  for (let i = 0; i < r; i++) for (let j = i; j <= r - 1; j++) { const v = rng.gauss(); S[i][j] = v; S[j][i] = v; }
  const eig = jacobiEig(S);
  const spec = Math.max(Math.abs(eig[0]), Math.abs(eig[eig.length - 1])) || 1;
  for (let i = 0; i < r; i++) for (let j = 0; j < r; j++) S[i][j] = (S[i][j] / spec) * scaleTo;
  return S;
}

// sample ℓ along the blend ci→cj at N points → [{t, y}]
function sampleLin(meas, ci, cj, N = 25) {
  const out = [];
  for (let k = 0; k < N; k++) { const t = k / (N - 1); out.push({ t, y: lin(meas, lerp(ci, cj, t)) }); }
  return out;
}
function isNonMonotone(samples) {
  let dir = 0, turns = 0;
  for (let k = 1; k < samples.length; k++) {
    const d = Math.sign(+(samples[k].y - samples[k - 1].y).toFixed(9));
    if (d !== 0 && dir !== 0 && d !== dir) turns++;
    if (d !== 0) dir = d;
  }
  return turns >= 1;
}
function crossesTarget(samples, T) {
  for (let k = 1; k < samples.length; k++) if ((samples[k - 1].y - T) * (samples[k].y - T) <= 0) return true;
  return false;
}

export const linearKernel = {
  id: "smooth",

  generate(rng, params) {
    const { n, r, kCenters, kBase, clusterNoise, mMeasures, readout, bRange, curvature } = params;
    const Ucols = columnOrthonormal(n, r, rng);

    const centers = Array.from({ length: kCenters }, () => Array.from({ length: r }, () => rng.range(-1, 1)));
    const baseCodes = [];
    for (let i = 0; i < kBase; i++) { const ctr = rng.pick(centers); baseCodes.push(ctr.map((x) => x + rng.gauss() * clusterNoise)); }
    const substances = baseCodes.map((c, i) => ({ id: `s${i}`, vec: fromLatent(Ucols, c), origin: { kind: "genesis" } }));
    const mu = centers.reduce((acc, c) => add(acc, c), new Array(r).fill(0)).map((x) => x / centers.length);

    // measures: each gets a hidden response shape (≈half quad, half resonance bump)
    const measures = [];
    for (let j = 0; j < mMeasures; j++) {
      const shape = rng.next() < 0.5 ? "quad" : "bump";
      const m = { id: `m${j}`, a: normalize(gaussianVec(r, rng)), b: rng.range(-bRange, bRange), readout, shape };
      if (shape === "quad") m.H = randomSymmetric(r, rng, curvature);
      else { // bump: resonance peak near a hidden archetype
        m.a = scale(m.a, 0.6);
        m.center = Array.from({ length: r }, () => rng.range(-1.1, 1.1));
        const sigma = 0.55 + 0.25 * rng.next();
        m.invSig2 = 1 / (2 * sigma * sigma);
        m.amp = (rng.next() < 0.5 ? -1 : 1) * curvature * 2.2;
      }
      measures.push(m);
    }

    const ops = [{ id: "blend", kind: "blend", arity: 2 }];
    if (params.ops.includes("cook")) {
      const Q = randomOrthogonal(r, rng), rho = 0.8;
      const A = Q.map((row) => row.map((x) => x * rho));
      ops.push({ id: "cook", kind: "affineLatent", arity: 1, latent: { A, b: matVec(A, mu).map((x, i) => mu[i] - x) } });
    }
    if (params.ops.includes("refine")) ops.push({ id: "refine", kind: "affineLatent", arity: 1, latent: { A: randomOrthogonal(r, rng), b: new Array(r).fill(0) } });

    const world = { n, r, Ucols, centers, mu, substances, measures, ops };
    const obs = (c, m) => applyReadout(m.readout, lin(m, c));
    const rangeOf = (m) => { const v = baseCodes.map((c) => obs(c, m)); return Math.max(...v) - Math.min(...v); };

    // ---- target: a point ON a base blend path that is NON-MONOTONE and crossed by ≥3 base pairs ----
    let goal = null;
    for (let attempt = 0; attempt < 400 && !goal; attempt++) {
      const i = rng.int(kBase); let j = rng.int(kBase); if (j === i) j = (j + 1) % kBase;
      const lamStar = rng.range(0.25, 0.75);
      const cStar = lerp(baseCodes[i], baseCodes[j], lamStar);
      const m = rng.pick(measures);
      const targetLin = lin(m, cStar);
      const targetObs = applyReadout(m.readout, targetLin);
      const span = rangeOf(m) || 1;
      const eps = params.epsFraction * span;

      if (!isNonMonotone(sampleLin(m, baseCodes[i], baseCodes[j]))) continue; // must defeat naive bisection
      // the witness, and ≥3 pairs, must cross the target at the bot's sampling resolution (6 pts)
      if (!crossesTarget(sampleLin(m, baseCodes[i], baseCodes[j], 6), targetLin)) continue;
      let crossings = 0;
      for (let p = 0; p < kBase; p++) for (let q = p + 1; q < kBase; q++) if (crossesTarget(sampleLin(m, baseCodes[p], baseCodes[q], 6), targetLin)) crossings++;
      const trivial = baseCodes.some((c) => Math.abs(obs(c, m) - targetObs) <= eps);
      if (crossings >= 3 && !trivial) {
        goal = { constraints: [{ measureId: m.id, target: targetObs, eps, span }], witness: { baseIds: [substances[i].id, substances[j].id], lambda: lamStar, shape: m.shape, starVec: fromLatent(Ucols, cStar) } };
      }
    }
    if (!goal) goal = { constraints: [], witness: null, _failed: true };

    return { substances, measures, ops, goal, hidden: { Ucols, centers, mu, n, r } };
  },

  measure(world, vec, measureId) { const m = world.measures.find((x) => x.id === measureId); return applyReadout(m.readout, lin(m, toLatent(world.hidden.Ucols, vec))); },
  measureLinear(world, vec, measureId) { const m = world.measures.find((x) => x.id === measureId); return lin(m, toLatent(world.hidden.Ucols, vec)); },

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
      const o = applyReadout(m.readout, lin(m, c));
      return { measureId: cc.measureId, error: Math.abs(o - cc.target), eps: cc.eps, value: o };
    });
    return { solved: perError.every((e) => e.error <= e.eps), worstRatio: Math.max(...perError.map((e) => e.error / e.eps), 0), perError };
  },

  referenceSolve(world) {
    const w = world.goal.witness;
    if (!w) return { recipe: [], experiments: Infinity };
    return { recipe: { baseIds: w.baseIds, lambda: w.lambda, shape: w.shape }, experiments: w.baseIds.length + 6 };
  },
};
