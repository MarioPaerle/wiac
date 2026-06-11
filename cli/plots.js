// ASCII research instruments. Pure: data → string. Genuinely useful for spotting structure
// (clusters in a scatter, a bracket in a trend, redundancy in a correlation table).

const fmt = (x, w = 6, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "  · ").padStart(w);

// points: [{glyph, x, y}]; goalX / goalY: optional value to mark with a band.
export function scatter(points, { width = 54, height = 15, xlabel = "x", ylabel = "y", goalX = null, goalY = null } = {}) {
  if (points.length === 0) return "  (no data — measure two instruments first)";
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  let xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  if (goalX != null) { xmin = Math.min(xmin, goalX); xmax = Math.max(xmax, goalX); }
  if (goalY != null) { ymin = Math.min(ymin, goalY); ymax = Math.max(ymax, goalY); }
  const padX = (xmax - xmin || 1) * 0.08, padY = (ymax - ymin || 1) * 0.08;
  xmin -= padX; xmax += padX; ymin -= padY; ymax += padY;
  const col = (x) => Math.round(((x - xmin) / (xmax - xmin)) * (width - 1));
  const row = (y) => Math.round((1 - (y - ymin) / (ymax - ymin)) * (height - 1));

  const grid = Array.from({ length: height }, () => new Array(width).fill(" "));
  if (goalX != null) { const c = col(goalX); for (let r = 0; r < height; r++) grid[r][c] = "┊"; }
  if (goalY != null) { const rr = row(goalY); for (let c = 0; c < width; c++) grid[rr][c] = grid[rr][c] === "┊" ? "┼" : "┄"; }
  for (const p of points) {
    const r = row(p.y), c = col(p.x);
    if (r < 0 || r >= height || c < 0 || c >= width) continue;
    grid[r][c] = grid[r][c] === " " || grid[r][c] === "┊" || grid[r][c] === "┄" || grid[r][c] === "┼" ? p.glyph : "*";
  }
  const lines = [];
  lines.push(`  ${ylabel}`);
  for (let r = 0; r < height; r++) {
    const tick = r === 0 ? fmt(ymax) : r === height - 1 ? fmt(ymin) : "      ";
    lines.push(`${tick} │${grid[r].join("")}`);
  }
  lines.push(`       └${"─".repeat(width)}  ${xlabel}`);
  const mid = goalX != null ? `[goal ${goalX.toFixed(2)}]` : fmt((xmin + xmax) / 2).trim();
  lines.push(`        ${fmt(xmin).trim().padEnd(Math.floor(width / 2))}${mid}${fmt(xmax).trim().padStart(Math.floor(width / 2) - 4)}`);
  return lines.join("\n");
}

// points: real measured [{lambda, value}]; interp: optional fn(t)->value (shape-agnostic curve).
export function trend(points, { goalLine = null, interp = null, width = 44, height = 11, ylabel = "value", endpoints = [] } = {}) {
  if (points.length === 0) return "  (no samples yet — mix a, b at a few λ and measure to reveal the curve)";
  const curveYs = interp && points.length >= 2 ? Array.from({ length: width }, (_, c) => interp(c / (width - 1))) : [];
  const ys = points.map((s) => s.value).concat(curveYs, goalLine != null ? [goalLine] : []);
  let ymin = Math.min(...ys), ymax = Math.max(...ys);
  const pad = (ymax - ymin || 1) * 0.1; ymin -= pad; ymax += pad;
  const row = (y) => Math.round((1 - (y - ymin) / (ymax - ymin)) * (height - 1));
  const col = (l) => Math.round(l * (width - 1));
  const grid = Array.from({ length: height }, () => new Array(width).fill(" "));
  if (goalLine != null) { const rr = row(goalLine); if (rr >= 0 && rr < height) for (let c = 0; c < width; c++) grid[rr][c] = "┄"; }
  for (let c = 0; c < curveYs.length; c++) { const r = row(curveYs[c]); if (r >= 0 && r < height) grid[r][c] = grid[r][c] === "┄" ? "┿" : "·"; }
  for (const s of points) { const r = row(s.value), c = col(s.lambda); if (r >= 0 && r < height && c >= 0 && c < width) grid[r][c] = "●"; }
  const lines = [`  ${ylabel}   (── goal,  ·· interpolated,  ● measured)`];
  for (let r = 0; r < height; r++) {
    const tick = r === 0 ? fmt(ymax) : r === height - 1 ? fmt(ymin) : "      ";
    lines.push(`${tick} │${grid[r].join("")}`);
  }
  lines.push(`       └${"─".repeat(width)}  λ`);
  lines.push(`        λ=0 (${endpoints[0] ?? "a"})${" ".repeat(Math.max(1, width - 18))}λ=1 (${endpoints[1] ?? "b"})`);
  return lines.join("\n");
}

export function histogram(values, { bins = 7, label = "value", width = 28 } = {}) {
  if (values.length === 0) return "  (no data)";
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const counts = new Array(bins).fill(0);
  for (const v of values) counts[Math.min(bins - 1, Math.floor(((v - lo) / span) * bins))]++;
  const max = Math.max(...counts);
  const lines = [`  ${label}`];
  for (let i = 0; i < bins; i++) {
    const a = lo + (span * i) / bins, b = lo + (span * (i + 1)) / bins;
    const bar = "█".repeat(Math.round((counts[i] / max) * width));
    lines.push(`  [${fmt(a)} ,${fmt(b)}) ${bar} ${counts[i] || ""}`);
  }
  return lines.join("\n");
}

export function corrTable({ labels, matrix }) {
  const head = "          " + labels.map((l) => l.slice(0, 7).padStart(8)).join("");
  const lines = [head];
  const flagged = [];
  for (let i = 0; i < labels.length; i++) {
    let rowStr = labels[i].slice(0, 9).padEnd(10);
    for (let j = 0; j < labels.length; j++) {
      const r = matrix[i][j];
      rowStr += (Number.isFinite(r) ? r.toFixed(2) : "  · ").padStart(8);
      if (i < j && Number.isFinite(r) && Math.abs(r) > 0.9) flagged.push(`${labels[i]}↔${labels[j]} (r=${r.toFixed(2)})`);
    }
    lines.push(rowStr);
  }
  if (flagged.length) lines.push("  ⚑ near-collinear (one may be redundant): " + flagged.join(", "));
  return lines.join("\n");
}
