// SVG research instruments for the web lens. Same snapshot data as the CLI, richer channel.

const PALETTE = ["#5ad", "#e85", "#7c5", "#c7e", "#ec6", "#6ce", "#e69", "#9d6"];

export function scatterSVG(points, { w = 460, h = 340, xlabel, ylabel, goalX = null, goalY = null } = {}) {
  if (points.length === 0)
    return `<div class="empty">Measure two instruments on a few substances to see the scatter.</div>`;
  const pad = 44;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  let xmin = Math.min(...xs, goalX ?? Infinity), xmax = Math.max(...xs, goalX ?? -Infinity);
  let ymin = Math.min(...ys, goalY ?? Infinity), ymax = Math.max(...ys, goalY ?? -Infinity);
  const ex = (xmax - xmin || 1) * 0.1, ey = (ymax - ymin || 1) * 0.1;
  xmin -= ex; xmax += ex; ymin -= ey; ymax += ey;
  const X = (x) => pad + ((x - xmin) / (xmax - xmin)) * (w - pad - 12);
  const Y = (y) => h - pad - ((y - ymin) / (ymax - ymin)) * (h - pad - 16);

  let s = `<svg viewBox="0 0 ${w} ${h}" class="plot">`;
  s += `<line x1="${pad}" y1="${h - pad}" x2="${w - 8}" y2="${h - pad}" class="axis"/>`;
  s += `<line x1="${pad}" y1="12" x2="${pad}" y2="${h - pad}" class="axis"/>`;
  if (goalX != null) s += `<line x1="${X(goalX)}" y1="12" x2="${X(goalX)}" y2="${h - pad}" class="goal"/>`;
  if (goalY != null) s += `<line x1="${pad}" y1="${Y(goalY)}" x2="${w - 8}" y2="${Y(goalY)}" class="goal"/>`;
  for (const p of points) {
    const col = p.cluster != null ? PALETTE[p.cluster % PALETTE.length] : "#8bd";
    s += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="6" fill="${col}" class="pt"><title>${p.label}\n${xlabel}=${p.x.toFixed(3)}\n${ylabel}=${p.y.toFixed(3)}</title></circle>`;
    s += `<text x="${(X(p.x) + 8).toFixed(1)}" y="${(Y(p.y) + 3).toFixed(1)}" class="ptlabel">${p.label}</text>`;
  }
  s += `<text x="${(w / 2).toFixed(0)}" y="${h - 8}" class="axlabel" text-anchor="middle">${xlabel}</text>`;
  s += `<text x="14" y="${(h / 2).toFixed(0)}" class="axlabel" transform="rotate(-90 14 ${(h / 2).toFixed(0)})" text-anchor="middle">${ylabel}</text>`;
  s += `<text x="${pad}" y="${h - pad + 14}" class="tick">${xmin.toFixed(2)}</text>`;
  s += `<text x="${w - 30}" y="${h - pad + 14}" class="tick">${xmax.toFixed(2)}</text>`;
  s += `<text x="6" y="16" class="tick">${ymax.toFixed(2)}</text>`;
  s += `<text x="6" y="${h - pad}" class="tick">${ymin.toFixed(2)}</text>`;
  if (goalX != null || goalY != null) s += `<text x="${w - 8}" y="14" class="tick goal-txt" text-anchor="end">— goal</text>`;
  s += `</svg>`;
  return s;
}

export function heatmapSVG(corr, { cell = 30 } = {}) {
  const n = corr.labels.length;
  const top = 64, left = 78, w = left + n * cell + 12, h = top + n * cell + 12;
  let s = `<svg viewBox="0 0 ${w} ${h}" class="plot">`;
  corr.labels.forEach((l, i) => {
    s += `<text x="${left + i * cell + cell / 2}" y="${top - 6}" class="tick" text-anchor="start" transform="rotate(-45 ${left + i * cell + cell / 2} ${top - 6})">${l.slice(0, 9)}</text>`;
    s += `<text x="${left - 6}" y="${top + i * cell + cell / 2 + 4}" class="tick" text-anchor="end">${l.slice(0, 10)}</text>`;
  });
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const r = corr.matrix[i][j];
      const col = Number.isFinite(r) ? heatColor(r) : "#333";
      s += `<rect x="${left + j * cell}" y="${top + i * cell}" width="${cell - 1}" height="${cell - 1}" fill="${col}"><title>${corr.labels[i]} vs ${corr.labels[j]}: r=${Number.isFinite(r) ? r.toFixed(2) : "?"}</title></rect>`;
      if (Number.isFinite(r) && Math.abs(r) > 0.9 && i !== j)
        s += `<text x="${left + j * cell + cell / 2}" y="${top + i * cell + cell / 2 + 3}" class="hot" text-anchor="middle">!</text>`;
    }
  s += `</svg>`;
  return s;
}

function heatColor(r) {
  // -1 → blue, 0 → dark, +1 → red
  const t = (r + 1) / 2;
  const red = Math.round(40 + t * 200), blue = Math.round(40 + (1 - t) * 200);
  return `rgb(${red},50,${blue})`;
}

// points: real measured [{lambda,value}]; interp: fn(t)->value (shape-agnostic polyline).
export function trendSVG(points, { w = 460, h = 240, goal = null, interp = null, ylabel = "value", endpoints = [] } = {}) {
  if (points.length === 0) return `<div class="empty">Pick two substances, then blend them at a few λ and measure — the response shape is hidden, so sample it.</div>`;
  const pad = 40;
  const curveYs = interp && points.length >= 2 ? Array.from({ length: 60 }, (_, i) => interp(i / 59)) : [];
  const ys = points.map((s) => s.value).concat(curveYs, goal != null ? [goal] : []);
  let ymin = Math.min(...ys), ymax = Math.max(...ys);
  const e = (ymax - ymin || 1) * 0.12; ymin -= e; ymax += e;
  const X = (l) => pad + l * (w - pad - 12);
  const Y = (v) => h - pad - ((v - ymin) / (ymax - ymin)) * (h - pad - 16);
  let s = `<svg viewBox="0 0 ${w} ${h}" class="plot">`;
  s += `<line x1="${pad}" y1="${h - pad}" x2="${w - 8}" y2="${h - pad}" class="axis"/>`;
  if (goal != null) s += `<line x1="${pad}" y1="${Y(goal)}" x2="${w - 8}" y2="${Y(goal)}" class="goal"/>`;
  if (curveYs.length) {
    const path = curveYs.map((v, i) => `${i ? "L" : "M"}${X(i / 59).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
    s += `<path d="${path}" fill="none" stroke="#8bd" stroke-width="2"/>`;
  }
  for (const p of points) s += `<circle cx="${X(p.lambda).toFixed(1)}" cy="${Y(p.value).toFixed(1)}" r="5" fill="#e85"><title>λ=${p.lambda.toFixed(2)} → ${p.value.toFixed(3)}</title></circle>`;
  s += `<text x="${pad}" y="${h - 8}" class="tick">λ=0 (${endpoints[0] ?? "a"})</text>`;
  s += `<text x="${w - 8}" y="${h - 8}" class="tick" text-anchor="end">λ=1 (${endpoints[1] ?? "b"})</text>`;
  s += `<text x="6" y="14" class="tick">${ylabel}${goal != null ? " · — goal" : ""}</text>`;
  s += `</svg>`;
  return s;
}
