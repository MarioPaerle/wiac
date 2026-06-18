# WIAC — World In A Context

A science-discovery game. You're dropped into an unknown world of hidden **substances**, a few
**instruments** that measure them, and **operations** that combine them. The only numbers you ever
see are instrument readings. Your job is to figure out the hidden structure — cluster the
substances, model how the instruments respond, infer what you can't measure directly — and
synthesize a substance that hits a target, in as few experiments as possible.

It's built so the backbone runs in the terminal, with the same engine driving a web UI. No LLM is
involved in the game itself: every world is generated from linear algebra + controlled clustering,
and every generated world is **verified solvable** (and solvable far more cheaply by reasoning than
by brute force) before it's served.

Zero install, zero build. Just Node ≥ 18.

```bash
git clone <this repo> wiac && cd wiac
node cli/main.js            # play in the terminal
node serve.js               # play in the browser → http://localhost:5173/web/
```

---

## The game in 30 seconds

- **Measure** an instrument on a substance — cheap (1 XP). This is how you gather data.
- **Mix / cook** substances to synthesize new ones — expensive (3 XP). This is how you act.
- **Analyse for free** — scatter plots (find clusters), a trend view (see an instrument's response
  curve along a blend), a correlation table (spot redundant instruments), and a numpy-style
  console (fit models, infer hidden instruments).
- **Submit** a substance when you think it meets the goal.

The catch: instrument responses are **non-linear** (often a curve or a resonance peak), so you
can't just eyeball two readings and interpolate — you have to sample and model. On the hardest
tier some instruments are **hidden** (readable only on the original samples, not your syntheses),
so you must *infer* them from the others. Measuring is cheap and acting is expensive on purpose:
think with data, act sparingly.

### Difficulty

Four tiers, easy → hard:

| tier | what's new |
|---|---|
| `tutorial` | gentle — learn the loop; mild non-linearity, blend only |
| `basic` | a small real non-linear puzzle |
| `normal` | bigger, stronger non-linearity, adds a `cook` operation |
| `hard` | hidden instruments — the goal is on one, so you predict it from the others |

Every world has a short **share code** (e.g. `fcfd22`) that encodes seed + difficulty + theme, so a
world is fully reproducible and shareable. Themes (`alchemy`, `biolab`, `physics`) only rename
things — the math underneath is identical.

---

## How worlds are generated

Each world comes from a seed. `createWorld({ seed, difficulty, theme })`:

1. builds a low-rank hidden space (`s = U·c`, with `r ≪ n`) — the low rank *is* the discoverable
   structure (substances fall into families);
2. gives each instrument a hidden, non-linear response shape (quadratic / resonance bump /
   saturating);
3. picks a goal that sits on a real blend path, is **non-linear enough** that endpoint-interpolation
   fails, and is crossed by several base pairs (so a solution provably exists and is reachable);
4. runs two reference bots — a brute-force baseline and a deterministic "researcher" solver — to
   **certify** the world is winnable and far cheaper to reason about than to brute-force.

The "researcher" and "brute-force" labels you see are **deterministic code** (`bots/`), not LLMs.

---

## For agents

Two black-box interfaces let an external agent (or another program) **play** and **generate**
worlds without touching the engine internals. Both are plain stateless CLIs: each call is one
process, reads/writes a JSON save file, and prints a JSON snapshot.

### Play a world — `tools/agent-play.js`

```bash
node tools/agent-play.js new --code fcfd22 --save /tmp/run.json   # or: --seed N -d hard -t physics
node tools/agent-play.js measure s0 m1   --save /tmp/run.json     # "all" for every instrument
node tools/agent-play.js mix s0 s1 0.5   --save /tmp/run.json
node tools/agent-play.js cook s0         --save /tmp/run.json     # or: refine s0
node tools/agent-play.js calc "np.corr(col('m0'), col('m1'))" --save /tmp/run.json
node tools/agent-play.js submit x3       --save /tmp/run.json
node tools/agent-play.js help
```

Every command prints `{ ok, result?, value?, snapshot }`. The snapshot is exactly what a human
sees — instrument readings, provenance, goal, budget — and **never** the hidden vectors. The agent
reads the JSON, reasons, and issues the next command; state lives in the save file between calls.
For a fair blind playtest, the agent should reason only from the snapshots and not read the engine
source. The `calc` console exposes `M, subs, measures, col(name), row(id), goal, pairs(a,b),
design(features,target), loocv(features,target)` and `np.mean/std/corr/polyfit/polyval/lstsq/…`.

### Generate worlds — `tools/agent-gen.js` (+ the `params` API)

