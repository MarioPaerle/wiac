// The DEFAULT world kernel: low-rank clustered substances, linear measures (with a monotone
// readout), and smooth/stable operations. This is where all hidden numeric semantics live.
//
// Why this shape:
//  - s = U·c with U orthonormal columns, r≪n  → all substances share an r-dim structure
//    (this IS the analogy/compressibility the game is about).
//  - measures are linear → affine in the latent code → blends interpolate measurements
//    → targets are reachable by bisection / convex combination (provably solvable).
//  - cook/refine are affine maps in latent space chosen to be norm-bounded (no blow-up).

import {
  columnOrthonormal, fromLatent, toLatent, gaussianVec, normalize,
  dot, matVec, add, scale, lerp, randomOrthogonal, singularValues,
} from "../linalg.js";
import { applyReadout } from "../readout.js";

function simplexWeights(k, rng) {
  // positive weights summing to 1, biased away from a single vertex
  let w = Array.from({ length: k }, () => -Math.log(1 - rng.next()) + 0.15);
  const s = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / s);
}

export const linearKernel = {
  id: "linear",

  generate(rng, params) {
    const { n, r, kCenters, kBase, clusterNoise, mMeasures, readout, bRange } = params;

    // --- structure subspace ---
    const Ucols = columnOrthonormal(n, r, rng);

    // --- base substances: cluster centers + small noise (gives discoverable clusters) ---
    const centers = Array.from({ length: kCenters }, () =>
      Array.from({ length: r }, () => rng.range(-1, 1))
    );
    const baseCodes = [];
    for (let i = 0; i < kBase; i++) {
      const ctr = rng.pick(centers);
      baseCodes.push(ctr.map((x) => x + rng.gauss() * clusterNoise));
    }
    const substances = baseCodes.map((c, i) => ({
      id: `s${i}`,
      vec: fromLatent(Ucols, c),
      origin: { kind: "genesis" },
    }));
    const mu = centers.reduce((acc, c) => add(acc, c), new Array(r).fill(0)).map((x) => x / centers.length);

    // --- measures: random linear functionals + chosen readout ---
    const measures = [];
    for (let j = 0; j < mMeasures; j++) {
      measures.push({
        id: `m${j}`,
        w: normalize(gaussianVec(n, rng)),
        b: rng.range(-bRange, bRange),
        readout,
      });
    }

    // --- operations ---
    const ops = [{ id: "blend", kind: "blend", arity: 2 }];
    if (params.ops.includes("cook")) {
      // contraction toward the cluster mean: c' = rho·Q·(c−mu) + mu  (norm-bounded)
      const Q = randomOrthogonal(r, rng);
      const rho = 0.8;
      const A = Q.map((row) => row.map((x) => x * rho));
      const bvec = matVec(A, mu).map((x, i) => mu[i] - x);
      ops.push({ id: "cook", kind: "affineLatent", arity: 1, latent: { A, b: bvec } });
    }
    if (params.ops.includes("refine")) {
      // pure rotation (orthogonal, norm-preserving) → reaches off-blend points, still stable
      const Q = randomOrthogonal(r, rng);
      ops.push({ id: "refine", kind: "affineLatent", arity: 1, latent: { A: Q, b: new Array(r).fill(0) } });
    }

    const world = { n, r, Ucols, centers, mu, substances, measures, ops };

    // --- goal: target = convex combination of base substances (always blend-realizable) ---
    const obs = (vec, m) => applyReadout(m.readout, dot(m.w, vec) + m.b);
    const rangeOf = (m) => {
      const vals = substances.map((s) => obs(s.vec, m));
      return { lo: Math.min(...vals), hi: Math.max(...vals), span: Math.max(...vals) - Math.min(...vals) };
    };

    let goal = null;
    for (let attempt = 0; attempt < 60 && !goal; attempt++) {
      const k = Math.min(params.targetComboSize, kBase);
      const idxs = rng.shuffle(substances.map((_, i) => i)).slice(0, k);
      let weights = simplexWeights(k, rng);
      if (Math.max(...weights) > 0.85) continue; // too close to a single base substance
      let starVec = new Array(n).fill(0);
      idxs.forEach((bi, t) => { starVec = add(starVec, scale(substances[bi].vec, weights[t])); });

      const chosen = rng.shuffle(measures.map((_, i) => i)).slice(0, params.nConstraints);
      const constraints = chosen.map((mi) => {
        const m = measures[mi];
        const rng2 = rangeOf(m);
        return { measureId: m.id, target: obs(starVec, m), eps: params.epsFraction * (rng2.span || 1), span: rng2.span };
      });

      // non-degeneracy: no starting substance must already satisfy ALL constraints
      const alreadySolved = substances.some((s) =>
        constraints.every((c) => Math.abs(obs(s.vec, measures.find((m) => m.id === c.measureId)) - c.target) <= c.eps)
      );
      if (alreadySolved) continue;

      goal = { constraints, witness: { baseIds: idxs.map((i) => substances[i].id), weights, starVec } };
    }
    if (!goal) goal = { constraints: [], witness: null, _failed: true };

    return {
      substances, measures, ops, goal,
      hidden: { Ucols, centers, mu, n, r },
    };
  },

  measure(world, vec, measureId) {
    const m = world.measures.find((x) => x.id === measureId);
    return applyReadout(m.readout, dot(m.w, vec) + m.b);
  },

  // linear-core value (readout removed) — for bots reasoning in linear space
  measureLinear(world, vec, measureId) {
    const m = world.measures.find((x) => x.id === measureId);
    return dot(m.w, vec) + m.b;
  },

  apply(world, opId, vecs, lambda) {
    const op = world.ops.find((o) => o.id === opId);
    if (op.kind === "blend") return lerp(vecs[0], vecs[1], lambda);
    // affineLatent: project to latent, apply affine, lift back
    const c = toLatent(world.hidden.Ucols, vecs[0]);
    const cPrime = add(matVec(op.latent.A, c), op.latent.b);
    return fromLatent(world.hidden.Ucols, cPrime);
  },

  satisfiesGoal(world, vec) {
    const perError = world.goal.constraints.map((c) => {
      const m = world.measures.find((x) => x.id === c.measureId);
      const obs = applyReadout(m.readout, dot(m.w, vec) + m.b);
      return { measureId: c.measureId, error: Math.abs(obs - c.target), eps: c.eps, value: obs };
    });
    const solved = perError.every((e) => e.error <= e.eps);
    const worstRatio = Math.max(...perError.map((e) => e.error / e.eps), 0);
    return { solved, worstRatio, perError };
  },

  referenceSolve(world) {
    const w = world.goal.witness;
    if (!w) return { recipe: [], experiments: Infinity };
    return { recipe: { baseIds: w.baseIds, weights: w.weights }, experiments: (w.baseIds.length - 1) + 4 };
  },
};
