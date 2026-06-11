#!/usr/bin/env node
// WIAC CLI — the playable backbone. Thin client over engine/index.js.
//   node cli/main.js [--seed N] [--difficulty tutorial|normal|hard] [--theme alchemy|biolab|physics]
//   node cli/main.js --code <shareCode>
//   node cli/main.js --load <slot>

import readline from "node:readline";
import { createWorld, GameSession, decodeShareCode, actions as A, listThemes, DIFFICULTY_KEYS } from "../engine/index.js";
import { computeBaselines, scoreRun } from "../bots/baselines.js";
import * as R from "./render.js";
import * as P from "./plots.js";
import { collectMatrix, standardize, correlationMatrix, kmeans, substanceDistance, interpAt, crossingsFromSamples } from "../shared/analysis.js";
import { runConsole, formatValue } from "../shared/console.js";
import { saveRun, loadRun, listRuns } from "./storage.js";

// ---- args ----
function parseArgs(argv) {
  const a = { seed: (Math.floor(Math.random() * 1e6)) >>> 0, difficulty: "tutorial", theme: "alchemy", code: null, load: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--seed") a.seed = (+argv[++i]) >>> 0;
    else if (k === "--difficulty" || k === "-d") a.difficulty = argv[++i];
    else if (k === "--theme" || k === "-t") a.theme = argv[++i];
    else if (k === "--code" || k === "-c") a.code = argv[++i];
    else if (k === "--load") a.load = argv[++i];
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));

let session, world;
if (args.load) {
  const rs = loadRun(args.load);
  if (!rs) { console.error("no such save:", args.load); process.exit(1); }
  session = GameSession.restore(rs); world = session.world;
} else if (args.code) {
  const { seed, difficulty, theme } = decodeShareCode(args.code);
  world = createWorld({ seed, difficulty, theme }); session = new GameSession(world);
} else {
  if (!DIFFICULTY_KEYS.includes(args.difficulty)) { console.error("difficulty must be:", DIFFICULTY_KEYS.join(", ")); process.exit(1); }
  world = createWorld({ seed: args.seed, difficulty: args.difficulty, theme: args.theme });
  session = new GameSession(world);
}

let baselines = null;
try { baselines = computeBaselines(world); } catch { /* non-fatal */ }

console.log("\n" + R.briefing(session.snapshot(), baselines) + "\n");

// ---- token resolution ----
function resolveSub(tok) {
  if (!tok) return null;
  const snap = session.snapshot();
  if (snap.substances.some((s) => s.id === tok)) return tok;
  const g = R.glyphMap(snap);
  for (const [id, glyph] of g) if (glyph === tok) return id;
  const byName = snap.substances.find((s) => s.name.toLowerCase() === tok.toLowerCase());
  return byName ? byName.id : null;
}
function resolveMeasure(tok) {
  if (!tok) return null;
  const m = world.measures.find((x) => x.id === tok);
  if (m) return m.id;
  const i = world.theme.measures.findIndex((l) => l.toLowerCase().startsWith(tok.toLowerCase()));
  return i >= 0 ? world.measures[i].id : null;
}
const measureLabel = (id) => world.theme.measures[world.measures.findIndex((m) => m.id === id)] ?? id;

// ---- post-action housekeeping ----
function after(result) {
  if (result && result.ok === false) { console.log(R.c.red("  ✗ " + result.message)); return; }
  const snap = session.snapshot();
  console.log(R.hud(snap));
  if (snap.status !== "playing") finish();
}

let finished = false;
function finish() {
  if (finished) return; finished = true;
  const snap = session.snapshot();
  const ref = world.kernel.referenceSolve ? world.kernel.referenceSolve(world) : null;
  const score = snap.status === "won" && baselines ? scoreRun(snap.budget.spent, baselines) : 0;
  console.log("\n" + R.endScreen(snap, baselines, score, ref) + "\n");
  rl.close();
}

// ---- command handlers ----
function cmdMeasure(toks) {
  const id = resolveSub(toks[0]);
  if (!id) return console.log(R.c.red("  ✗ unknown substance"));
  if (!toks[1] || toks[1] === "all") {
    const res = session.apply(A.measureAll(id));
    const snap = session.snapshot();
    console.log("  " + R.inspectView(snap, id).split("\n").slice(1).join("\n  ").replace(/\n  /g, "\n"));
    return after({ ok: true });
  }
  const mid = resolveMeasure(toks[1]);
  if (!mid) return console.log(R.c.red("  ✗ unknown instrument"));
  const r = session.apply(A.measure(id, mid));
  console.log(`  ${id} ${measureLabel(mid)} = ${R.c.bold(r.value.toFixed(3))} ${r.cached ? R.c.dim("(cached, free)") : R.c.dim("(−" + r.cost + " XP)")}`);
  after(r);
}

