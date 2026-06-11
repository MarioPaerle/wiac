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

In the CLI, type `help`. The loop: **measure** instruments (costs XP), **plot/corr/cluster** to
find structure (free), **mix** substances toward the goal, **submit**. Beat the researcher bot.

## How it works (one paragraph)

A substance is a hidden vector `s = U·c` living in a low-rank subspace (`r ≪ n`) — that low rank
*is* the discoverable structure. Measurements are **quadratic** in the latent code (with a monotone
readout), so along a blend path `a→b` the measured value traces a **curve** — often non-monotone.
That means you **cannot** just bisect: you sample a few points, *fit the curve*, and solve for the
mix ratio that hits the target. The goal is generated to sit on a real blend path and to be crossed
by several base pairs, so a curve-fitting "researcher" bot always wins — and certifies, alongside a
brute-force bot, that every world is winnable with `≪` the blind-search cost. The `trend` tool
(CLI + web) draws your measured points and the fitted parabola and tells you where it crosses the goal.

## Layout

```
engine/    pure, runtime-neutral core (Node + browser, zero build)
  kernel/  the swappable "world kernel" (linear today; a neural net = UIAC tomorrow)
themes/    vocabulary packs (alchemy · biolab · physics) — same math, different science
shared/    player-side analysis (correlation, k-means) used by CLI and web
cli/       terminal client + ASCII research instruments
web/       browser client (interactive scatter, correlation heatmap, trend)
bots/      brute-force + researcher solvers + the world validator
docs/      CONCEPT.md (the study) · PROTOTYPE_PLAN.md (decisions)
```

The engine never leaks hidden vectors: UIs only ever see a redacted `snapshot()`
(names, provenance, and the measurements the player paid to reveal).

## Difficulty

Difficulty = how hidden the structure is + how **curved** the response is.
`tutorial` (n6/r2, blend only) · `normal` (n10/r3, +cook, more curvature) ·
`hard` (n16/r4, +refine, strongest curvature, bigger world). Tolerance is **loose** (you model the
curve, you don't grind bisection); the goal path is always non-monotone. Worlds share via a seed code.
