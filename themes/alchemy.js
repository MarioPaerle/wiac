export default {
  id: "alchemy",
  label: "Alchemy Lab",
  flavor: "A crate of unlabeled reagents arrived. Their compositions are unknown — only your instruments speak.",
  substanceWord: "reagent",
  namePrefix: "Reagent",
  goalVerb: "Synthesize",
  // index-aligned with measures m0, m1, ... (need >= 8 for the hard tier)
  measures: ["acidity", "density", "luminance", "volatility", "toxicity", "viscosity", "salinity", "resonance"],
  ops: { blend: "blend", cook: "distill", refine: "purify" },
};
