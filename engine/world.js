// World generation: deterministic from {seed, difficulty, theme}. Owns the hidden vectors.
// Generation delegates all numeric semantics to a swappable WorldKernel (default: linearKernel).

import { mulberry32 } from "./prng.js";
import { DIFFICULTIES } from "./difficulty.js";
import { linearKernel } from "./kernel/linear-kernel.js";
import { validateKernel } from "./kernel/kernel-interface.js";
import { encodeShareCode } from "./seedcode.js";
import { singularValues } from "./linalg.js";
import { getTheme } from "../themes/registry.js";

// Light, dependency-free validation run at generation time (the heavy bot-based
// playability gate lives in bots/validate-world.js to avoid a circular import).
function validate(gen, params) {
  if (!gen.goal || gen.goal._failed || gen.goal.constraints.length === 0) return false;
  // identifiability: the linear parts of the measures must span the r-dim latent space
  const M = gen.measures.map((m) => m.a); // m × r (latent linear parts)
  if (M.length < params.r) return false;
  const sv = singularValues(M);
  if (!(sv[params.r - 1] / (sv[0] || 1) > 1e-3)) return false;
  return true;
}

export function createWorld({ seed, difficulty = "normal", theme = "alchemy", kernel = linearKernel } = {}) {
  validateKernel(kernel);
  const params = DIFFICULTIES[difficulty];
  if (!params) throw new Error(`unknown difficulty "${difficulty}"`);
  getTheme(theme); // throws on unknown theme early

  const MAX_TRIES = 40;
  let s = seed >>> 0;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const rng = mulberry32(s);
    const gen = kernel.generate(rng, params);
    if (validate(gen, params)) {
      return {
        meta: { seed: s, requestedSeed: seed >>> 0, difficulty, theme, n: params.n, r: params.r, kernelId: kernel.id },
        shareCode: encodeShareCode({ seed: s, difficulty, theme }),
        params,
        theme: getTheme(theme),
        kernel,
        substances: gen.substances, // base substances only (hidden vecs inside)
        measures: gen.measures,
        ops: gen.ops,
        goal: gen.goal,
        hidden: gen.hidden,
      };
    }
    s = (s + 1) >>> 0;
  }
  throw new Error(`world generation failed after ${MAX_TRIES} tries (difficulty=${difficulty})`);
}
