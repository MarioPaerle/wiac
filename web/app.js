// WIAC web lens — thin client over the same engine the CLI uses.
import { createWorld, GameSession, decodeShareCode, actions as A, listThemes, DIFFICULTY_KEYS, DIFFICULTIES } from "../engine/index.js";
import { computeBaselines, scoreRun } from "../bots/baselines.js";
import { collectMatrix, standardize, correlationMatrix, kmeans, fitQuad, quadRootsInUnit } from "../shared/analysis.js";
import { scatterSVG, heatmapSVG, trendSVG } from "./plots.js";

const GLYPHS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const $ = (id) => document.getElementById(id);

const state = {
  session: null, world: null, baselines: null,
  selA: null, selB: null, lambda: 0.5,
  tab: "scatter", plotX: "m0", plotY: "m1", trendA: null, trendB: null, trendM: "m0",
};

function glyph(snap, id) { return GLYPHS[snap.substances.findIndex((s) => s.id === id)] ?? "?"; }
const mlabel = (snap, id) => snap.measures.find((m) => m.id === id)?.label ?? id;

function newWorld({ seed, difficulty, theme, code }) {
  state.world = code ? createWorld(decodeShareCode(code)) :
    createWorld({ seed: seed >>> 0, difficulty, theme });
  state.session = new GameSession(state.world);
  try { state.baselines = computeBaselines(state.world); } catch { state.baselines = null; }
  const snap = state.session.snapshot();
  state.selA = state.selB = null;
  state.plotX = snap.measures[0]?.id; state.plotY = snap.measures[1]?.id ?? snap.measures[0]?.id;
  state.trendM = snap.goal.constraints[0]?.measureId ?? snap.measures[0]?.id;
  render();
}

function act(action) {
  const r = state.session.apply(action);
  render();
  const snap = state.session.snapshot();
  if (snap.status !== "playing") showEnd(snap);
  return r;
}

// ---------------- render ----------------
function render() {
  const snap = state.session.snapshot();
  renderHeader(snap); renderGoal(snap); renderHud(snap);
  renderInventory(snap); renderSynth(snap); renderViz(snap); renderNotebook(snap); renderLog(snap);
}

function renderHeader(snap) {
  $("seedcode").textContent = snap.shareCode;
  $("themeName").textContent = `${snap.theme.label} · ${snap.difficulty}`;
}

function renderGoal(snap) {
  $("goal").innerHTML = `<b>GOAL</b> &nbsp; ${snap.goal.description}
    <span class="dim"> &nbsp;·&nbsp; hidden: how many families exist, which instruments are redundant — discover them.</span>`;
}

function renderHud(snap) {
  const b = snap.budget, frac = Math.max(0, b.remaining / b.max);
  const made = snap.substances.filter((s) => s.origin.kind !== "genesis").length;
  const delta = snap.bestDelta ? snap.bestDelta.worst.toFixed(3) : "?";
  $("hud").innerHTML = `
    <span>XP <b>${b.spent}</b>/${b.max}</span>
    <span class="bar"><i style="width:${(frac * 100).toFixed(0)}%"></i></span>
    <span class="dim">made ${made}</span><span class="dim">strikes ${snap.strikes}</span>
    <span class="dim">Δgoal ${delta}</span>
    ${state.baselines ? `<span class="dim">· researcher baseline ≈ ${state.baselines.smartCost} XP, brute ≈ ${state.baselines.bruteCost} XP</span>` : ""}`;
}

