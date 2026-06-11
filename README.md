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
*is* the discoverable structure. Measurements are linear functionals (with a monotone readout that
hides the linearity), so blending two substances **interpolates** their measurements. The goal is
generated as a convex combination of starting substances, so it's always reachable: a single-value
target by **bisecting** a mix ratio (`O(log 1/ε)`), a two-value target by a convex-combination
**solve**. A brute-force bot and a "researcher" bot run at generation to certify each world is
winnable with `≪` the blind-search cost.

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

`tutorial` (n6/r2, blend only, 1 goal) · `normal` (n12/r4, +cook, monotone readout) ·
`hard` (n24/r6, +refine, **2 coupled goals**). Worlds are shareable by a short seed code.
