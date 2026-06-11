// GameSession: holds the world + run state, exposes allowedActions / apply / snapshot.
// UIs and bots drive a session and render its snapshot; none of them touch hidden vectors.

import { COSTS } from "./difficulty.js";
import { buildSnapshot } from "./snapshot.js";
import { createWorld } from "./world.js";
import { decodeShareCode } from "./seedcode.js";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export class GameSession {
  constructor(world, opts = {}) {
    this.world = world;
    this.budget = { max: opts.budget ?? world.params.budget, spent: 0 };
    this.status = "playing"; // playing | won | lost
    this.strikes = 0;
    this.log = [];
    this.notebook = { notes: [], hypotheses: [] };
    this._derived = 0;

    const prefix = world.theme.namePrefix;
    this.substances = world.substances.map((s, i) => ({
      id: s.id,
      vec: s.vec, // hidden — never reaches a snapshot
      origin: s.origin,
      name: `${prefix}-${LETTERS[i] ?? i}`,
      tags: [],
      known: {},
    }));
  }

  // ---- introspection ----
  get(id) { return this.substances.find((s) => s.id === id); }

  measureLabel(id) {
    const i = this.world.measures.findIndex((m) => m.id === id);
    return this.world.theme.measures[i] ?? id;
  }

  allowedActions() {
    const playing = this.status === "playing";
    return [
      { type: "measure", enabled: playing, needs: ["substanceId", "measureId"], cost: COSTS.measure },
      { type: "mix", enabled: playing, needs: ["aId", "bId", "lambda"], cost: COSTS.synth },
      ...(this.world.ops.some((o) => o.kind === "affineLatent")
        ? [{ type: "cook", enabled: playing, needs: ["substanceId", "opId"], cost: COSTS.synth }]
        : []),
      { type: "submit", enabled: playing, needs: ["substanceId"], cost: 0 },
      { type: "name", enabled: true, needs: ["substanceId", "label"], cost: 0 },
      { type: "tag", enabled: true, needs: ["substanceId", "tagName"], cost: 0 },
      { type: "note", enabled: true, needs: ["text"], cost: 0 },
    ];
  }

  // ---- the one mutator ----
  apply(action) {
    const costed = ["measure", "measureAll", "mix", "cook", "submit"].includes(action.type);
    if (costed && this.status !== "playing") {
      return { ok: false, message: `game over (${this.status})` };
    }
    switch (action.type) {
      case "measure": return this._measure(action.substanceId, action.measureId);
      case "measureAll": return this._measureAll(action.substanceId);
      case "mix": return this._synthBlend(action.aId, action.bId, action.lambda);
      case "cook": return this._synthUnary(action.substanceId, action.opId);
      case "submit": return this._submit(action.substanceId);
      case "name": return this._annotate(action.substanceId, { name: action.label });
      case "tag": return this._annotate(action.substanceId, { tag: action.tagName });
      case "note": this.notebook.notes.push({ text: action.text, substanceId: action.substanceId ?? null });
        return { ok: true, message: "noted" };
      case "hypo": return this._hypo(action.text, action.predicate);
      default: return { ok: false, message: `unknown action "${action.type}"` };
    }
  }

  _charge(x) {
    this.budget.spent += x;
    if (this.budget.spent >= this.budget.max && this.status === "playing") this.status = "lost";
  }

  _measure(subId, measureId) {
    const s = this.get(subId);
    if (!s) return { ok: false, message: `no substance ${subId}` };
    const m = this.world.measures.find((x) => x.id === measureId);
    if (!m) return { ok: false, message: `no measure ${measureId}` };
    if (m.hidden && s.origin.kind !== "genesis" && !(measureId in s.known))
      return { ok: false, message: `${this.measureLabel(measureId)} can't be run on synthesized samples — infer it from the others` };
    const cached = measureId in s.known;
    const value = cached ? s.known[measureId] : this.world.kernel.measure(this.world, s.vec, measureId);
    if (!cached) { s.known[measureId] = value; this._charge(COSTS.measure); }
    this.log.push({ kind: "measure", subId, measureId, value, free: cached });
    return { ok: true, value, cost: cached ? 0 : COSTS.measure, cached };
  }

  _measureAll(subId) {
    const results = this.world.measures.map((m) => this._measure(subId, m.id));
    return { ok: true, results };
  }

  _newDerived(vec, origin) {
    const id = `x${this._derived++}`;
    const s = { id, vec, origin, name: id, tags: [], known: {} };
    this.substances.push(s);
    return s;
  }

  _synthBlend(aId, bId, lambda) {
    const a = this.get(aId), b = this.get(bId);
    if (!a || !b) return { ok: false, message: "unknown substance(s)" };
    const t = Math.max(0, Math.min(1, Number(lambda)));
    const vec = this.world.kernel.apply(this.world, "blend", [a.vec, b.vec], t);
    const s = this._newDerived(vec, { kind: "mix", a: aId, b: bId, lambda: t });
    this._charge(COSTS.synth);
    this.log.push({ kind: "mix", id: s.id, a: aId, b: bId, lambda: t });
    return { ok: true, newSubstanceId: s.id, cost: COSTS.synth };
  }

  _synthUnary(subId, opId) {
    const a = this.get(subId);
    if (!a) return { ok: false, message: `no substance ${subId}` };
    const op = this.world.ops.find((o) => o.id === opId && o.kind === "affineLatent");
    if (!op) return { ok: false, message: `no operation ${opId}` };
    const vec = this.world.kernel.apply(this.world, opId, [a.vec]);
    const s = this._newDerived(vec, { kind: opId, from: subId });
    this._charge(COSTS.synth);
    this.log.push({ kind: opId, id: s.id, from: subId });
    return { ok: true, newSubstanceId: s.id, cost: COSTS.synth };
  }

  _submit(subId) {
    const s = this.get(subId);
    if (!s) return { ok: false, message: `no substance ${subId}` };
    const res = this.world.kernel.satisfiesGoal(this.world, s.vec);
    if (res.solved) {
      this.status = "won";
      this.log.push({ kind: "submit", subId, solved: true, xp: this.budget.spent });
      return { ok: true, solved: true, perError: res.perError, xpUsed: this.budget.spent };
    }
    this.strikes++;
    this._charge(COSTS.wrongSubmit);
    this.log.push({ kind: "submit", subId, solved: false });
    return { ok: true, solved: false, perError: res.perError, penalty: COSTS.wrongSubmit };
  }

  _annotate(subId, { name, tag }) {
    const s = this.get(subId);
    if (!s) return { ok: false, message: `no substance ${subId}` };
    if (name) s.name = name;
    if (tag) { if (!s.tags.includes(tag)) s.tags.push(tag); }
    return { ok: true };
  }

  _hypo(text, predicate) {
    const h = { id: `h${this.notebook.hypotheses.length}`, text, predicate: predicate ?? null };
    this.notebook.hypotheses.push(h);
    return { ok: true, hypoId: h.id };
  }

  // distance-to-goal from KNOWN readings only (no leak): null if no substance has all
  // goal-constraint measures revealed yet.
  bestDelta() {
    const cons = this.world.goal.constraints;
    let best = null;
    for (const s of this.substances) {
      if (!cons.every((c) => c.measureId in s.known)) continue;
      const worst = Math.max(...cons.map((c) => Math.abs(s.known[c.measureId] - c.target)));
      if (best === null || worst < best.worst) best = { id: s.id, worst };
    }
    return best;
  }

  isSolved() { return this.status === "won"; }
  snapshot() { return buildSnapshot(this); }

  // ---- persistence (vec-free) ----
  serialize() {
    return {
      version: 1,
      shareCode: this.world.shareCode,
      budget: this.budget,
      status: this.status,
      strikes: this.strikes,
      derived: this._derived,
      substances: this.substances.map((s) => ({ id: s.id, origin: s.origin, name: s.name, tags: s.tags, known: s.known })),
      notebook: this.notebook,
      log: this.log,
    };
  }

  static restore(runState) {
    const { seed, difficulty, theme } = decodeShareCode(runState.shareCode);
    const world = createWorld({ seed, difficulty, theme });
    const session = new GameSession(world, { budget: runState.budget.max });
    // rebuild derived substances by replaying provenance in creation order
    const baseById = new Map(session.substances.map((s) => [s.id, s]));
    const byId = new Map(baseById);
    const derived = runState.substances.filter((s) => s.origin.kind !== "genesis");
    for (const ds of derived) {
      let vec;
      if (ds.origin.kind === "mix") {
        vec = world.kernel.apply(world, "blend", [byId.get(ds.origin.a).vec, byId.get(ds.origin.b).vec], ds.origin.lambda);
      } else {
        vec = world.kernel.apply(world, ds.origin.kind, [byId.get(ds.origin.from).vec]);
      }
      const s = { id: ds.id, vec, origin: ds.origin, name: ds.name, tags: ds.tags, known: ds.known };
      session.substances.push(s); byId.set(ds.id, s);
    }
    // restore visible annotations on base substances + run state
    for (const rs of runState.substances) {
      const s = byId.get(rs.id);
      if (s) { s.name = rs.name; s.tags = rs.tags; s.known = rs.known; }
    }
    session.budget = runState.budget;
    session.status = runState.status;
    session.strikes = runState.strikes;
    session._derived = runState.derived;
    session.notebook = runState.notebook;
    session.log = runState.log;
    return session;
  }
}
