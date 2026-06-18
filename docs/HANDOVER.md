# WIAC — Handover for the next agents

Read this first, then [`docs/CONCEPT.md`](CONCEPT.md) (the design study, in Italian) and
[`docs/PROTOTYPE_PLAN.md`](PROTOTYPE_PLAN.md). The owner is **Mario** (Italian; reply in Italian,
brief, no over-narration). This file is the operational map + the open work.

## What WIAC is
A no-LLM science-discovery game. The player explores an **unknown generated world**: hidden
**substances** (vectors), **instruments** (measures ℝⁿ→ℝ), **operations** (blend/cook/refine).
Goal: synthesize a substance whose instrument reading hits a target. Fun = *discovering the
structure* (clustering, modeling non-linear responses) to win in few experiments. One engine,
many UIs (CLI backbone + web lens). Every world is provably/empirically **solvable**.

## ⚠️ Terminology (Mario asked): the "solver"/"researcher" is NOT an LLM/subagent
`bots/smart-solver.js` ("algorithmic solver") and `bots/brute-force.js` are **deterministic code**.
They (a) certify every generated world is solvable and (b) set the scoring baselines. No model, no
network. (Older summaries called the solver "researcher" — renamed to avoid confusion.)
A *separate* thing exists for evaluation: a **blind LLM subagent** can playtest via the black-box
harness `tools/agent-play.js` — see "Playtesting with an agent" below.

## Run it
```bash
cd ~/Documents/WIAC
node cli/main.js -d hard           # CLI game (interactive). type `help`. difficulties: tutorial|normal|hard
node serve.js                       # web UI → http://localhost:5173/web/  (or open web/index.html in Safari)
node bots/validate-world.js         # QA: every world solvable & solver ≪ brute (exit 1 on failure)
node --test                         # unit tests (incl. the hidden-vector leak boundary)
node tools/agent-play.js help       # black-box play harness (JSON I/O) for blind agent/human playtests
```
No install, no build. Pure ESM JS; same `engine/` files run in Node and the browser.

## Architecture (the invariants — do not break)
- **Zero build.** Pure ESM, no deps, no bundler. `engine/` is runtime-neutral (no Node-only APIs);
  CLI/bots use Node, web uses the same files via `<script type=module>`. The web never `fetch()`es
  data (so `file://` works) — worlds are generated in code from a seed.
- **Leak boundary** (`engine/snapshot.js`): hidden substance vectors NEVER reach a snapshot. The
  UI/console/agent only ever see revealed measurement scalars. `test/snapshot.test.js` guards this.
- **Seeded determinism** (`engine/prng.js`, mulberry32): worlds reproducible from a short share code
  (`engine/seedcode.js`). All randomness routes through the seeded RNG.
