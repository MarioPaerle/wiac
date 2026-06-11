// Headless QA gate: generate a range of worlds and assert each is (a) solvable by the smart
// bot and (b) far cheaper for the smart bot than for brute force. Exit code 1 on any failure.
//
//   node bots/validate-world.js [--difficulty hard] [--theme physics] [--seeds 1..50]

import { createWorld, DIFFICULTY_KEYS, DIFFICULTIES } from "../engine/index.js";
import { computeBaselines } from "./baselines.js";

function parseArgs(argv) {
  const a = { difficulty: null, theme: "alchemy", from: 1, to: 30 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--difficulty") a.difficulty = argv[++i];
    else if (argv[i] === "--theme") a.theme = argv[++i];
    else if (argv[i] === "--seeds") {
      const m = argv[++i].match(/(\d+)\.\.(\d+)/);
      if (m) { a.from = +m[1]; a.to = +m[2]; }
    }
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
const difficulties = args.difficulty ? [args.difficulty] : DIFFICULTY_KEYS;
let hardFailures = 0; // smart-bot couldn't solve, or tier average ratio below threshold

for (const difficulty of difficulties) {
  let smartSum = 0, bruteSum = 0, ratioSum = 0, unsolved = 0, n = 0;
  for (let seed = args.from; seed <= args.to; seed++) {
    n++;
    const world = createWorld({ seed, difficulty, theme: args.theme });
    const b = computeBaselines(world);
    if (!b.smartSolved) {
      unsolved++; hardFailures++;
      console.log(`  ✗ ${difficulty} seed ${seed}: SMART BOT FAILED TO SOLVE (correctness bug!)`);
    } else if (b.playability < 1) {
      // informational: a lucky-brute / easy world (common & acceptable on small single-constraint tiers)
      console.log(`  · ${difficulty} seed ${seed}: easy world (smart=${b.smartCost} brute=${b.bruteCost} ratio=${b.playability.toFixed(1)})`);
    }
    smartSum += b.smartCost; bruteSum += b.bruteCost; ratioSum += b.playability;
  }
  const avgRatio = ratioSum / n;
  const need = DIFFICULTIES[difficulty].minPlayability;
  const ok = unsolved === 0 && avgRatio >= need;
  if (!ok && avgRatio < need) hardFailures++;
  console.log(
    `${ok ? "✓" : "✗"} ${difficulty.padEnd(9)} | seeds ${args.from}-${args.to} | ` +
      `solved ${n - unsolved}/${n} | avg smart ${(smartSum / n).toFixed(1)} XP | ` +
      `avg brute ${(bruteSum / n).toFixed(0)} XP | avg ratio ${avgRatio.toFixed(1)} (need avg ≥${need})`
  );
}

process.exit(hardFailures ? 1 : 0);
