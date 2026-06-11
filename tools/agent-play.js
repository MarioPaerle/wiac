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
import { createWorld, GameSession, actions as A } from "../engine/index.js";
import { runConsole } from "../shared/console.js";

const RULES = `WIAC — you are a scientist exploring an UNKNOWN world.
- Substances have hidden compositions; you only ever see the numbers your instruments report.
- measure <sub> <instrument>  reads an instrument (cheap, 1 XP; cached reads are free; "all" reads every instrument).
- mix <a> <b> <λ>             blends two substances at ratio λ∈[0,1] → a NEW substance (expensive, 3 XP). Then measure it.
- cook/refine <sub>           unary transforms (expensive, 3 XP), if available.
- calc <expr>                 a numpy-style console over your measured data: M, subs, measures, col(name), row(id), goal,
                              pairs(a,b); np.mean/std/corr/polyfit/polyval/interp/lstsq/linspace. Free.
- submit <sub>                propose a solution; a wrong submit costs 4 XP.
- GOAL: find a substance whose instrument value(s) match the target within tolerance.
- Instrument responses are NON-LINEAR (curved, often non-monotone): you cannot assume blending interpolates linearly.
- In hard mode some instruments are HIDDEN (lock): readable on the ORIGINAL samples only, not your syntheses → you must INFER them.
- Some substances start already characterized (tag "known"). Think with cheap measurements; synthesize sparingly.`;

function parse(argv) {
  const a = { cmd: argv[0], save: "/tmp/wiac-agent-session.json", seed: 12345, difficulty: "normal", theme: "alchemy", pos: [] };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--save") a.save = argv[++i];
    else if (k === "--seed") a.seed = +argv[++i];
    else if (k === "--difficulty" || k === "-d") a.difficulty = argv[++i];
    else if (k === "--theme" || k === "-t") a.theme = argv[++i];
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
    const world = createWorld({ seed: args.seed, difficulty: args.difficulty, theme: args.theme });
    const session = new GameSession(world);
    save(session, {});
    process.stdout.write(RULES + "\n\n");
    out(session, { ok: true, message: `new ${args.difficulty} world, seed ${args.seed}` });
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
    case "cook": { const [sub, op] = args.pos; const r = session.apply(A.cook(sub, op || "cook")); save(session, vars); out(session, { ok: r.ok !== false, result: r }); break; }
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