function cmdMix(toks) {
  const a = resolveSub(toks[0]), b = resolveSub(toks[1]);
  if (!a || !b) return console.log(R.c.red("  ✗ usage: mix <a> <b> [λ]"));
  const lam = toks[2] != null ? parseFloat(toks[2]) : 0.5;
  const r = session.apply(A.mix(a, b, lam));
  if (r.ok) console.log(`  made ${R.c.cyan(r.newSubstanceId)} = mix(${a}, ${b}, λ=${lam.toFixed(3)})  ${R.c.dim("(−" + r.cost + " XP, then measure it)")}`);
  after(r);
}

function cmdCook(toks) {
  const id = resolveSub(toks[0]);
  const op = toks[1] || world.ops.find((o) => o.kind === "affineLatent")?.id;
  if (!id || !op) return console.log(R.c.red("  ✗ usage: cook <id> [op]  (no unary op in this world?)"));
  const r = session.apply(A.cook(id, op));
  if (r.ok) console.log(`  made ${R.c.cyan(r.newSubstanceId)} = ${op}(${id})  ${R.c.dim("(−" + r.cost + " XP)")}`);
  after(r);
}

function cmdPlot(toks) {
  const mx = resolveMeasure(toks[0]), my = resolveMeasure(toks[1]);
  if (!mx || !my) return console.log(R.c.red("  ✗ usage: plot <instrumentX> <instrumentY>"));
  const snap = session.snapshot();
  const g = R.glyphMap(snap);
  const points = snap.substances
    .filter((s) => s.measurements[mx] != null && s.measurements[my] != null)
    .map((s) => ({ glyph: g.get(s.id), x: s.measurements[mx], y: s.measurements[my] }));
  const gc = snap.goal.constraints;
  const goalX = gc.find((c) => c.measureId === mx)?.target ?? null;
  const goalY = gc.find((c) => c.measureId === my)?.target ?? null;
  console.log(P.scatter(points, { xlabel: measureLabel(mx), ylabel: measureLabel(my), goalX, goalY }));
  console.log(R.c.dim("  legend: " + snap.substances.filter((s) => s.measurements[mx] != null && s.measurements[my] != null).map((s) => `${g.get(s.id)}=${s.id}`).join(" ")));
}

function cmdTrend(toks) {
  const a = resolveSub(toks[0]), b = resolveSub(toks[1]), m = resolveMeasure(toks[2]);
  if (!a || !b || !m) return console.log(R.c.red("  ✗ usage: trend <a> <b> <instrument>"));
  const snap = session.snapshot();
  const sa = snap.substances.find((s) => s.id === a), sb = snap.substances.find((s) => s.id === b);
  // gather REAL measured points along the a→b blend (endpoints + any mix(a,b,λ) you've measured)
  const pts = [];
  if (sa.measurements[m] != null) pts.push({ lambda: 0, value: sa.measurements[m] });
  if (sb.measurements[m] != null) pts.push({ lambda: 1, value: sb.measurements[m] });
  for (const s of snap.substances) {
    if (s.origin.kind !== "mix" || s.measurements[m] == null) continue;
    if (s.origin.a === a && s.origin.b === b) pts.push({ lambda: s.origin.lambda, value: s.measurements[m] });
    else if (s.origin.a === b && s.origin.b === a) pts.push({ lambda: 1 - s.origin.lambda, value: s.measurements[m] });
  }
  const goalLine = snap.goal.constraints.find((c) => c.measureId === m)?.target ?? null;
  console.log(P.trend(pts, { goalLine, interp: (t) => interpAt(pts, t), ylabel: measureLabel(m), endpoints: [a, b] }));
  if (pts.length < 3) {
    console.log(R.c.yellow(`  only ${pts.length} point(s) — this instrument's response shape is HIDDEN and may not be monotone. Sample more: mix ${a} ${b} 0.5 (then measure).`));
  } else if (goalLine != null) {
    const roots = crossingsFromSamples(pts, goalLine);
    if (roots.length) console.log(R.c.green(`  curve crosses the goal at λ≈${roots.map((r) => r.toFixed(2)).join(" and ")}.  Try: mix ${a} ${b} ${roots[0].toFixed(2)}  (sample nearby to refine)`));
    else console.log(R.c.dim("  these samples don't cross the goal — sample between them or try another pair."));
  }
}

