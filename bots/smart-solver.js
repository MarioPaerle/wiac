// The "researcher" bot. Proves every world is winnable with ≪ brute-force experiments,
// using the world's structure (linear-affine measurements):
//   - single constraint  → find a bracketing pair, BISECT the mix ratio  (O(log 1/ε))
//   - two constraints     → CONVEX-COMBINATION solve in measurement space (Carathéodory: ≤3 bases)
// It drives a real GameSession, so its XP cost is comparable to a human's.
// It may invert the (known, monotone) readout — a human approximates this by sampling a sweep.

import { GameSession } from "../engine/index.js";
import * as A from "../engine/actions.js";
import { invertReadout } from "../engine/readout.js";
import { solve } from "../engine/linalg.js";

export function smartSolve(world, { budget = 100000 } = {}) {
  const cons = world.goal.constraints;
  const session = new GameSession(world, { budget });
  const out = cons.length === 1 ? bisect(session, world, cons[0]) : convex(session, world, cons);
  return { ...out, experiments: session.budget.spent };
}

function bisect(session, world, c) {
  const bases = session.substances.map((s) => s.id);
  // measure incrementally until we have a straddling pair (like a researcher), not all of them
  const seen = [];
  let a = null, b = null;
  for (const id of bases) {
    const v = session.apply(A.measure(id, c.measureId)).value;
    seen.push({ id, v });
    const below = seen.filter((x) => x.v <= c.target);
    const above = seen.filter((x) => x.v >= c.target);
    if (below.length && above.length) {
      a = below.reduce((p, q) => (q.v > p.v ? q : p)); // tightest below
      b = above.reduce((p, q) => (q.v < p.v ? q : p)); // tightest above
      break;
    }
  }
  if (!a || !b) return { solved: false, reason: "no bracket" };

  let lo = 0, hi = 1, last = null;
  const steps = Math.ceil(Math.log2((b.v - a.v) / c.eps + 1)) + 4;
  for (let i = 0; i < steps; i++) {
    const mid = (lo + hi) / 2;
    const r = session.apply(A.mix(a.id, b.id, mid));
    last = r.newSubstanceId;
    const v = session.apply(A.measure(last, c.measureId)).value;
    if (Math.abs(v - c.target) <= c.eps) break;
    if (v < c.target) lo = mid; else hi = mid; // observed value is monotone increasing in λ
  }
  const sub = session.apply(A.submit(last));
  return { solved: sub.solved, finalId: last };
}

function convex(session, world, cons) {
  const bases = session.substances.map((s) => s.id);
  const mids = cons.map((c) => c.measureId);
  // linear-core measurement vectors of every base substance on the constraint measures
  const L = bases.map((id) =>
    mids.map((mid) => {
      const obs = session.apply(A.measure(id, mid)).value;
      const m = world.measures.find((x) => x.id === mid);
      return invertReadout(m.readout, obs);
    })
  );
  const T = cons.map((c) => {
    const m = world.measures.find((x) => x.id === c.measureId);
    return invertReadout(m.readout, c.target);
  });

  // find ≤3 base substances whose convex combination hits T (exists by construction)
  for (let i = 0; i < bases.length; i++)
    for (let j = i + 1; j < bases.length; j++)
      for (let k = j + 1; k < bases.length; k++) {
        const Amat = [
          [L[i][0], L[j][0], L[k][0]],
          [L[i][1], L[j][1], L[k][1]],
          [1, 1, 1],
        ];
        const w = solve(Amat, [T[0], T[1], 1]);
        if (!w || w.some((x) => !Number.isFinite(x))) continue;
        const eps = -1e-6;
        if (w[0] < eps || w[1] < eps || w[2] < eps) continue;
        // realize the convex combination via nested blends
        const [wi, wj, wk] = w.map((x) => Math.max(0, x));
        if (wi + wj < 1e-9) continue;
        const z1 = session.apply(A.mix(bases[i], bases[j], wj / (wi + wj))).newSubstanceId;
        const z2 = session.apply(A.mix(z1, bases[k], wk)).newSubstanceId;
        for (const c of cons) session.apply(A.measure(z2, c.measureId));
        const sub = session.apply(A.submit(z2));
        if (sub.solved) return { solved: true, finalId: z2 };
      }
  return { solved: false, reason: "no convex triple found" };
}