function renderInventory(snap) {
  const ms = snap.measures;
  let h = `<table><thead><tr><th></th><th>${snap.theme.substanceWord}</th>` +
    ms.map((m) => `<th title="${m.id}">${m.label.slice(0, 7)}</th>`).join("") + `<th></th></tr></thead><tbody>`;
  for (const s of snap.substances) {
    const cls = s.id === state.selA ? "selA" : s.id === state.selB ? "selB" : "";
    h += `<tr class="sub ${cls}" data-sub="${s.id}"><td class="glyph">${glyph(snap, s.id)}</td><td>${s.name}${s.tags.map((t) => ` <span class="tag">#${t}</span>`).join("")}</td>`;
    h += ms.map((m) => {
      const v = s.measurements[m.id];
      return `<td class="cell ${v != null ? "known" : ""}" data-sub="${s.id}" data-m="${m.id}">${v != null ? v.toFixed(3) : "·"}</td>`;
    }).join("");
    h += `<td><button data-measall="${s.id}" title="measure all">⊕</button></td></tr>`;
  }
  h += `</tbody></table><div class="dim" style="margin-top:8px">Click a cell to measure (−1 XP). Click a row to select for blending.</div>`;
  $("inventory").innerHTML = h;
}

function renderSynth(snap) {
  const opts = (sel) => `<option value="">—</option>` + snap.substances.map((s) => `<option value="${s.id}" ${sel === s.id ? "selected" : ""}>${s.id} ${s.name}</option>`).join("");
  const unary = snap.ops.filter((o) => !o.hasLambda);
  $("synth").innerHTML = `
    <div class="synth">
      <span class="sel">A <select id="selA">${opts(state.selA)}</select></span>
      <span class="sel">B <select id="selB">${opts(state.selB)}</select></span>
      <span class="lam">λ <input type="range" id="lam" min="0" max="1" step="0.01" value="${state.lambda}"><span class="sel" id="lamv">${state.lambda.toFixed(2)}</span></span>
      <button class="primary" id="mixBtn">${snap.ops.find((o) => o.hasLambda)?.label ?? "blend"} (−2)</button>
      ${unary.map((o) => `<button data-cook="${o.id}">${o.label} A (−2)</button>`).join("")}
    </div>
    <div class="controls-row" style="margin-top:10px">
      <span class="sel">submit <select id="subSel">${opts(state.selA)}</select></span>
      <button id="subBtn">Submit candidate</button>
      <span class="spacer"></span>
    </div>`;
}

