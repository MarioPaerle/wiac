// Pure string builders for the terminal UI (no IO here). Snapshot in → strings out.

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : `${s}`);
export const c = {
  bold: wrap("1"), dim: wrap("2"), cyan: wrap("36"), green: wrap("32"),
  yellow: wrap("33"), red: wrap("31"), mag: wrap("35"),
};

const GLYPHS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export function glyphMap(snapshot) {
  const m = new Map();
  snapshot.substances.forEach((s, i) => m.set(s.id, GLYPHS[i] ?? "?"));
  return m;
}

const num = (x, d = 3) => (x == null ? c.dim("·") : Number(x).toFixed(d));

export function banner(snapshot) {
  const t = snapshot.theme;
  return c.bold(`╔═ WIAC · ${t.label} · ${snapshot.difficulty.toUpperCase()} · seed ${snapshot.shareCode} ═╗`);
}

export function briefing(snapshot, baselines) {
  const t = snapshot.theme;
  const L = [];
  L.push(banner(snapshot));
  L.push(c.dim(`  ${t.flavor}`));
  L.push("");
  L.push(c.bold("  GOAL  ") + c.yellow(snapshot.goal.description));
  L.push("");
  L.push(c.bold("  INSTRUMENTS  ") + c.dim("(measure these)"));
  L.push("    " + snapshot.measures.map((m) => `${c.cyan(m.label)}[${m.id}]`).join("   "));
  L.push(c.bold("  PROCEDURES   ") + c.dim("(operations)"));
  L.push("    " + snapshot.ops.map((o) => `${c.mag(o.label)}[${o.id}${o.hasLambda ? " a b λ" : " x"}]`).join("   "));
  L.push("");
  L.push(`  STARTING ${t.substanceWord.toUpperCase()}S: ${snapshot.substances.length}  ·  BUDGET: ${c.green(snapshot.budget.max + " XP")}`);
  L.push(c.dim(`  HIDDEN: compositions, how many "families" exist, which instruments are redundant — discover them.`));
  if (baselines) {
    L.push(c.dim(`  Baselines →  brute-force ≈ ${baselines.bruteCost} XP   ·   smart researcher ≈ ${baselines.smartCost} XP`));
  }
  L.push(c.dim(`  Type 'help' for commands.  Analysis is free; acting costs XP.`));
  L.push(c.bold("╚" + "═".repeat(56) + "╝"));
  return L.join("\n");
}

export function hud(snapshot) {
  const b = snapshot.budget;
  const made = snapshot.substances.filter((s) => s.origin.kind !== "genesis").length;
  const read = snapshot.log.filter((e) => e.kind === "measure" && !e.free).length;
  const delta = snapshot.bestDelta ? `Δgoal ${num(snapshot.bestDelta.worst)}` : "Δgoal ?";
  return c.dim(`[ XP ${b.spent}/${b.max} · made ${made} · read ${read} · strikes ${snapshot.strikes} · ${delta} ]`);
}

export function inventory(snapshot, filterTag = null) {
  const g = glyphMap(snapshot);
  const ms = snapshot.measures;
  const head = "  " + "id".padEnd(5) + "·".padEnd(2) + "name".padEnd(16) + ms.map((m) => m.label.slice(0, 7).padStart(8)).join("");
  const rows = [c.bold(head)];
  for (const s of snapshot.substances) {
    if (filterTag && !s.tags.includes(filterTag)) continue;
    let row = "  " + c.cyan((g.get(s.id) + " ").padEnd(2)) + s.id.padEnd(3) + " " + s.name.slice(0, 15).padEnd(16);
    row += ms.map((m) => num(s.measurements[m.id]).padStart(8)).join("");
    if (s.tags.length) row += "  " + c.dim(s.tags.map((x) => "#" + x).join(" "));
    rows.push(row);
  }
  return rows.join("\n");
}

export function inspectView(snapshot, id) {
  const s = snapshot.substances.find((x) => x.id === id);
  if (!s) return c.red(`no substance ${id}`);
  const L = [c.bold(`${s.id}  ${s.name}`) + (s.tags.length ? "  " + c.dim(s.tags.map((x) => "#" + x).join(" ")) : "")];
  const o = s.origin;
  L.push(c.dim("  origin: " + (o.kind === "genesis" ? "starting sample" : o.kind === "mix" ? `mix(${o.a}, ${o.b}, λ=${o.lambda.toFixed(3)})` : `${o.kind}(${o.from})`)));
  for (const m of snapshot.measures) L.push(`  ${m.label.padEnd(14)} ${num(s.measurements[m.id])}`);
  return L.join("\n");
}

