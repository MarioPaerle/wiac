// CLI persistence: runs as JSON files under ./saves/. Mirrors web/storage.js API.
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "saves");

function ensure() { if (!existsSync(ROOT)) mkdirSync(ROOT, { recursive: true }); }

export function saveRun(slot, runState) {
  ensure();
  writeFileSync(join(ROOT, `run-${slot}.json`), JSON.stringify(runState, null, 2));
}

export function loadRun(slot) {
  const p = join(ROOT, `run-${slot}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

export function listRuns() {
  ensure();
  return readdirSync(ROOT)
    .filter((f) => f.startsWith("run-") && f.endsWith(".json"))
    .map((f) => {
      const r = JSON.parse(readFileSync(join(ROOT, f), "utf8"));
      return { slot: f.slice(4, -5), shareCode: r.shareCode, status: r.status, spent: r.budget?.spent };
    });
}
