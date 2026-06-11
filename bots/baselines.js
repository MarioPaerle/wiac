// Compute the scoring anchors for a world: theoretical minimum, smart-bot cost,
// brute-force cost, and a playability index. Runtime-neutral (Node + browser).

import { smartSolve } from "./smart-solver.js";
import { bruteForce } from "./brute-force.js";

export function computeBaselines(world, { bruteBudget = 5000 } = {}) {
  const k = world.goal.constraints.length;
  const epsFraction = world.params.epsFraction;
  const bisectBits = Math.ceil(Math.log2(1 / epsFraction));
  const thetaMin = k === 1 ? bisectBits : world.meta.r + bisectBits;

  const smart = smartSolve(world);
  const brute = bruteForce(world, { budget: bruteBudget });
  const smartCost = smart.solved ? smart.experiments : Infinity;
  const bruteCost = brute.experiments; // = budget if it never solved
  return {
    thetaMin,
    smartCost,
    smartSolved: smart.solved,
    bruteCost,
    bruteSolved: brute.solved,
    playability: smartCost > 0 ? bruteCost / smartCost : 0,
  };
}

// Player score in [0,1000]: 0 ≈ no better than blind brute force, 1000 ≈ theoretical optimum.
export function scoreRun(xpUsed, baselines) {
  const { bruteCost, thetaMin } = baselines;
  const span = Math.max(1, bruteCost - thetaMin);
  const frac = Math.max(0, Math.min(1, (bruteCost - xpUsed) / span));
  return Math.round(frac * 1000);
}