function renderViz(snap) {
  recomputeClusters(snap);
  const tabBtn = (id, label) => `<button data-tab="${id}" class="${state.tab === id ? "active" : ""}">${label}</button>`;
  let body = "";
  const msel = (cur, idAttr) => `<select data-axis="${idAttr}">` + snap.measures.map((m) => `<option value="${m.id}" ${cur === m.id ? "selected" : ""}>${m.label}</option>`).join("") + `</select>`;

  if (state.tab === "scatter") {
    const g = snap.goal.constraints;
    const points = snap.substances.filter((s) => s.measurements[state.plotX] != null && s.measurements[state.plotY] != null)
      .map((s) => ({ label: glyph(snap, s.id), x: s.measurements[state.plotX], y: s.measurements[state.plotY], cluster: clusterOf(snap, s.id) }));
    body = `<div class="controls-row">X ${msel(state.plotX, "x")} &nbsp; Y ${msel(state.plotY, "y")}</div>` +
      scatterSVG(points, { xlabel: mlabel(snap, state.plotX), ylabel: mlabel(snap, state.plotY),
        goalX: g.find((c) => c.measureId === state.plotX)?.target ?? null,
        goalY: g.find((c) => c.measureId === state.plotY)?.target ?? null });
  } else if (state.tab === "corr") {
    const corr = correlationMatrix(snap);
    body = heatmapSVG(corr);
    const flagged = [];
    for (let i = 0; i < corr.labels.length; i++) for (let j = i + 1; j < corr.labels.length; j++)
      if (Number.isFinite(corr.matrix[i][j]) && Math.abs(corr.matrix[i][j]) > 0.9) flagged.push(`${corr.labels[i]} ↔ ${corr.labels[j]} (r=${corr.matrix[i][j].toFixed(2)})`);
    if (flagged.length) body += `<div class="flag">⚑ near-collinear (one may be redundant): ${flagged.join(", ")}</div>`;
    else body += `<div class="dim" style="margin-top:8px">Measure more substances on all instruments to reveal redundancies.</div>`;
  } else if (state.tab === "trend") {
    const a = state.trendA, b = state.trendB, m = state.trendM;
    const sa = snap.substances.find((s) => s.id === a), sb = snap.substances.find((s) => s.id === b);
    let pts = [], hint = "";
    if (sa && sb) {
      if (sa.measurements[m] != null) pts.push({ lambda: 0, value: sa.measurements[m] });
      if (sb.measurements[m] != null) pts.push({ lambda: 1, value: sb.measurements[m] });
      for (const s of snap.substances) {
        if (s.origin.kind !== "mix" || s.measurements[m] == null) continue;
        if (s.origin.a === a && s.origin.b === b) pts.push({ lambda: s.origin.lambda, value: s.measurements[m] });
        else if (s.origin.a === b && s.origin.b === a) pts.push({ lambda: 1 - s.origin.lambda, value: s.measurements[m] });
      }
    }
    const curve = fitQuad(pts.map((p) => ({ x: p.lambda, y: p.value })));
    const goal = snap.goal.constraints.find((c) => c.measureId === m)?.target ?? null;
    if (a && b && pts.length < 3) hint = `<div class="flag">The response is NON-LINEAR — sample more points: blend ${a},${b} at a few λ and measure to fit the curve.</div>`;
    else if (curve && goal != null) {
      const roots = quadRootsInUnit(curve.A2, curve.A1, curve.A0, goal);
      hint = roots.length
        ? `<div class="flag" style="color:var(--good)">✓ fitted curve crosses the goal at λ≈${roots.map((r) => r.toFixed(2)).join(" and ")}. Set λ and blend ${a},${b}.</div>`
        : `<div class="flag">curve doesn't reach the goal on this path — try another pair.</div>`;
    }
    const subSel = (cur, attr) => `<select data-trend="${attr}"><option value="">—</option>` + snap.substances.map((s) => `<option value="${s.id}" ${cur === s.id ? "selected" : ""}>${s.id}</option>`).join("") + `</select>`;
    body = `<div class="controls-row">a ${subSel(a, "a")} b ${subSel(b, "b")} on ${msel(m, "tm")}</div>` +
      trendSVG(pts, { goal, curve, ylabel: mlabel(snap, m), endpoints: [a, b] }) + hint;
  }
  $("viz").innerHTML = `<div class="tabs">${tabBtn("scatter", "Scatter")}${tabBtn("corr", "Correlation")}${tabBtn("trend", "Trend / bracket")}</div>${body}`;
}

let _clusters = null;
function recomputeClusters(snap) {
  const mids = snap.measures.map((m) => m.id);
  const cm = collectMatrix(snap, mids);
  if (cm.X.length < 2) { _clusters = null; return; }
  const k = Math.min(snap.substances.length, Math.max(2, state.world.params.kCenters));
  const { Z } = standardize(cm.X);
  const { assign } = kmeans(Z, k);
  _clusters = new Map(cm.ids.map((id, i) => [id, assign[i]]));
}
function clusterOf(snap, id) { return _clusters?.get(id) ?? null; }

function renderNotebook(snap) {
  $("notebook").innerHTML = `
    <div class="controls-row"><input id="noteIn" placeholder="record a hypothesis or observation…" style="flex:1"><button id="noteBtn">Add</button></div>
    ${snap.notebook.notes.map((n) => `<div class="note">${escape(n.text)}</div>`).join("") || `<div class="dim">No notes yet. Cluster the scatter, spot the redundant instrument, write your theory.</div>`}`;
}

