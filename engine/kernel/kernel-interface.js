// The WorldKernel contract — the single seam the whole engine talks to.
// Today: linear-kernel.js. Tomorrow (UIAC): a kernel wrapping a fixed neural net,
// implementing the SAME methods. UI and game-loop never know which one is underneath.
//
// A WorldKernel must implement:
//   id: string
//   generate(rng, params) -> {
//       substances: [{ id, vec:number[], origin }],   // STARTING (base) substances
//       measures:   [{ id, w:number[], b:number, readout }],
//       ops:        [{ id, kind, arity, latent? }],
//       goal:       { constraints:[{measureId, target, eps}], witness },
//   }
//   measure(world, vec, measureId) -> number          // ℝⁿ → ℝ (observed value)
//   apply(world, opId, vecs, lambda?) -> number[]      // produce a new hidden vector
//   satisfiesGoal(world, vec) -> { solved:boolean, worstError:number, perError:number[] }
//   referenceSolve(world) -> { recipe, experiments }   // for validation/teaching (bots only)

export function validateKernel(k) {
  const required = ["id", "generate", "measure", "apply", "satisfiesGoal"];
  for (const m of required) {
    if (k[m] === undefined) throw new Error(`WorldKernel missing "${m}"`);
  }
  return true;
}
