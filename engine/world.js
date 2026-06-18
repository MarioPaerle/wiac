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
  // identifiability: the OBSERVABLE measures must span the r-dim latent space, so a player can
  // identify the world (and infer any hidden instrument) from what they can actually measure.
  const M = gen.measures.filter((m) => !m.hidden).map((m) => m.a); // observable × r
  if (M.length < params.r) return false;
  const sv = singularValues(M);
  if (!(sv[params.r - 1] / (sv[0] || 1) > 1e-3)) return false;
  return true;
}

// Generate a world. `params` (optional) shallow-overrides the difficulty preset — this is the
// hook an agent/LLM uses to author worlds richer than plain random (tune curvature, shapes,
// hiddenCount, sizes, the goal-acceptance floor, …). See tools/agent-gen.js + README › "agentic
// generation". The override is recorded so the exact world can be reconstructed/replayed.
export function createWorld({ seed, difficulty = "normal", theme = "alchemy", kernel = linearKernel, params: overrides = null } = {}) {
  validateKernel(kernel);
  const base = DIFFICULTIES[difficulty];
  if (!base) throw new Error(`unknown difficulty "${difficulty}"`);
  const params = { ...base, ...(overrides || {}) };
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
        paramsOverride: overrides || null,
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
