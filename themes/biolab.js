export default {
  id: "biolab",
  label: "Synthetic Biology Lab",
  flavor: "Unlabeled strains from a deep-sea sample. Culture them, read their traits, breed toward the target phenotype.",
  substanceWord: "strain",
  namePrefix: "Strain",
  goalVerb: "Culture",
  measures: ["growth-rate", "fluorescence", "toxin-output", "motility", "metabolism", "ph-tolerance", "biomass", "expression"],
  ops: { blend: "cross-breed", cook: "incubate", refine: "mutate" },
};
