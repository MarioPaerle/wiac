// THE LEAK BOUNDARY. Builds a UI-safe view of a session.
// Constructed field-by-field from a whitelist — there is NO code path that copies a
// hidden vector (`vec`) into the snapshot. Substance entries simply have no `vec` key.

export function buildSnapshot(session) {
  const w = session.world;
  const theme = w.theme;

  const measures = w.measures.map((m, i) => ({ id: m.id, label: theme.measures[i] ?? m.id, hidden: !!m.hidden }));
  const measureLabel = (id) => measures.find((m) => m.id === id)?.label ?? id;

  const ops = w.ops.map((o) => ({
    id: o.id,
    label: theme.ops[o.id] ?? o.id,
    arity: o.arity,
    hasLambda: o.kind === "blend",
  }));

  const substances = session.substances.map((s) => ({
    id: s.id,
    name: s.name,
    tags: s.tags.slice(),
    origin: s.origin, // provenance only (no vector)
    measurements: { ...s.known }, // ONLY values the player paid to reveal
  }));

  const goal = {
    constraints: w.goal.constraints.map((c) => ({
      measureId: c.measureId,
      measureLabel: measureLabel(c.measureId),
      target: round(c.target),
      tol: round(c.eps),
      hidden: !!c.hidden,
    })),
    description: goalDescription(w.goal, measureLabel),
  };

  return {
    shareCode: w.shareCode,
    theme: { id: theme.id, label: theme.label, substanceWord: theme.substanceWord, flavor: theme.flavor },
    difficulty: w.meta.difficulty,
    n: undefined, // hidden dimension intentionally NOT exposed
    budget: { ...session.budget, remaining: session.budget.max - session.budget.spent },
    measures,
    ops,
    substances,
    goal,
    notebook: {
      notes: session.notebook.notes.slice(),
      hypotheses: session.notebook.hypotheses.map((h) => ({ ...h })),
    },
    status: session.status,
    strikes: session.strikes,
    bestDelta: session.bestDelta(),
    log: session.log.slice(-40),
  };
}

function goalDescription(goal, measureLabel) {
  const parts = goal.constraints.map((c) => `${measureLabel(c.measureId)} ≈ ${round(c.target)} (±${round(c.eps)})`);
  const hiddenGoal = goal.constraints.some((c) => c.hidden);
  return `Find a substance with ${parts.join(" AND ")}` + (hiddenGoal ? " — this instrument runs on EVERY original sample (measure it cheaply to gather training data) but NOT on your syntheses; fit a model and INFER it. Tip: a global fit is often unreliable — interpolate locally between bracketing originals (try loocv())." : "");
}

function round(x, d = 3) {
  const p = 10 ** d;
  return Math.round(x * p) / p;
}