export function goalView(snapshot) {
  const L = [c.bold("GOAL  ") + c.yellow(snapshot.goal.description)];
  for (const cc of snapshot.goal.constraints) L.push(c.dim(`   ${cc.measureLabel} [${cc.measureId}] = ${cc.target}  (±${cc.tol})`));
  if (snapshot.bestDelta) L.push(c.dim(`   current best candidate: ${snapshot.bestDelta.id}, worst Δ = ${num(snapshot.bestDelta.worst)}`));
  return L.join("\n");
}

export function notebookView(snapshot) {
  const L = [c.bold("LAB NOTEBOOK")];
  if (snapshot.notebook.notes.length === 0 && snapshot.notebook.hypotheses.length === 0) L.push(c.dim("  (empty — try `note <text>` or `hypo <text>`)"));
  snapshot.notebook.hypotheses.forEach((h) => L.push(`  ${c.yellow("hypo")} ${h.text}`));
  snapshot.notebook.notes.forEach((n) => L.push(`  ${c.dim("note")} ${n.text}${n.substanceId ? c.dim(" @" + n.substanceId) : ""}`));
  return L.join("\n");
}

export function endScreen(snapshot, baselines, score, ref) {
  const won = snapshot.status === "won";
  const L = [];
  L.push(c.bold((won ? c.green("╔═ SOLVED") : c.red("╔═ OUT OF BUDGET")) + ` · seed ${snapshot.shareCode} ═╗`));
  L.push(`  Experiments used: ${c.bold(snapshot.budget.spent + " XP")}   ·   strikes: ${snapshot.strikes}`);
  if (baselines) {
    L.push(c.dim(`  Brute-force baseline ... ${String(baselines.bruteCost).padStart(5)} XP`));
    L.push(c.dim(`  Smart researcher ....... ${String(baselines.smartCost).padStart(5)} XP`));
    L.push(c.dim(`  Theoretical optimum .... ${String(baselines.thetaMin).padStart(5)} XP`));
  }
  if (won) L.push(c.bold(`  SCORE: ${c.green(score)} / 1000`));
  if (ref && ref.recipe && ref.recipe.baseIds)
    L.push(c.dim(`  A known recipe: convex blend of [${ref.recipe.baseIds.join(", ")}].`));
  L.push(c.dim(`  Share:  ${snapshot.shareCode}  (${snapshot.difficulty})`));
  L.push(c.bold("╚" + "═".repeat(40) + "╝"));
  return L.join("\n");
}

export function helpText() {
  return [
    c.bold("COMMANDS  ") + c.dim("(analysis is free; measure costs 1 XP/instrument, synth costs 2 XP)"),
    "  " + c.cyan("list [#tag]") + "             inventory table (· = unmeasured)",
    "  " + c.cyan("measure <id> [m|all]") + "    read an instrument on a substance",
    "  " + c.cyan("mix <a> <b> [λ]") + "         blend two substances (λ in 0..1, default 0.5)",
    "  " + c.cyan("cook <id> [op]") + "          apply a unary operation (if available)",
    "  " + c.cyan("plot <mX> <mY>") + "          ASCII scatter — find clusters & the goal band",
    "  " + c.cyan("trend <a> <b> <m>") + "       plot measured points along the a→b blend (shape is hidden!)",
    "  " + c.cyan("sweep <a> <b> [m] [k]") + "    auto-sample the a→b blend at k λ's to reveal the curve (costs XP)",
    "  " + c.cyan("hist <m>") + "                histogram of a measure across inventory",
    "  " + c.cyan("corr") + "                    correlation table — spot redundant instruments",
    "  " + c.cyan("cluster [k]") + "             k-means taxonomy over measured substances",
    "  " + c.cyan("dist <a> [b]") + "            similarity in measure-space",
    "  " + c.cyan("name <id> <label>") + "       rename · " + c.cyan("tag <id> <#t>") + " · " + c.cyan("note <text>") + " · " + c.cyan("hypo <text>"),
    "  " + c.cyan("inspect <id>") + " · " + c.cyan("goal") + " · " + c.cyan("notebook") + " · " + c.cyan("status"),
    "  " + c.cyan("submit <id>") + "             propose a solution (wrong = +3 XP penalty)",
    "  " + c.cyan("save [slot]") + " · " + c.cyan("reveal") + " · " + c.cyan("help") + " · " + c.cyan("quit"),
  ].join("\n");
}
