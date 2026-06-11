// The "researcher" bot — SHAPE-AGNOSTIC (works for any smooth response, quad or resonance bump).
// Single constraint:
//   - measure the base substances on the goal instrument
//   - for a promising pair, sample its blend on a coarse λ grid → find an interval that brackets
//     the target (works even when the curve humps through the target with both endpoints on one side)
//   - refine inside that monotone segment until within tolerance.
// This MODELS the curve (samples its shape) instead of assuming a form. Works in observed space
// (readout is monotone, so straddling in observed ⇔ straddling in the linear core).

import { GameSession } from "../engine/index.js";
import * as A from "../engine/actions.js";

const GRID = [0.2, 0.4, 0.6, 0.8]; // interior samples (endpoints come free from base measurements)
const PROBE_CAP = 30;
const REFINE_STEPS = 8;

export function smartSolve(world, { budget = 100000 } = {}) {
  const c = world.goal.constraints[0];
  const session = new GameSession(world, { budget });
  const m = c.measureId, target = c.target, eps = c.eps;

  // privileged goal read (validator only): the goal instrument may be HIDDEN for the player on
  // synthesized samples, but the bot reads truth to certify a reachable solution exists. Charges XP.
  const readGoal = (id) => { session.budget.spent += 1; return world.kernel.measure(world, session.get(id).vec, m); };

  const bases = session.substances.map((s) => s.id);
  const baseVal = {};
  for (const id of bases) baseVal[id] = readGoal(id);

  // order pairs: straddling endpoints first (guaranteed bracket → cheap), then by how close an
  // endpoint gets to the target (a robust, low-variance heuristic). NOTE: this is a competent but
  // MECHANICAL baseline; it can probe many pairs on out-of-hull targets (see HANDOVER backlog #5).
  const pairs = [];
  for (let i = 0; i < bases.length; i++)
    for (let j = i + 1; j < bases.length; j++) {
      const lo = Math.min(baseVal[bases[i]], baseVal[bases[j]]), hi = Math.max(baseVal[bases[i]], baseVal[bases[j]]);
      const straddle = target >= lo && target <= hi;
      pairs.push({ a: bases[i], b: bases[j], straddle, gap: straddle ? 0 : Math.min(Math.abs(target - lo), Math.abs(target - hi)) });
    }
  pairs.sort((p, q) => (p.straddle === q.straddle ? p.gap - q.gap : p.straddle ? -1 : 1));

  const refine = (a, b, lo, hi, vlo) => {
    for (let step = 0; step < REFINE_STEPS; step++) {
      const mid = (lo + hi) / 2;
      const id = session.apply(A.mix(a, b, mid)).newSubstanceId;
      const v = readGoal(id);
      if (Math.abs(v - target) <= eps) { session.apply(A.submit(id)); return id; }
      if ((vlo - target) * (v - target) > 0) { lo = mid; vlo = v; } else hi = mid;
    }
    return null;
  };
  const bracketsIn = (pts) => { const out = []; pts.sort((p, q) => p.t - q.t); for (let k = 1; k < pts.length; k++) if ((pts[k - 1].v - target) * (pts[k].v - target) <= 0) out.push({ lo: pts[k - 1].t, hi: pts[k].t, vlo: pts[k - 1].v }); return out; };

  for (const { a, b, straddle } of pairs.slice(0, PROBE_CAP)) {
    let intervals = [];
    if (straddle) intervals = [{ lo: 0, hi: 1, vlo: baseVal[a] }];
    else {
      // sample the generation-resolution grid (0.2..0.8) — guarantees catching the crossings the
      // world was built to have; spread-desc ordering means we hit a crossing pair early.
      const pts = [{ t: 0, v: baseVal[a] }, { t: 1, v: baseVal[b] }];
      for (const t of GRID) pts.push({ t, v: readGoal(session.apply(A.mix(a, b, t)).newSubstanceId) });
      intervals = bracketsIn(pts);
    }
    for (const iv of intervals) { const id = refine(a, b, iv.lo, iv.hi, iv.vlo); if (id) return { solved: true, experiments: session.budget.spent, finalId: id }; }
    if (session.budget.spent > budget) break;
  }
  return { solved: false, experiments: session.budget.spent };
}