- **Swappable world kernel** (`engine/kernel/`): the single seam. Today `linear-kernel.js`
  (misnamed — it's now smooth NONLINEAR). The future "UIAC" neural-net world plugs in here without
  touching session/UI/bots.
- **Bots certify solvability**, they don't gate generation at runtime (avoids circular import). The
  light gen-time check is in `world.js` (rank of observable measures); the heavy gate is the offline
  `bots/validate-world.js`.

## File map
```
engine/  index.js (public API) · prng · linalg · readout · difficulty (ALL THE KNOBS) ·
         seedcode · world (gen + validate) · session (state machine, leak boundary owner) ·
         snapshot · actions · kernel/{kernel-interface, linear-kernel(=smooth nonlinear)}
shared/  analysis.js (corr, kmeans, interp, crossings) · console.js (numpy-style evaluator)
cli/     main.js (REPL) · render.js (ASCII) · plots.js (ASCII charts) · storage.js
web/     index.html · app.js · plots.js (SVG) · render? (inline) · style.css
bots/    smart-solver (shape-agnostic sample→bracket→refine) · brute-force · baselines · validate-world
tools/   agent-play.js (black-box JSON play harness) · agent-gen.js (agentic generation + eval)
docs/    CONCEPT.md · PROTOTYPE_PLAN.md · HANDOVER.md(this)
```

## The model & the tuning knobs (`engine/difficulty.js`)
Substance `s = U·c` (low-rank, `r≪n` → clustering/analogies). Each instrument has a HIDDEN response
shape: `quad` (½cᵀHc), `bump` (gaussian resonance peak), `satur` (tanh, asymptotic). Measure value =
`readout(linScale·a·c + nonlinearTerm + b)`. Knobs per tier:
- `linScale` (↓ ⇒ nonlinear dominates), `curvature` (nonlinear amplitude), `shapes` (goals avoid `quad`),
- `minNonlinearity` (goal path must deviate ≥ this·range from the endpoint line — kills "eyeball & interpolate"),
- `startKnown` (substances pre-characterized at t=0 = free prior data),
- `hiddenCount` + `goalOnHidden` (hard: goal instrument readable only on originals → INFER it),
- `epsFraction` (tolerance, loose), `budget`, `nConstraints` (currently 1 everywhere).
Cost model (`COSTS`): measure 1 (cheap), synth 3 (expensive), wrong-submit 4.

## Version history (git tags v0.1..v0.5, all preserved — **DO NOT delete/overwrite v0.1**, Mario's rule)
- v0.1 linear baseline (solvable but obviously linear).
- v0.2 nonlinear (quadratic) + loose tolerance — model the curve, not bisect.
- v0.3 varied hidden shapes (quad + resonance bump) — characterize the instrument.
- v0.4 cheap-measure/expensive-synth economics + hidden instruments (hard) + satur shape + numpy console.
- v0.5 stronger nonlinearity control (linScale, higher minNonlinearity, goals avoid quad) +
  startKnown prior data + blind-agent playtest harness (`tools/agent-play.js`, supports `--code`).
- v0.6 FOUR tiers (tutorial·basic·normal·hard): `DIFFICULTY_KEYS` is append-only (basic appended last
  so old share codes survive); `DIFFICULTY_ORDER` is the easy→hard display order — UIs use ORDER.
  Modern-retro "phosphor" UI (amber 70-20-10, from 2 style-research subagents): CLI palette+wordmark
  in `cli/render.js`, web faceplate panels in `web/style.css`. Inline-rename substances (web) + `name`
  (CLI); a Lab-log/history panel (web) + `history` command (CLI); per-chart "how-to-read" captions.
  Console gained `design()`, `loocv()`, np.add/sub/mul/div/ones/zeros/column_stack.

## Playtesting with a blind agent (Mario wants this loop)
Spawn a `general-purpose` subagent, forbid it from reading source, give it ONLY
`node tools/agent-play.js ... --save <file>` and a seed, ask it to solve and report whether it
**brute-forced or reasoned**, whether the world was truly non-linear, and difficulty/economy. Use its
report to tune knobs. (See this turn's prompt for a template.) Two playtests so far:
- **normal seed 31415**: SOLVED 26/85 XP. Non-linearity confirmed dramatic (s2→s3 density valley:
  endpoints +0.45/−0.47, λ=0.5 → −1.32; linear would predict −0.01). Target was OUTSIDE the originals'
  hull → synthesis forced (good). BUT it solved by 1-D local interpolation (regula falsi) on a
  monotone arm, not by modeling the mechanism — "a bracket-and-bisect bot would do as well."
- **hard seed 27182** (goal = hidden salinity): SOLVED 103/240 XP, ONE submit, genuine modeling
  (no brute-force). Hidden-instrument inference IS human-feasible and "rewarding detective work."
  Key findings → already fixed in v0.5: (a) the hidden instrument is readable on ALL originals, not
  just "known"-tagged — was undersignaled → now stated in the goal text + briefings; (b) a GLOBAL
  fit is unreliable (LOO mae 0.43–0.69 vs tol 0.093), only LOCAL interpolation between bracketing
  originals works → added `loocv()` so players see this, and `design()` + np.ones/zeros/column_stack
  so building a regression is a one-liner. Remaining nuance: difficulty hinges on realizing the
  model is only locally valid — acceptable for hard, but watch that it doesn't tip into frustrating.

## Open work / backlog (prioritized from the playtests — this is what to do next)
1. **Measurement noise** (biggest anti-brute-force lever per playtest): exact noiseless reads make
   1-D bracketing unbeatable. Add small seeded noise so you must *fit through noise*, not read off
   exact crossings. ⚠️ ripples: caching (re-measure must give a fresh sample to allow averaging →
   re-measures cost XP), eps must exceed noise floor, bots must average/fit. Knob is stubbed off.
2. **Targets reachable only by composition** (no single base pair crosses the target): force 2–3-hop
   synthesis trees / use cook+blend, so you must plan over the latent rather than scan one curve.
3. **Multi-constraint coupled goals** (`nConstraints=2` on different instruments with a trade-off):
   collapses the 1-D root-find into genuine multi-objective modeling. (Nonlinear 2-constraint solver
   is the hard part — see CONCEPT R2/R3; the bot would need a 2-D fit/Newton over mixing params.)
4. **Hidden instrument in normal too** (playtest: "single biggest anti-brute-force lever, absent in
   normal") — gated on confirming hard's hidden-inference is human-feasible (see hard playtest).
5. **Bot efficiency + budget**: solver uses ~35–58 XP (4-pt grid per non-straddling pair); a smarter
   probe (midpoint-first, order pairs by endpoint spread) would cut cost and let budgets tighten to
   where economy bites (~25–40 normal). Budget is currently the binding constraint on tightening.
6. **Multi-modal / oscillatory readout shape** (several crossings) so naive bracketing is unreliable.
7. **Real-Python console option** (Mario asked "python/numpy"): current console is JS+numpy-like for
   zero-build/offline parity across UIs. Could add python3 subprocess in CLI / Pyodide in web (Pyodide
   breaks `file://`); keep the JS one as default.
8. Re-skin/UX polish, multiplayer/leaderboard, the UIAC neural kernel (interface already exists).

## Memory
Project memory lives at the user's auto-memory `project_wiac.md` (status, decisions, feedback).
Keep it current when you make material changes.
