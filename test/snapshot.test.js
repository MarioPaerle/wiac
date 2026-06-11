// THE critical test: the snapshot the UI renders must NEVER contain hidden vectors.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, GameSession, actions as A } from "../engine/index.js";

function walkForVectorLeak(obj, n, path = "$") {
  if (Array.isArray(obj)) {
    if (obj.length === n && obj.every((x) => typeof x === "number")) {
      throw new Error(`possible hidden vector (length ${n}) leaked at ${path}`);
    }
    obj.forEach((v, i) => walkForVectorLeak(v, n, `${path}[${i}]`));
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      assert.notEqual(k, "vec", `snapshot exposes a "vec" key at ${path}`);
      walkForVectorLeak(v, n, `${path}.${k}`);
    }
  }
}

test("snapshot never leaks hidden vectors after rich play", () => {
  const world = createWorld({ seed: 5, difficulty: "hard", theme: "physics" });
  const s = new GameSession(world);
  // play a bunch: measure, mix, cook, submit-miss, annotate
  for (const sub of world.substances.slice(0, 5)) s.apply(A.measureAll(sub.id));
  const m = s.apply(A.mix("s0", "s1", 0.4));
  s.apply(A.cook("s2", world.ops.find((o) => o.kind === "affineLatent").id));
  s.apply(A.measureAll(m.newSubstanceId));
  s.apply(A.name("s0", "MyState"));
  s.apply(A.submit(m.newSubstanceId));

  const snap = s.snapshot();
  walkForVectorLeak(snap, world.meta.n);
  // also the serialized save must be vec-free
  walkForVectorLeak(s.serialize(), world.meta.n);
  assert.ok(!JSON.stringify(snap).includes("\"vec\""));
});
