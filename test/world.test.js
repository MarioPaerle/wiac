import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, GameSession, decodeShareCode, encodeShareCode, actions as A, DIFFICULTY_KEYS } from "../engine/index.js";
import { smartSolve } from "../bots/smart-solver.js";

function fingerprint(world) {
  const s = new GameSession(world);
  return world.substances.map((sub) => world.measures.map((m) => world.kernel.measure(world, sub.vec, m.id).toFixed(6)).join(",")).join("|");
}

test("generation is deterministic from a seed", () => {
  const a = createWorld({ seed: 42, difficulty: "normal", theme: "alchemy" });
  const b = createWorld({ seed: 42, difficulty: "normal", theme: "alchemy" });
  assert.equal(fingerprint(a), fingerprint(b));
});

test("different seeds give different worlds", () => {
  const a = createWorld({ seed: 1, difficulty: "normal", theme: "alchemy" });
  const b = createWorld({ seed: 2, difficulty: "normal", theme: "alchemy" });
  assert.notEqual(fingerprint(a), fingerprint(b));
});

test("share code round-trips", () => {
  for (const difficulty of DIFFICULTY_KEYS)
    for (const theme of ["alchemy", "biolab", "physics"]) {
      const code = encodeShareCode({ seed: 12345, difficulty, theme });
      assert.deepEqual(decodeShareCode(code), { seed: 12345, difficulty, theme });
    }
  assert.throws(() => decodeShareCode("zzzzzz"), /checksum|unknown|bad/i);
});

test("smart bot solves every tier", () => {
  for (const difficulty of DIFFICULTY_KEYS)
    for (let seed = 1; seed <= 8; seed++) {
      const world = createWorld({ seed, difficulty, theme: "alchemy" });
      const res = smartSolve(world);
      assert.ok(res.solved, `${difficulty} seed ${seed} unsolved by smart bot`);
    }
});

test("a saved run restores to an equivalent session", () => {
  const world = createWorld({ seed: 9, difficulty: "normal", theme: "biolab" });
  const s = new GameSession(world);
  s.apply(A.measureAll("s0"));
  const m = s.apply(A.mix("s0", "s1", 0.3));
  s.apply(A.measure(m.newSubstanceId, "m0"));
  const restored = GameSession.restore(s.serialize());
  // the restored derived substance must measure identically (hidden vec recomputed from provenance)
  const orig = world.kernel.measure(world, s.get(m.newSubstanceId).vec, "m0");
  const got = restored.world.kernel.measure(restored.world, restored.get(m.newSubstanceId).vec, "m0");
  assert.ok(Math.abs(orig - got) < 1e-9);
});
