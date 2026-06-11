// Theme registry. THEME_KEYS is append-only (index baked into share codes).

import alchemy from "./alchemy.js";
import biolab from "./biolab.js";
import physics from "./physics.js";

const THEMES = { alchemy, biolab, physics };
export const THEME_KEYS = ["alchemy", "biolab", "physics"];

export function getTheme(id) {
  const t = THEMES[id];
  if (!t) throw new Error(`unknown theme "${id}" (have: ${THEME_KEYS.join(", ")})`);
  return t;
}

export function listThemes() {
  return THEME_KEYS.map((k) => ({ id: k, label: THEMES[k].label }));
}
