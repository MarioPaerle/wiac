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

// Player score in [0,1000], anchored on the RESEARCHER bot (stable) with the optimum as ceiling:
// matching the researcher ≈ 700, beating it → up to 1000, much worse → toward 0.
export function scoreRun(xpUsed, baselines) {
  if (xpUsed <= 0) return 1000;
  if (xpUsed <= baselines.thetaMin) return 1000;
  const ref = Number.isFinite(baselines.smartCost) && baselines.smartCost > 0 ? baselines.smartCost : baselines.bruteCost;
  return Math.max(0, Math.min(1000, Math.round((700 * ref) / xpUsed)));
}