function renderLog(snap) {
  $("log").innerHTML = snap.log.slice(-12).reverse().map((e) => {
    if (e.kind === "measure") return `<div>measure ${e.subId}.${e.measureId} = ${e.value.toFixed(3)}${e.free ? " (cached)" : ""}</div>`;
    if (e.kind === "mix") return `<div>${e.id} = mix(${e.a}, ${e.b}, λ=${e.lambda.toFixed(2)})</div>`;
    if (e.kind === "submit") return `<div>submit ${e.subId} → ${e.solved ? "SOLVED" : "miss"}</div>`;
    return `<div>${e.kind} ${e.id ?? ""}</div>`;
  }).join("");
}

function escape(s) { return String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])); }

// ---------------- end screen ----------------
function showEnd(snap) {
  const won = snap.status === "won";
  const score = won && state.baselines ? scoreRun(snap.budget.spent, state.baselines) : 0;
  $("overlay").innerHTML = `<div class="card">
    <h2>${won ? "✓ Solved!" : "Out of budget"}</h2>
    ${won ? `<div class="score">${score}<span style="font-size:18px">/1000</span></div>` : ""}
    <div class="stat">Experiments used: ${snap.budget.spent} XP · strikes ${snap.strikes}</div>
    ${state.baselines ? `<div class="stat">brute-force ${state.baselines.bruteCost} · researcher ${state.baselines.smartCost} · optimum ${state.baselines.thetaMin}</div>` : ""}
    <div class="stat" style="margin-top:6px">seed ${snap.shareCode}</div>
    <button class="primary" style="margin-top:16px" onclick="location.reload()">New world</button>
  </div>`;
  $("overlay").classList.add("show");
}

// ---------------- events (delegation) ----------------
document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.dataset.sub && t.classList.contains("cell")) { act(A.measure(t.dataset.sub, t.dataset.m)); return; }
  if (t.dataset.measall) { act(A.measureAll(t.dataset.measall)); return; }
  if (t.closest("tr.sub")) {
    const id = t.closest("tr.sub").dataset.sub;
    if (!state.selA || (state.selA && state.selB)) { state.selA = id; state.selB = null; }
    else if (id !== state.selA) state.selB = id;
    render(); return;
  }
  if (t.id === "mixBtn") { if (state.selA && state.selB) act(A.mix(state.selA, state.selB, state.lambda)); return; }
  if (t.dataset.cook) { if (state.selA) act(A.cook(state.selA, t.dataset.cook)); return; }
  if (t.id === "subBtn") { const v = $("subSel").value; if (v) act(A.submit(v)); return; }
  if (t.dataset.tab) { state.tab = t.dataset.tab; render(); return; }
  if (t.id === "noteBtn") { const v = $("noteIn").value.trim(); if (v) act(A.note(v)); return; }
  if (t.id === "newBtn") { newWorld({ seed: (+$("seedIn").value) || Math.floor(Math.random() * 1e6), difficulty: $("diffSel").value, theme: $("themeSel").value }); return; }
});

document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.id === "lam") { state.lambda = +t.value; $("lamv").textContent = state.lambda.toFixed(2); }
  if (t.id === "selA") { state.selA = t.value || null; render(); }
  if (t.id === "selB") { state.selB = t.value || null; render(); }
  if (t.dataset.axis === "x") { state.plotX = t.value; render(); }
  if (t.dataset.axis === "y") { state.plotY = t.value; render(); }
  if (t.dataset.axis === "tm") { state.trendM = t.value; render(); }
  if (t.dataset.trend === "a") { state.trendA = t.value || null; render(); }
  if (t.dataset.trend === "b") { state.trendB = t.value || null; render(); }
});

// ---------------- boot ----------------
$("diffSel").innerHTML = DIFFICULTY_KEYS.map((d) => `<option value="${d}">${DIFFICULTIES[d].label}</option>`).join("");
$("themeSel").innerHTML = listThemes().map((t) => `<option value="${t.id}">${t.label}</option>`).join("");
newWorld({ seed: Math.floor(Math.random() * 1e6), difficulty: "tutorial", theme: "alchemy" });
