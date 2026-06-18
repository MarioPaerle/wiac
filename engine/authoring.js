// HAND-AUTHORING a world. Instead of tuning the random generator, an agent/LLM declares the
// world's *meaning* — families (the hidden clusters/analogies), substances drawn from them,
// instruments (response functions: an axis between families, a resonance peak on a family, a
// saturating channel, or an ANALOGY that is a combination of other instruments), operations, and
// which instrument the goal is on. buildWorld(spec) turns that into a real, engine-compatible
// world; run computeBaselines() on it to check it's solvable and how interesting it is.
//
// Deterministic from spec.seed (so an authored world is reproducible & replayable). The families
// are HIDDEN structure for the player to discover — they are NOT labelled in the snapshot.

import { mulberry32 } from "./prng.js";
import { columnOrthonormal, fromLatent, gaussianVec, normalize, randomOrthogonal, matVec, add, scale } from "./linalg.js";
import { selectGoal } from "./kernel/linear-kernel.js";
import { linearKernel } from "./kernel/linear-kernel.js";
import { getTheme } from "../themes/registry.js";

const zeros = (n) => new Array(n).fill(0);

// Fluent builder (optional sugar). The JSON spec passed to buildWorld is the canonical interface.
export class WorldBuilder {
  constructor(opts = {}) { this.spec = { seed: 1, theme: "alchemy", families: [], instruments: [], operations: ["blend"], ...opts }; }
  family(name, o = {}) { this.spec.families.push({ name, ...o }); return this; }
  instrument(name, o = {}) { this.spec.instruments.push({ name, ...o }); return this; }
  operation(kind) { this.spec.operations.push(kind); return this; }
  goal(o) { this.spec.goal = o; return this; }
  build() { return buildWorld(this.spec); }
}

