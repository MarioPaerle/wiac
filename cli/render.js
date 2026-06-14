// Pure string builders for the terminal UI (no IO here). Snapshot in → strings out.

// Modern-retro "Cobalt" palette (70-20-10): bg #0D1117 · structure #C9D1D9 · accent #58A6FF.
// Truecolor with graceful fallback. Method names kept stable; cyan=accent, mag=muted.
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const rgb = (r, g, b) => (s) => (useColor ? `\x1b[38;2;${r};${g};${b}m${s}\x1b[0m` : `${s}`);
const sgr = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : `${s}`);
export const c = {
  bold: sgr("1"), dim: sgr("2"),
  fg: rgb(214, 218, 224),    // structure / body
  cyan: rgb(232, 179, 65),   // accent (signature, phosphor amber) — interactive elements, key values
  accent: rgb(232, 179, 65),
  mag: rgb(138, 146, 158),   // muted (secondary, per 1-accent rule)
  muted: rgb(138, 146, 158),
  green: rgb(91, 200, 115),  // success (cool, so it doesn't blur into amber)
  yellow: rgb(216, 134, 59), // warn (distinct orange)
  red: rgb(255, 107, 102),   // error
};

// ASCII wordmark (slim, modern-retro). Printed in accent.
export function wordmark() {
  return c.cyan(["╦ ╦╦╔═╗╔═╗", "║║║║╠═╣║  ", "╚╩╝╩╩ ╩╚═╝"].join("\n"));
}