function cmdSweep(toks) {
  const a = resolveSub(toks[0]), b = resolveSub(toks[1]);
  const m = toks[2] ? resolveMeasure(toks[2]) : world.goal.constraints[0].measureId;
  const k = toks[3] ? Math.max(2, Math.min(8, +toks[3])) : 4;
  if (!a || !b || !m) return console.log(R.c.red("  ✗ usage: sweep <a> <b> [instrument] [k]"));
  session.apply(A.measure(a, m)); session.apply(A.measure(b, m));
  for (let i = 1; i <= k; i++) { const r = session.apply(A.mix(a, b, i / (k + 1))); if (r.newSubstanceId) session.apply(A.measure(r.newSubstanceId, m)); }
  console.log(R.c.dim(`  sampled ${a}→${b} on ${measureLabel(m)} at ${k} points:`));
  cmdTrend([toks[0], toks[1], m]);
  after({ ok: true });
}

function cmdHist(toks) {
  const m = resolveMeasure(toks[0]);
  if (!m) return console.log(R.c.red("  ✗ usage: hist <instrument>"));
  const vals = session.snapshot().substances.map((s) => s.measurements[m]).filter((v) => v != null);
  console.log(P.histogram(vals, { label: measureLabel(m) }));
}

function cmdCorr() {
  const snap = session.snapshot();
  const cm = correlationMatrix(snap);
  console.log(P.corrTable(cm));
}

function cmdCluster(toks) {
  const snap = session.snapshot();
  const mids = snap.measures.map((m) => m.id);
  const cm = collectMatrix(snap, mids);
  if (cm.X.length < 2) return console.log(R.c.yellow("  measure more substances on all instruments first (need ≥2 fully-measured)."));
  const k = toks[0] ? +toks[0] : Math.min(3, Math.max(2, Math.round(Math.sqrt(cm.X.length))));
  const { Z } = standardize(cm.X);
  const { assign } = kmeans(Z, k);
  const groups = new Map();
  assign.forEach((g, i) => { if (!groups.has(g)) groups.set(g, []); groups.get(g).push(cm.ids[i]); });
  console.log(R.c.bold(`  ${k}-family taxonomy over ${cm.X.length} measured substances:`));
  [...groups.entries()].forEach(([g, ids]) => console.log(`   family ${String.fromCharCode(65 + g)}: ${ids.join(", ")}`));
  console.log(R.c.dim("  (tag them, e.g.  tag s0 #famA )"));
}

function cmdDist(toks) {
  const a = resolveSub(toks[0]);
  if (!a) return console.log(R.c.red("  ✗ usage: dist <a> [b]"));
  const snap = session.snapshot();
  if (toks[1]) {
    const b = resolveSub(toks[1]);
    const d = substanceDistance(snap, a, b);
    return console.log(`  dist(${a}, ${b}) = ${d == null ? "?" : d.toFixed(3)}  ${R.c.dim("(standardized measure-space)")}`);
  }
  const ranked = snap.substances.filter((s) => s.id !== a).map((s) => ({ id: s.id, d: substanceDistance(snap, a, s.id) }))
    .filter((x) => x.d != null).sort((p, q) => p.d - q.d);
  console.log(`  nearest to ${a}: ` + ranked.slice(0, 6).map((x) => `${x.id}(${x.d.toFixed(2)})`).join("  "));
}

function cmdSubmit(toks) {
  const id = resolveSub(toks[0]);
  if (!id) return console.log(R.c.red("  ✗ usage: submit <id>"));
  const r = session.apply(A.submit(id));
  if (r.solved) console.log(R.c.green(`  ✓✓ SOLVED with ${id}!`));
  else {
    console.log(R.c.red(`  ✗ ${id} misses the goal (−${r.penalty} XP):`));
    r.perError.forEach((e) => console.log(R.c.dim(`     ${measureLabel(e.measureId)}: ${e.value.toFixed(3)} vs target (Δ ${e.error.toFixed(3)}, need ≤ ${e.eps.toFixed(3)})`)));
  }
  after(r);
}