// spec → world (same shape as createWorld's output, drivable by GameSession + bots).
export function buildWorld(spec) {
  const rng = mulberry32((spec.seed ?? 1) >>> 0);
  const theme = getTheme(spec.theme || "alchemy");
  const fams = spec.families || [];
  if (!fams.length) throw new Error("authoring: define at least one family");
  const r = Math.max(2, Math.min(spec.rank ?? fams.length, 8));
  const n = Math.max(spec.ambient ?? r + 3, r + 1);
  const Ucols = columnOrthonormal(n, r, rng);

  // --- family centers (the hidden analogies) ---
  const centerByName = {};
  for (const f of fams) {
    if (f.at && f.at.length === r) centerByName[f.name] = f.at.slice();
    else if (f.between) centerByName[f.name] = meanOf(f.between.map((nm) => centerByName[nm] || zeros(r)));
    else centerByName[f.name] = scale(normalize(gaussianVec(r, rng)), 0.9 + 0.3 * rng.next());
  }
  const mu = meanOf(Object.values(centerByName));

  // --- substances drawn from families (ids s0..; family kept on origin, NOT shown to the player) ---
  const substances = []; let si = 0;
  for (const f of fams) {
    const ctr = centerByName[f.name], spread = f.spread ?? 0.08, count = f.count ?? 3;
    for (let k = 0; k < count; k++) {
      const code = ctr.map((x) => x + rng.gauss() * spread);
      substances.push({ id: `s${si++}`, code, vec: fromLatent(Ucols, code), origin: { kind: "genesis", family: f.name } });
    }
  }
  const baseCodes = substances.map((s) => s.code);

  // --- instruments → measures (kernel-format; built in order so "analogy" can reference earlier) ---
  const measures = []; const byName = {};
  (spec.instruments || []).forEach((ins, idx) => {
    const readout = ins.readout || { kind: "id" };
    const m = { id: `m${idx}`, label: ins.name, readout, hidden: !!ins.hidden, b: ins.b ?? rng.range(-0.4, 0.4) };
    const dir = () => normalize(gaussianVec(r, rng));
    switch (ins.shape) {
      case "axis": { // linear gradient from one family to another (e.g. a pH axis)
        const a = sub(centerByName[ins.to] || dir(), centerByName[ins.from] || zeros(r));
        m.shape = "linear"; m.a = normalize(a);
        break;
      }
      case "bump": { // resonance: peaks for substances near a family / point
        m.shape = "bump"; m.a = scale(dir(), 0.5);
        m.center = ins.peaksAt ? (centerByName[ins.peaksAt] || dir()) : (ins.at || dir());
        const sigma = ins.width ?? 0.6; m.invSig2 = 1 / (2 * sigma * sigma);
        m.amp = (ins.amp ?? 2.4) * (ins.sign === "-" ? -1 : 1);
        break;
      }
      case "satur": { // saturating / asymptotic channel
        m.shape = "satur"; m.a = scale(dir(), 0.4); m.u = dir(); m.k = ins.k ?? 1.6;
        m.amp = (ins.amp ?? 2.4) * (ins.sign === "-" ? -1 : 1);
        break;
      }
      case "analogy": { // a combination of other instruments' linear parts → correlated/redundant
        const refs = (ins.of || []).map((nm) => byName[nm]).filter(Boolean);
        const w = ins.weights || refs.map(() => 1 / (refs.length || 1));
        let a = zeros(r);
        refs.forEach((rm, t) => { a = add(a, scale(rm.a || zeros(r), w[t] ?? 0)); });
        const noise = ins.noise ?? 0.04;
        a = a.map((x) => x + rng.gauss() * noise);
        m.shape = "linear"; m.a = a;
        break;
      }
      default: { m.shape = "linear"; m.a = normalize(gaussianVec(r, rng)); } // plain linear
    }
    measures.push(m); byName[ins.name] = m;
  });
  if (!measures.length) throw new Error("authoring: define at least one instrument");

  // --- operations ---
  const ops = [];
  for (const kind of spec.operations || ["blend"]) {
    if (kind === "blend") ops.push({ id: "blend", kind: "blend", arity: 2 });
    else if (kind === "contract") { const Q = randomOrthogonal(r, rng), rho = 0.8, A = Q.map((row) => row.map((x) => x * rho)); ops.push({ id: "cook", kind: "affineLatent", arity: 1, latent: { A, b: matVec(A, mu).map((x, i) => mu[i] - x) } }); }
    else if (kind === "rotate") ops.push({ id: "refine", kind: "affineLatent", arity: 1, latent: { A: randomOrthogonal(r, rng), b: zeros(r) } });
  }
  if (!ops.some((o) => o.kind === "blend")) ops.unshift({ id: "blend", kind: "blend", arity: 2 });

  // --- goal: on the requested instrument if given, with solvability fallbacks ---
  const wantId = spec.goal?.instrument ? byName[spec.goal.instrument]?.id : null;
  const epsFraction = spec.epsFraction ?? 0.05;
  const args = { Ucols, baseCodes, substances, measures, epsFraction };
  // prefer a clearly non-linear goal (more interesting); relax only if the spec can't support it
  let goal = selectGoal({ ...args, rng: mulberry32(99), restrictToId: wantId, minNonlinearity: 0.35 });
  if (goal._failed && wantId) goal = selectGoal({ ...args, rng: mulberry32(7), restrictToId: wantId, minNonlinearity: 0.12 });
  if (goal._failed) goal = selectGoal({ ...args, rng: mulberry32(123), minNonlinearity: 0.35 });
  if (goal._failed) goal = selectGoal({ ...args, rng: mulberry32(5), minNonlinearity: 0.12 });
  if (goal._failed) throw new Error("authoring: couldn't place a solvable goal — try more/spread-out families, a non-linear goal instrument, or more substances");

  substances.forEach((s) => delete s.code); // codes were scratch; keep vecs hidden
  return {
    meta: { seed: spec.seed ?? 1, difficulty: "authored", theme: spec.theme || "alchemy", n, r, kernelId: linearKernel.id, authored: true },
    shareCode: "authored",
    spec,
    paramsOverride: null,
    params: { epsFraction, budget: spec.budget ?? Math.round(40 + 12 * substances.length), startKnown: spec.startKnown ?? 2, r, n, nConstraints: 1 },
    theme,
    kernel: linearKernel,
    substances: substances.map((s) => ({ id: s.id, vec: s.vec, origin: s.origin })),
    measures,
    ops,
    goal,
    hidden: { Ucols, centers: Object.values(centerByName), mu, n, r },
  };
}

function meanOf(vs) { const r = vs[0].length; const out = zeros(r); for (const v of vs) for (let i = 0; i < r; i++) out[i] += v[i] / vs.length; return out; }
function sub(a, b) { return a.map((x, i) => x - b[i]); }
