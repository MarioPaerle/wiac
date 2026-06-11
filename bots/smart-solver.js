// The "researcher" bot for the nonlinear world. Single constraint:
//   - measure the base substances on the goal instrument
//   - pick a promising pair, sample its blend at λ=0.5 → fit the quadratic ℓ(λ) exactly
//     from 3 points (endpoints are free), solve ℓ(λ)=target for a root in [0,1], blend there.
// This MODELS the curve instead of bisecting (which fails on a non-monotone response).
// It drives a real GameSession, so its XP is comparable to a human's.

import { GameSession } from "../engine/index.js";
import * as A from "../engine/actions.js";
import { invertReadout } from "../engine/readout.js";

const PROBE_CAP = 40;

export function smartSolve(world, { budget = 100000 } = {}) {
  const c = world.goal.constraints[0];
  const session = new GameSession(world, { budget });
  const m = c.measureId;
  const meas = world.measures.find((x) => x.id === m);
  const targetLin = invertReadout(meas.readout, c.target);

  const bases = session.substances.map((s) => s.id);
  const linOf = {};
  for (const id of bases) linOf[id] = invReadoutVal(meas, session.apply(A.measure(id, m)).value);

  // order pairs: straddling the target first (likeliest to cross), then by proximity
  const pairs = [];
  for (let i = 0; i < bases.length; i++)
    for (let j = i + 1; j < bases.length; j++) {
      const lo = Math.min(linOf[bases[i]], linOf[bases[j]]), hi = Math.max(linOf[bases[i]], linOf[bases[j]]);
      const straddle = targetLin >= lo && targetLin <= hi;
      const gap = straddle ? 0 : Math.min(Math.abs(targetLin - lo), Math.abs(targetLin - hi));
      pairs.push({ a: bases[i], b: bases[j], straddle, gap });
    }
  pairs.sort((p, q) => (p.straddle === q.straddle ? p.gap - q.gap : p.straddle ? -1 : 1));

  for (const { a, b } of pairs.slice(0, PROBE_CAP)) {
    const y0 = linOf[a], y1 = linOf[b];
    const mid = session.apply(A.mix(a, b, 0.5)).newSubstanceId;
    const yh = invReadoutVal(meas, session.apply(A.measure(mid, m)).value);
    // fit ℓ(λ)=A2λ²+A1λ+A0 from (0,y0),(0.5,yh),(1,y1)
    const A2 = 2 * (y1 + y0 - 2 * yh), A0 = y0, A1 = (y1 - y0) - A2;
    for (const root of rootsInUnit(A2, A1, A0, targetLin)) {
      const final = session.apply(A.mix(a, b, root)).newSubstanceId;
      const got = session.apply(A.measure(final, m)).value;
      if (Math.abs(got - c.target) <= c.eps) { session.apply(A.submit(final)); return { solved: true, experiments: session.budget.spent, finalId: final }; }
    }
    if (session.budget.spent > budget) break;
  }
  return { solved: false, experiments: session.budget.spent };
}

function invReadoutVal(meas, obs) { return invertReadout(meas.readout, obs); }

function rootsInUnit(A2, A1, A0, T) {
  const c0 = A0 - T, out = [];
  if (Math.abs(A2) < 1e-9) { if (Math.abs(A1) > 1e-12) { const x = -c0 / A1; if (x >= 0 && x <= 1) out.push(x); } return out; }
  const disc = A1 * A1 - 4 * A2 * c0;
  if (disc < 0) return out;
  const sq = Math.sqrt(disc);
  for (const x of [(-A1 + sq) / (2 * A2), (-A1 - sq) / (2 * A2)]) if (x >= 0 && x <= 1) out.push(x);
  return out;
}
