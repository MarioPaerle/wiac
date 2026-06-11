// Difficulty presets → world-generation parameters.
// Difficulty = how hidden the structure is + how far/constrained + how NON-LINEAR the response +
// (hard) how many instruments are unavailable and must be inferred.
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
    curvature: 0.9,
    shapes: ["quad", "bump"],
    minNonlinearity: 0.12,  // goal path must deviate ≥ this·range from the endpoint line
    hiddenCount: 0,
    ops: ["blend"],
    nConstraints: 1,
    epsFraction: 0.06,
    budget: 45,
    minPlayability: 1.5,
  },
  normal: {
    label: "Normal",
    n: 10, r: 3,
    kCenters: 3, kBase: 8, clusterNoise: 0.1,
    mMeasures: 5,
    readout: { kind: "tanh", A: 4, k: 0.7 },
    bRange: 0.6,
    curvature: 1.15,
    shapes: ["bump", "satur", "quad"],
    minNonlinearity: 0.22,  // strongly nonlinear → mental endpoint-interpolation fails
    hiddenCount: 0,
    ops: ["blend", "cook"],
    nConstraints: 1,
    epsFraction: 0.05,
    budget: 100,
    minPlayability: 1.8,
  },
  hard: {
    label: "Hard",
    n: 16, r: 4,
    kCenters: 4, kBase: 12, clusterNoise: 0.12,
    mMeasures: 7,
    readout: { kind: "tanh", A: 6, k: 0.5 },
    bRange: 0.8,
    curvature: 1.35,
    shapes: ["bump", "satur"],
    minNonlinearity: 0.28,
    hiddenCount: 2,          // instruments you cannot run on your own syntheses → infer them
    goalOnHidden: true,      // the goal is on a hidden instrument: predict it from the others
    ops: ["blend", "cook", "refine"],
    nConstraints: 1,
    epsFraction: 0.045,
    budget: 190,
    minPlayability: 1.8,
  },
};

// XP cost model: MEASURING is cheap (think with data), ACTING (synthesis) is expensive.
export const COSTS = {
  measure: 1,
  synth: 3,
  wrongSubmit: 4,
};