Plain random is fine, but an agent/LLM can author **more interesting** worlds by steering the
generator and reading a quality report, then iterating.

```bash
node tools/agent-gen.js -d normal --seed 42
node tools/agent-gen.js -d normal --params '{"curvature":1.9,"minNonlinearity":0.6,"hiddenCount":1,"goalOnHidden":true,"mMeasures":6}'
```

It prints, as JSON: whether the world is solvable, the goal's non-linearity, the researcher vs
brute-force XP and their ratio (how much the world rewards cleverness), the instrument shapes, and
the exact `agent-play` command to play that world. `--params` shallow-overrides any field of the
difficulty preset (`engine/difficulty.js`): `n, r, kBase, mMeasures, shapes, linScale, curvature,
minNonlinearity, hiddenCount, goalOnHidden, ops, epsFraction, budget, …`. The override is recorded
in the save file, so an agent-authored world is reproducible and directly playable (pass the same
`--params` to `agent-play`).

The loop for an LLM: propose params → `agent-gen` → read the quality report → adjust → repeat until
it's solvable, strongly non-linear, and rewards reasoning (high researcher-vs-brute ratio).

### Author a world from scratch (a spec)

Beyond tuning the random generator, an agent can *declare a world's meaning* and get something more
intentional than random low-rank noise. A spec (JSON — `examples/world.spec.json`) defines:

- **families** — the hidden clusters / analogies (`{name, count, spread}`; `between:[...]` places a
  family between others, e.g. salts between acids and bases). Substances are drawn from families;
  families are *hidden* — the player discovers them by clustering.
- **instruments** — response functions with real semantics:
  `axis` (a linear gradient `from` one family `to` another, e.g. a pH axis) · `bump` (a resonance
  that `peaksAt` a family) · `satur` (a saturating channel) · `analogy` (a weighted combination `of`
  other instruments — deliberately correlated/redundant, so the correlation table reveals it) ·
  any can be `hidden`.
- **operations** (`blend`, `contract`, `rotate`) and a **goal** (`{instrument}` to aim it).

```bash
node tools/agent-gen.js  --spec examples/world.spec.json     # build + quality report
node tools/agent-play.js new --spec examples/world.spec.json --save /tmp/run.json   # then play it
```

It's deterministic from `spec.seed`, reproducible/replayable, and `buildWorld(spec)` is exported from
`engine/index.js` (also `new WorldBuilder().family(...).instrument(...).goal(...).build()`). The
build runs the same solvability + quality checks, so the author iterates the spec until the world is
solvable and interesting.

### Programmatic API (Node)

Everything above is thin wrappers over `engine/index.js`:

```js
import { createWorld, GameSession, actions as A } from "./engine/index.js";
import { computeBaselines } from "./bots/baselines.js";

const world   = createWorld({ seed: 42, difficulty: "normal", theme: "physics",
                              params: { curvature: 1.8, hiddenCount: 1, goalOnHidden: true } });
const quality = computeBaselines(world);          // { smartCost, bruteCost, playability, thetaMin }
const game    = new GameSession(world);
game.apply(A.measure("s0", "m1"));                // drive it
const view    = game.snapshot();                  // UI-safe, vector-free
```

---

## Repo layout

```
engine/    runtime-neutral core (runs in Node and the browser, zero build)
  index.js     the only module UIs/agents import
  world.js     createWorld (+ the params override) and the generation validator
  session.js   GameSession: state machine, the leak boundary, save/restore
  snapshot.js  the UI-safe view — hidden vectors never cross it
  difficulty.js  all the tiers + tunable generation knobs
  kernel/      the swappable "world kernel" (the hidden numeric semantics)
shared/    player-side analysis (correlation, k-means, curve fitting) + the numpy-style console
cli/       terminal client (ASCII UI, charts, history)
web/       browser client (glass UI, interactive charts, console, log) — same engine
bots/      brute-force + researcher solvers, baselines, the offline world validator
tools/     agent-play.js (black-box play) · agent-gen.js (authoring + evaluation)
docs/      CONCEPT.md (the design study) · HANDOVER.md · PROTOTYPE_PLAN.md
```

The engine never leaks hidden vectors — UIs and agents only ever receive a redacted `snapshot()`.

---

## Develop

```bash
node --test                       # unit tests (incl. the hidden-vector leak boundary)
node bots/validate-world.js       # QA: every world solvable & researcher ≪ brute (exit 1 on fail)
```

See `docs/CONCEPT.md` for the design and `docs/HANDOVER.md` for the engineering map and roadmap.

---

© Mario Prignano. MIT License.
