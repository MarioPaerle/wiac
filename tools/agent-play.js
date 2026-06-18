#!/usr/bin/env node
// Black-box play harness so an external agent (or a human) can play one seed WITHOUT seeing the
// engine internals. Stateful via a JSON save file; every command prints the player-facing snapshot.
//
//   node tools/agent-play.js new --seed 31415 -d normal -t alchemy [--save FILE]
//   node tools/agent-play.js state               [--save FILE]
//   node tools/agent-play.js measure s0 m1        [--save FILE]      (use "all" for every instrument)
//   node tools/agent-play.js mix s0 s1 0.5        [--save FILE]
//   node tools/agent-play.js cook s0 [cook|refine][--save FILE]
//   node tools/agent-play.js calc "np.corr(col('m0'), col('m1'))"  [--save FILE]
//   node tools/agent-play.js submit x3            [--save FILE]
//   node tools/agent-play.js help
//
// Output is JSON: { ok, message?, value?, snapshot }. Treat the world as a BLACK BOX — only use
// what the snapshot tells you. Do NOT read engine/ or bots/ source; that would not be a fair test.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createWorld, GameSession, decodeShareCode, actions as A } from "../engine/index.js";
import { runConsole } from "../shared/console.js";

const RULES = `WIAC — you are a scientist exploring an UNKNOWN world.
- Substances have hidden compositions; you only ever see the numbers your instruments report.
- measure <sub> <instrument>  reads an instrument (cheap, 1 XP; cached reads are free; "all" reads every instrument).
- mix <a> <b> <λ>             blends two substances at ratio λ∈[0,1] → a NEW substance (expensive, 3 XP). Then measure it.
- cook <sub> / refine <sub>   unary transforms (expensive, 3 XP), if available. Call by the op ID shown in the
                              snapshot's ops list (always "cook"/"refine"); the theme only relabels them (e.g. anneal/rotate).
- calc <expr>                 a numpy-style console over your measured data (free). Scope: M, subs, measures, col(name),
                              row(id), goal, pairs(a,b), design(features,target), loocv(features,target), predict(coef,xs);
                              np.mean/std/corr/polyfit/polyval/interp/lstsq/linspace/ones/zeros/column_stack.
                              For a hidden goal: design(['m0','m3'],'m6') builds X,y; np.lstsq(d.X,d.y) fits; loocv tells you if to trust it.
- submit <sub>                propose a solution; a wrong submit costs 4 XP.
- GOAL: find a substance whose instrument value(s) match the target within tolerance.
- Instrument responses are NON-LINEAR (curved, often non-monotone): you cannot assume blending interpolates linearly.
- In hard mode some instruments are HIDDEN (lock): readable on EVERY ORIGINAL sample (characterized or not), but NOT on your
  syntheses → measure them on the originals to get training data, fit a model, and INFER the value for your blends.
- Some substances start already characterized (tag "known"). Think with cheap measurements; synthesize sparingly.`;

function parse(argv) {
  const a = { cmd: argv[0], save: "/tmp/wiac-agent-session.json", seed: 12345, difficulty: "normal", theme: "alchemy", code: null, pos: [] };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--save") a.save = argv[++i];
    else if (k === "--seed") a.seed = +argv[++i];
    else if (k === "--difficulty" || k === "-d") a.difficulty = argv[++i];
    else if (k === "--theme" || k === "-t") a.theme = argv[++i];
    else if (k === "--code" || k === "-c") a.code = argv[++i];
    else if (k === "--params") a.params = argv[++i];
    else a.pos.push(k);
  }
  return a;
}

const args = parse(process.argv.slice(2));

function load() {
  if (!existsSync(args.save)) throw new Error(`no session at ${args.save} — run "new" first`);
  const data = JSON.parse(readFileSync(args.save, "utf8"));
  return { session: GameSession.restore(data.run), vars: data.vars || {} };
}
function save(session, vars) { writeFileSync(args.save, JSON.stringify({ run: session.serialize(), vars })); }
function out(session, extra = {}) { process.stdout.write(JSON.stringify({ ...extra, snapshot: session.snapshot() }, null, 2) + "\n"); }

try {
  if (args.cmd === "help" || !args.cmd) { process.stdout.write(RULES + "\n"); process.exit(0); }

  if (args.cmd === "new") {
    const opts = args.code ? decodeShareCode(args.code) : { seed: args.seed, difficulty: args.difficulty, theme: args.theme };
    if (args.params) opts.params = JSON.parse(args.params); // agent-authored generation overrides
    const world = createWorld(opts);
    const session = new GameSession(world);
    save(session, {});
    process.stdout.write(RULES + "\n\n");
    out(session, { ok: true, message: `new world (${args.code ? "code " + args.code : args.difficulty + " seed " + args.seed})` });
    process.exit(0);
  }

  const { session, vars } = load();

  switch (args.cmd) {
    case "state": out(session); break;
    case "measure": {
      const [sub, m] = args.pos;
      const r = !m || m === "all" ? session.apply(A.measureAll(sub)) : session.apply(A.measure(sub, m));
      save(session, vars); out(session, { ok: r.ok !== false, result: r });
      break;
    }
    case "mix": { const [a, b, l] = args.pos; const r = session.apply(A.mix(a, b, l != null ? +l : 0.5)); save(session, vars); out(session, { ok: r.ok !== false, result: r }); break; }
    // unary ops are invoked by their op id (always "cook" or "refine"; the theme only relabels them):
    //   cook <sub>   ·   refine <sub>   ·   or  cook <sub> <opId>
    case "cook": case "refine": {
      const opId = args.cmd === "refine" ? "refine" : (args.pos[1] || "cook");
      const r = session.apply(A.cook(args.pos[0], opId)); save(session, vars); out(session, { ok: r.ok !== false, result: r }); break;
    }
    case "submit": { const r = session.apply(A.submit(args.pos[0])); save(session, vars); out(session, { ok: r.ok !== false, result: r }); break; }
    case "calc": {
      const expr = args.pos.join(" ");
      const r = runConsole(session.snapshot(), expr, vars);
      save(session, r.vars);
      out(session, { ok: r.ok, value: r.ok ? r.value : undefined, assigned: r.assigned, error: r.error });
      break;
    }
    default: process.stdout.write(JSON.stringify({ ok: false, message: `unknown command "${args.cmd}" — try help` }) + "\n");
  }
} catch (e) {
  process.stdout.write(JSON.stringify({ ok: false, error: e.message }) + "\n");
  process.exit(1);
}