const consoleVars = {};
function cmdCalc(toks) {
  const line = toks.join(" ").trim();
  if (!line) {
    return console.log(R.c.dim("  numpy-style console. Data: M, subs, measures, col(name), row(id), isBase, goal, pairs(a,b).\n" +
      "  np.mean/std/corr/polyfit/polyval/interp/lstsq/linspace …   e.g.  calc np.corr(col('density'), col('acidity'))\n" +
      "  assign with =:  calc w = np.polyfit(col('acidity'), col('density'), 2)   then   calc np.polyval(w, 0.5)"));
  }
  const r = runConsole(session.snapshot(), line, consoleVars);
  if (!r.ok) return console.log(R.c.red("  ✗ " + r.error));
  console.log(R.c.dim("  " + (r.assigned ? r.assigned + " = " : "")) + formatValue(r.value));
}

function cmdReveal() {
  const ref = world.kernel.referenceSolve ? world.kernel.referenceSolve(world) : null;
  console.log(R.c.yellow(`  hidden dimension r = ${world.meta.r} (ambient n = ${world.meta.n}), ${world.params.kCenters} clusters.`));
  if (ref?.recipe?.baseIds) console.log(R.c.dim(`  a known solution: convex blend of [${ref.recipe.baseIds.join(", ")}].`));
  session.status = session.status === "playing" ? "lost" : session.status;
  finish();
}

// ---- REPL ----
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: R.c.cyan("wiac> ") });
console.log(R.helpText() + "\n");
rl.prompt();

rl.on("line", (line) => {
  const toks = line.trim().split(/\s+/).filter(Boolean);
  const cmd = (toks.shift() || "").toLowerCase();
  try {
    switch (cmd) {
      case "": break;
      case "help": case "h": case "?": console.log(R.helpText()); break;
      case "list": case "ls": case "inv": console.log(R.inventory(session.snapshot(), toks[0]?.replace("#", ""))); break;
      case "measure": case "m": cmdMeasure(toks); break;
      case "mix": cmdMix(toks); break;
      case "cook": cmdCook(toks); break;
      case "plot": cmdPlot(toks); break;
      case "trend": cmdTrend(toks); break;
      case "sweep": cmdSweep(toks); break;
      case "hist": cmdHist(toks); break;
      case "corr": cmdCorr(); break;
      case "cluster": cmdCluster(toks); break;
      case "calc": case "np": case "py": cmdCalc(toks); break;
      case "dist": cmdDist(toks); break;
      case "name": after(session.apply(A.name(resolveSub(toks[0]), toks.slice(1).join(" ")))); break;
      case "tag": after(session.apply(A.tag(resolveSub(toks[0]), toks.slice(1).join(" ").replace("#", "")))); break;
      case "note": session.apply(A.note(toks.join(" "))); console.log(R.c.dim("  noted.")); break;
      case "hypo": session.apply({ type: "hypo", text: toks.join(" ") }); console.log(R.c.dim("  hypothesis logged.")); break;
      case "inspect": case "i": console.log(R.inspectView(session.snapshot(), resolveSub(toks[0]))); break;
      case "goal": case "g": console.log(R.goalView(session.snapshot())); break;
      case "notebook": case "nb": console.log(R.notebookView(session.snapshot())); break;
      case "status": case "budget": console.log(R.hud(session.snapshot())); break;
      case "history": case "log": console.log(R.historyView(session.snapshot())); break;
      case "submit": cmdSubmit(toks); break;
      case "save": { const slot = toks[0] || "1"; saveRun(slot, session.serialize()); console.log(R.c.dim(`  saved to slot ${slot}.`)); break; }
      case "saves": console.log(listRuns().map((r) => `  ${r.slot}: ${r.shareCode} (${r.status}, ${r.spent} XP)`).join("\n") || "  (none)"); break;
      case "reveal": cmdReveal(); break;
      case "seed": case "code": console.log("  " + session.snapshot().shareCode); break;
      case "quit": case "exit": case "q": rl.close(); return;
      default: console.log(R.c.dim(`  unknown command "${cmd}" — type 'help'`));
    }
  } catch (e) { console.log(R.c.red("  error: " + e.message)); }
  if (!finished) rl.prompt();
});

rl.on("close", () => { console.log(R.c.dim("\nbye.")); process.exit(0); });
