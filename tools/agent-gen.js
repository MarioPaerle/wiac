#!/usr/bin/env node
// Agentic world GENERATION + evaluation. An agent/LLM uses this to author worlds richer than
// plain random: tune generation knobs via --params, generate, and read a quality report
// (solvable? how much cleverness it rewards? how non-linear is the goal? what shapes/hidden?).
// Iterate the params toward "interesting", then PLAY the exact world with the printed command.
//
//   node tools/agent-gen.js --seed 42 -d normal -t physics
//   node tools/agent-gen.js -d normal --params '{"curvature":1.8,"minNonlinearity":0.6,"hiddenCount":1,"goalOnHidden":true,"mMeasures":6}'
//
// Knobs (override any field of the difficulty preset — see engine/difficulty.js):
//   n, r, kCenters, kBase, clusterNoise, mMeasures, shapes (["bump","satur","quad"]),
//   linScale, curvature, minNonlinearity, startKnown, hiddenCount, goalOnHidden,
//   ops (["blend","cook","refine"]), nConstraints, epsFraction, budget.
// (Unlike random, the override lets an LLM aim the generator; the override is recorded so the
//  world is reproducible — pass the same --params to agent-play.)

import { createWorld } from "../engine/index.js";
import { computeBaselines } from "../bots/baselines.js";

function parse(argv) {
  const a = { seed: 1, difficulty: "normal", theme: "alchemy", params: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--seed") a.seed = +argv[++i];
    else if (k === "--difficulty" || k === "-d") a.difficulty = argv[++i];
    else if (k === "--theme" || k === "-t") a.theme = argv[++i];
    else if (k === "--params") a.params = JSON.parse(argv[++i]);
  }
  return a;
}

const lerp = (A, B, t) => A.map((x, i) => (1 - t) * x + t * B[i]);

const args = parse(process.argv.slice(2));
let report;
try {
  const world = createWorld({ seed: args.seed, difficulty: args.difficulty, theme: args.theme, params: args.params });
  const label = (id) => world.theme.measures[world.measures.findIndex((m) => m.id === id)] ?? id;

  // goal-path nonlinearity: deviation of the goal curve from the straight endpoint line / its range
  const wit = world.goal.witness;
  const gm = world.goal.constraints[0].measureId;
  const A = world.substances.find((s) => s.id === wit.baseIds[0]).vec;
  const B = world.substances.find((s) => s.id === wit.baseIds[1]).vec;
  const v = Array.from({ length: 11 }, (_, i) => world.kernel.measure(world, lerp(A, B, i / 10), gm));
  const y0 = v[0], y1 = v[10];
  let dev = 0, lo = Infinity, hi = -Infinity;
  v.forEach((y, i) => { dev = Math.max(dev, Math.abs(y - (y0 + (y1 - y0) * (i / 10)))); lo = Math.min(lo, y); hi = Math.max(hi, y); });
  const goalNonlinearity = +(dev / ((hi - lo) || 1)).toFixed(3);

  const b = computeBaselines(world);
  const playParams = args.params ? ` --params '${JSON.stringify(args.params)}'` : "";

  report = {
    ok: b.smartSolved,
    meta: { seed: world.meta.seed, difficulty: args.difficulty, theme: args.theme, n: world.meta.n, r: world.meta.r, shareCode: world.shareCode },
    world: {
      substances: world.substances.length,
      measures: world.measures.map((m) => ({ id: m.id, label: label(m.id), shape: m.shape, hidden: !!m.hidden })),
      ops: world.ops.map((o) => o.id),
    },
    goal: { measure: gm, label: label(gm), shape: world.goal.constraints[0].hidden ? "(hidden) " + wit.shape : wit.shape, target: +world.goal.constraints[0].target.toFixed(3), eps: +world.goal.constraints[0].eps.toFixed(3) },
    quality: {
      solvable: b.smartSolved,
      goalNonlinearity,                 // ~0 linear · >0.3 clearly curved · >0.6 strong
      researcherXP: b.smartCost,        // a model-driven solver's cost
      bruteXP: b.bruteCost,             // blind random cost
      playability: +b.playability.toFixed(2), // brute/researcher — higher ⇒ rewards cleverness more
      thetaMin: b.thetaMin,
    },
    playCommand: `node tools/agent-play.js new --seed ${world.meta.seed} -d ${args.difficulty} -t ${args.theme}${playParams} --save /tmp/wiac-gen.json`,
  };
} catch (e) {
  report = { ok: false, error: e.message };
}
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
process.exit(report.ok ? 0 : 1);
