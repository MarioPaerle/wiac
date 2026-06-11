# WIAC — *World In A Context*

A science-discovery game whose **backbone runs on the CLI**, with many UIs layered on top.
You play a scientist exploring an unknown, mathematically-generated world: hidden **substances**,
**measurements**, and **operations**. The fun is *discovering the structure* — clustering,
interpolating, compressing the unknown — to reach a goal in as few experiments as possible.

> Comprensione ⇄ Compressione. A world is interesting iff it has **analogies** (structure, not
> max entropy). See [`docs/CONCEPT.md`](docs/CONCEPT.md) for the full study and
> [`docs/PROTOTYPE_PLAN.md`](docs/PROTOTYPE_PLAN.md) for the design decisions.

No LLM is involved: every world is generated from linear algebra + controlled clustering, and is
**provably solvable** with far fewer experiments than brute force (the bots prove it).

## Run it

Requires Node ≥ 18 (tested on v22). **No install, no build step.**

```bash
# Play in the terminal (the backbone)
node cli/main.js                                   # random tutorial world
node cli/main.js -d normal -t physics              # difficulty + theme
node cli/main.js -d hard -t biolab --seed 7        # reproducible world
node cli/main.js --code <shareCode>                # play a shared world

# Play in the browser (a graphical "lens" over the same engine)
node serve.js                                       # then open http://localhost:5173/web/
#   (or just double-click web/index.html in Safari — file:// modules work there)

# Prove the generated worlds are good (solvable & far cheaper than brute force)
node bots/validate-world.js --seeds 1..60

# Tests (incl. the hidden-vector leak boundary)
node --test
```

In the CLI, type `help`. The loop: **measure** instruments (cheap — 1 XP), **plot/corr/cluster/calc**
to find structure (free), **mix/cook** toward the goal (expensive — synthesis costs more), **submit**.
`calc` is a numpy-style console (`col(name)`, `np.polyfit`, `np.lstsq`, …) — your scratchpad for
modeling, and the only way to **infer the hidden instruments** in hard mode. Beat the algorithmic solver.

## How it works (one paragraph)

A substance is a hidden vector `s = U·c` living in a low-rank subspace (`r ≪ n`) — that low rank
*is* the discoverable structure. Each instrument (measure) has a **hidden response shape** — either
a smooth quadratic *or* a **resonance bump** (it peaks near a hidden archetype) — so you can't assume
a fixed form: you must *characterize* each instrument by sampling. Along a blend path `a→b` the
measured value traces a smooth, often **non-monotone** curve (a resonance can arch up through the
target with *both* endpoints below it), so naive bisection fails: you sample points, see the shape,
and home in on the mix ratio that hits the target. The goal sits on a real blend path that is
non-monotone and crossed by several base pairs, so a shape-agnostic solver bot always wins —
and certifies, alongside a brute-force bot, that every world is winnable with `≪` the blind-search
cost. The `trend` tool (CLI + web) draws your measured points + the interpolated curve and tells you
where it crosses the goal.

## Layout

```
engine/    pure, runtime-neutral core (Node + browser, zero build)
  kernel/  the swappable "world kernel" (linear today; a neural net = UIAC tomorrow)
themes/    vocabulary packs (alchemy · biolab · physics) — same math, different science
shared/    player-side analysis (correlation, k-means) used by CLI and web
cli/       terminal client + ASCII research instruments
web/       browser client (interactive scatter, correlation heatmap, trend)
bots/      brute-force + algorithmic solvers + the world validator
docs/      CONCEPT.md (the study) · PROTOTYPE_PLAN.md (decisions)
```

The engine never leaks hidden vectors: UIs only ever see a redacted `snapshot()`
(names, provenance, and the measurements the player paid to reveal).

## Difficulty

Difficulty = how hidden the structure is + how **non-linear** the response is + (hard) how many
instruments you must **infer**. Four tiers (easy→hard): `tutorial` (gentle, learn the loop) ·
`basic` (small non-linear puzzle) · `normal` (+cook, strong nonlinearity) · `hard` (**hidden
instruments — the goal is on one, so you predict it from the others via the console**). Measuring
is cheap, synthesis is expensive. Worlds share via a seed code.

UI: modern-retro "phosphor" look (amber 70-20-10) in **both** CLI (ASCII wordmark, colored panels)
and web (faceplate panels, inline-rename of substances, a Lab-log/history panel, "how-to-read"
captions on every chart).
