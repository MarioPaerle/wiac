// Difficulty presets → world-generation parameters.
// Difficulty = how HIDDEN the structure is + how far/constrained + how CURVED the solution.
// Keys are append-only (their index is baked into share codes).

export const DIFFICULTY_KEYS = ["tutorial", "normal", "hard"];

export const DIFFICULTIES = {
  tutorial: {
    label: "Tutorial",
    n: 6, r: 2,
    kCenters: 2, kBase: 5, clusterNoise: 0.05,
    mMeasures: 3,
    readout: { kind: "id" },
    bRange: 0.4,
    curvature: 0.9,         // nonlinearity: 0 = linear (v0.1), >0 = curved measures
    ops: ["blend"],
    nConstraints: 1,
    epsFraction: 0.05,      // LOOSE tolerance — model the curve, don't grind bisection
    budget: 40,
    minPlayability: 1.5,
  },
  normal: {
    label: "Normal",
    n: 10, r: 3,
    kCenters: 3, kBase: 8, clusterNoise: 0.1,
    mMeasures: 5,
    readout: { kind: "tanh", A: 4, k: 0.7 },
    bRange: 0.6,
    curvature: 1.1,
    ops: ["blend", "cook"],
    nConstraints: 1,
    epsFraction: 0.04,
    budget: 80,
    minPlayability: 2,
    // (normal: bigger world, decent smart-vs-brute edge)
  },
  hard: {
    label: "Hard",
    n: 16, r: 4,
    kCenters: 4, kBase: 12, clusterNoise: 0.12,
    mMeasures: 7,
    readout: { kind: "tanh", A: 6, k: 0.5 },
    bRange: 0.8,
    curvature: 1.3,
    ops: ["blend", "cook", "refine"],
    nConstraints: 1,
    epsFraction: 0.03,
    budget: 130,
    minPlayability: 2,
  },
};

// XP cost model (shared by session AND bots so baselines are comparable).
export const COSTS = {
  measure: 1, // per (substance, measure) pair, cached reads are free
  synth: 2, // mix / cook / refine
  wrongSubmit: 3, // penalty for a failed submission
};