// Big startup logo, Claude-Code style: a braille-art atom over the WIAC block wordmark.
export function bigLogo() {
  const atom = [
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡾⠋⠙⢷⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡿⠁⠀⠀⠈⢿⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⢀⣀⣤⣤⣀⣀⡀⠀⢸⠃⠀⠀⠀⠀⠘⡇⠀⢀⣀⣀⣤⣤⣀⡀⠀⠀⠀",
    "⠀⠀⠀⢸⠉⠀⠀⠉⠉⠛⠻⣿⣤⣀⠀⠀⣀⣤⣿⠟⠛⠉⠉⠁⠈⠉⡇⠀⠀⠀",
    "⠀⠀⠀⠘⣧⡀⠀⠀⠀⠀⠀⣇⣀⣽⠿⠿⣯⣀⣸⠀⠀⠀⠀⠀⢀⣼⠃⠀⠀⠀",
    "⠀⠀⠀⠀⠈⠻⣦⡀⠀⣠⣴⡟⠉⠀⢀⡀⠀⠉⢻⣦⣄⠀⢀⣴⠟⠁⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⢈⣿⣿⣉⠀⡇⠀⢰⣿⣿⠆⠀⢸⠀⣉⣿⣿⡁⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⢀⣴⠟⠁⠀⠙⠻⣧⣀⠀⠉⠉⠀⣀⣼⠟⠋⠀⠈⠻⣦⡀⠀⠀⠀⠀",
    "⠀⠀⠀⢠⡟⠁⠀⠀⠀⠀⠀⡏⠉⣻⣶⣶⣟⠉⢹⠀⠀⠀⠀⠀⠈⢻⡄⠀⠀⠀",
    "⠀⠀⠀⢸⣀⠀⠀⣀⣀⣤⣴⣿⠛⠉⠀⠀⠉⠛⣿⣦⣤⣀⣀⠀⠀⣀⡇⠀⠀⠀",
    "⠀⠀⠀⠈⠉⠛⠛⠉⠉⠁⠀⢸⡄⠀⠀⠀⠀⢠⡇⠀⠈⠉⠉⠛⠛⠉⠁⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣷⡀⠀⠀⢀⣾⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⢷⣄⣠⡾⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  ];
  const wiac = [
    "██╗    ██╗██╗ █████╗  ██████╗",
    "██║    ██║██║██╔══██╗██╔════╝",
    "██║ █╗ ██║██║███████║██║     ",
    "██║███╗██║██║██╔══██║██║     ",
    "╚███╔███╔╝██║██║  ██║╚██████╗",
    " ╚══╝╚══╝ ╚═╝╚═╝  ╚═╝ ╚═════╝",
  ];
  const L = atom.map((l) => "  " + c.cyan(l));
  L.push("");
  wiac.forEach((l) => L.push("   " + c.bold(c.cyan(l))));
  return L.join("\n");
}

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
  L.push("");
  L.push(bigLogo());
  L.push("");
  L.push("  " + c.muted(`World In A Context · ${t.label} · ${snapshot.difficulty} · seed ${c.cyan(snapshot.shareCode)}`));
  L.push("");
  L.push(c.dim(`  ${t.flavor}`));
  L.push("");
  L.push(c.bold("  GOAL  ") + c.yellow(snapshot.goal.description));
  L.push("");
  L.push(c.bold("  INSTRUMENTS  ") + c.dim("(measure these — measuring is cheap)"));
  L.push("    " + snapshot.measures.map((m) => `${m.hidden ? c.yellow(m.label + "🔒") : c.cyan(m.label)}[${m.id}]`).join("   "));
  if (snapshot.measures.some((m) => m.hidden)) L.push(c.dim("    🔒 = readable on EVERY original (cost 1) but NOT your syntheses → gather data, then INFER (calc: design/lstsq/loocv)."));
  L.push(c.bold("  PROCEDURES   ") + c.dim("(operations)"));
  L.push("    " + snapshot.ops.map((o) => `${c.mag(o.label)}[${o.id}${o.hasLambda ? " a b λ" : " x"}]`).join("   "));
  L.push("");
  L.push(`  STARTING ${t.substanceWord.toUpperCase()}S: ${snapshot.substances.length}  ·  BUDGET: ${c.green(snapshot.budget.max + " XP")}`);
  L.push(c.dim(`  HIDDEN: compositions, how many "families" exist, which instruments are redundant — discover them.`));
  if (baselines) {
    L.push(c.dim(`  Baselines →  brute-force ≈ ${baselines.bruteCost} XP   ·   algorithmic solver ≈ ${baselines.smartCost} XP`));
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
  const head = "  " + "id".padEnd(5) + "·".padEnd(2) + "name".padEnd(16) + ms.map((m) => (m.hidden ? "🔒" + m.label.slice(0, 5) : m.label.slice(0, 7)).padStart(8)).join("");
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
    L.push(c.dim(`  Algorithmic solver .... ${String(baselines.smartCost).padStart(5)} XP`));
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
  const cmd = (name, what) => "  " + c.cyan(name.padEnd(22)) + c.muted(what);
  return [
    c.bold("HOW TO PLAY  ") + c.muted("measure cheaply → find the structure → synthesize toward the goal → submit."),
    c.muted("  Measuring costs 1 XP. Synthesis (mix/cook) costs 3 XP. Analysis is free. Beat the solver baseline."),
    "",
    c.bold("ACT") + c.muted("  (costs XP)"),
    cmd("measure <id> [m|all]", "read one/all instruments on a substance (1 XP each new read)"),
    cmd("mix <a> <b> [λ]", "blend two substances at ratio λ∈0..1 → a NEW substance (3 XP). Then measure it."),
    cmd("cook <id> [op]", "apply a unary operation, if available (3 XP)"),
    cmd("submit <id>", "propose a solution (wrong submit = +4 XP)"),
    "",
    c.bold("LOOK") + c.muted("  (free — this is where you do the science)"),
    cmd("plot <mX> <mY>", "scatter of 2 instruments → SEE clusters of similar substances + the goal band"),
    cmd("trend <a> <b> <m>", "instrument m along the a→b blend → SEE the (non-linear!) response curve"),
    cmd("sweep <a> <b> [m] [k]", "auto-sample that blend at k points to reveal the curve fast (costs XP)"),
    cmd("corr", "correlation table → SEE which instruments are redundant / related"),
    cmd("cluster [k]", "k-means → SEE the hidden families of substances"),
    cmd("hist <m>", "histogram of an instrument → SEE its distribution / modes"),
    cmd("dist <a> [b]", "similarity ranking in measure-space"),
    cmd("calc <expr>", "numpy console: col(name), np.polyfit/lstsq, loocv(), design() — model & infer"),
    "",
    c.bold("NOTE & NAVIGATE") + c.muted("  (free)"),
    cmd("name <id> <label>", "rename a substance · " + c.cyan("tag <id> <#t>") + " · " + c.cyan("note <text>")),
    cmd("history", "the full lab log of everything you've done"),
    cmd("inspect <id>", "all you know about a substance · " + c.cyan("goal") + " · " + c.cyan("status") + " · " + c.cyan("list [#tag]")),
    cmd("save [slot]", c.cyan("reveal") + " (give up) · " + c.cyan("help") + " · " + c.cyan("quit")),
  ].join("\n");
}

// Full experiment history — readable lab log.
export function historyView(snapshot) {
  const L = [c.bold("LAB LOG  ") + c.muted(`(${snapshot.log.length} events)`)];
  const ml = (id) => snapshot.measures.find((m) => m.id === id)?.label ?? id;
  snapshot.log.forEach((e, i) => {
    const n = c.muted(String(i + 1).padStart(3) + " ");
    if (e.kind === "measure") L.push(n + c.fg(`measure ${e.subId} · ${ml(e.measureId)} = ${num(e.value)}`) + (e.free ? c.dim(" (cached)") : ""));
    else if (e.kind === "mix") L.push(n + c.cyan(`${e.id}`) + c.fg(` = mix(${e.a}, ${e.b}, λ=${e.lambda.toFixed(3)})`));
    else if (e.kind === "submit") L.push(n + (e.solved ? c.green("✓ SOLVED with " + e.subId) : c.red("✗ submit " + e.subId + " missed")));
    else L.push(n + c.fg(`${e.kind} ${e.id ?? e.from ?? ""}`));
  });
  if (snapshot.log.length === 0) L.push(c.dim("  (nothing yet)"));
  return L.join("\n");
}
