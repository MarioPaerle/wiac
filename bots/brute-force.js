// Brute-force baseline: random syntheses + measure-and-check. No use of structure.
// Defines the "max cost" anchor the player's score is measured against.

import { mulberry32 } from "../engine/prng.js";
import { GameSession } from "../engine/index.js";
import * as A from "../engine/actions.js";

function bruteOnce(world, budget, seed) {
  const session = new GameSession(world, { budget });
  const rng = mulberry32(seed);
  const cons = world.goal.constraints;
  const ops = world.ops;

  let safety = 0;
  while (session.budget.spent < budget && safety++ < 50000) {
    const pool = session.substances.map((s) => s.id);
    const op = rng.pick(ops);
    let newId;
    if (op.kind === "blend") {
      const a = rng.pick(pool), b = rng.pick(pool);
      if (a === b) continue;
      newId = session.apply(A.mix(a, b, rng.next())).newSubstanceId;
    } else {
      newId = session.apply(A.cook(rng.pick(pool), op.id)).newSubstanceId;
    }
    let ok = true;
    for (const c of cons) {
      const v = session.apply(A.measure(newId, c.measureId)).value;
      if (Math.abs(v - c.target) > c.eps) ok = false;
    }
    if (ok) return { solved: true, experiments: session.budget.spent };
  }
  return { solved: false, experiments: session.budget.spent };
}

// Median over several seeds → a stable "max cost" anchor (one run is noisy).
export function bruteForce(world, { budget = 5000, trials = 7 } = {}) {
  const runs = [];
  for (let t = 0; t < trials; t++) runs.push(bruteOnce(world, budget, 1000 + t * 7919));
  runs.sort((a, b) => a.experiments - b.experiments);
  const mid = runs[Math.floor(runs.length / 2)];
  return { solved: runs.some((r) => r.solved), experiments: mid.experiments, runs };
}
