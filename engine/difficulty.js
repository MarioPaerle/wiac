// Difficulty presets → world-generation parameters.
// Difficulty = how hidden the structure is + how NON-LINEAR the response + (hard) instruments to infer.
//
// Nonlinearity knobs: linScale (weight of the linear part — smaller ⇒ nonlinear dominates),
// curvature (nonlinear amplitude), minNonlinearity (a goal is rejected unless its blend path
// deviates ≥ this·range from the endpoint line), shapes (goals avoid "quad" when richer exist),
// startKnown (substances pre-characterized at t=0 = free prior data).
//
// DIFFICULTY_KEYS is APPEND-ONLY (its index is baked into share codes — never reorder, or old codes
// break). DIFFICULTY_ORDER is the easy→hard order for UIs/menus (decoupled from the key index).

export const DIFFICULTY_KEYS = ["tutorial", "normal", "hard", "basic"]; // append-only!
export const DIFFICULTY_ORDER = ["tutorial", "basic", "normal", "hard"]; // display order

export const DIFFICULTIES = {
  tutorial: {
    label: "Tutorial",
    n: 6, r: 2,
    kCenters: 2, kBase: 5, clusterNoise: 0.05,
    mMeasures: 3,
    readout: { kind: "id" },
    bRange: 0.4,
    linScale: 0.6, curvature: 0.85,
    shapes: ["bump", "quad"],
    minNonlinearity: 0.20,   // gentle: learn the loop; nonlinearity present but mild
    startKnown: 2,
    hiddenCount: 0,
    ops: ["blend"],
    nConstraints: 1,
    epsFraction: 0.07,
    budget: 80,
    minPlayability: 1.3,
  },
  basic: {
    label: "Basic",
    n: 8, r: 3,
    kCenters: 2, kBase: 6, clusterNoise: 0.08,
    mMeasures: 4,
    readout: { kind: "id" },
    bRange: 0.5,
    linScale: 0.55, curvature: 1.1,
    shapes: ["bump", "satur", "quad"],
    minNonlinearity: 0.35,   // a small but real non-linear puzzle, no hidden instruments
    startKnown: 2,
    hiddenCount: 0,
    ops: ["blend"],
    nConstraints: 1,
    epsFraction: 0.06,
    budget: 120,
    minPlayability: 1.0,   // gentle tier: requirement is "always solvable"; brute may be competitive
  },
  normal: {
    label: "Normal",
    n: 10, r: 3,
    kCenters: 3, kBase: 8, clusterNoise: 0.1,
    mMeasures: 5,
    readout: { kind: "tanh", A: 4, k: 0.7 },
    bRange: 0.6,
    linScale: 0.5, curvature: 1.3,
    shapes: ["bump", "satur", "quad"],
    minNonlinearity: 0.45,
    startKnown: 2,
    hiddenCount: 0,
    ops: ["blend", "cook"],
    nConstraints: 1,
    epsFraction: 0.05,
    budget: 170,
    minPlayability: 1.8,
  },
  hard: {
    label: "Hard",
    n: 16, r: 4,
    kCenters: 4, kBase: 12, clusterNoise: 0.12,
    mMeasures: 7,
    readout: { kind: "tanh", A: 6, k: 0.5 },
    bRange: 0.8,
    linScale: 0.45, curvature: 1.5,
    shapes: ["bump", "satur"],
    minNonlinearity: 0.55,
    startKnown: 3,
    hiddenCount: 2,
    goalOnHidden: true,
    ops: ["blend", "cook", "refine"],
    nConstraints: 1,
    epsFraction: 0.045,
    budget: 280,
    minPlayability: 1.8,
  },
};

// XP cost model: MEASURING is cheap (think with data), ACTING (synthesis) is expensive.
export const COSTS = {
  measure: 1,
  synth: 3,
  wrongSubmit: 4,
};
