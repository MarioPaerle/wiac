// Difficulty presets → world-generation parameters.
// Difficulty = how HIDDEN the structure is + how far/constrained the solution.
// Keys are append-only (their index is baked into share codes).

export const DIFFICULTY_KEYS = ["tutorial", "normal", "hard"];

export const DIFFICULTIES = {
  tutorial: {
    label: "Tutorial",
    n: 6, r: 2,
    kCenters: 2, kBase: 4, clusterNoise: 0.05,
    mMeasures: 3,
    readout: { kind: "id" },
    bRange: 0.4,
    ops: ["blend"],
    nConstraints: 1,
    epsFraction: 0.02,
    budget: 40,
    minPlayability: 5,   // QA: required AVERAGE smart-vs-brute ratio for this tier
    targetComboSize: 2, // target = convex combo of this many base substances
  },
  normal: {
    label: "Normal",
    n: 12, r: 4,
    kCenters: 3, kBase: 8, clusterNoise: 0.1,
    mMeasures: 6,
    readout: { kind: "tanh", A: 4, k: 0.7 },
    bRange: 0.6,
    ops: ["blend", "cook"],
    nConstraints: 1,
    epsFraction: 0.008,
    budget: 80,
    minPlayability: 5,   // QA: required AVERAGE ratio
    targetComboSize: 3,
  },
  hard: {
    label: "Hard",
    n: 24, r: 6,
    kCenters: 4, kBase: 14, clusterNoise: 0.15,
    mMeasures: 8,
    readout: { kind: "tanh", A: 6, k: 0.5 },
    bRange: 0.8,
    ops: ["blend", "cook", "refine"],
    nConstraints: 2,
    epsFraction: 0.02,
    budget: 150,
    minPlayability: 15,  // QA: required AVERAGE ratio
    targetComboSize: 4,
  },
};

// XP cost model (shared by session AND bots so baselines are comparable).
export const COSTS = {
  measure: 1, // per (substance, measure) pair, cached reads are free
  synth: 2, // mix / cook / refine
  wrongSubmit: 3, // penalty for a failed submission
};
