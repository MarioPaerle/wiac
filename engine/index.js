// Public engine API — the ONLY module UIs and bots import.

export { createWorld } from "./world.js";
export { GameSession } from "./session.js";
export { encodeShareCode, decodeShareCode } from "./seedcode.js";
export { DIFFICULTIES, DIFFICULTY_KEYS, COSTS } from "./difficulty.js";
export { linearKernel } from "./kernel/linear-kernel.js";
export { validateKernel } from "./kernel/kernel-interface.js";
export * as actions from "./actions.js";
export { getTheme, listThemes, THEME_KEYS } from "../themes/registry.js";

export const ENGINE_VERSION = "0.1.0";
