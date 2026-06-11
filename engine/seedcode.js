// Shareable world codes: {seed, difficulty, theme} <-> short base36 string + checksum.
// Difficulty/theme are encoded by INDEX in append-only lists, so codes stay stable.

import { DIFFICULTY_KEYS } from "./difficulty.js";
import { THEME_KEYS } from "../themes/registry.js";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function encodeShareCode({ seed, difficulty, theme }) {
  const di = DIFFICULTY_KEYS.indexOf(difficulty);
  const ti = THEME_KEYS.indexOf(theme);
  if (di < 0) throw new Error(`unknown difficulty "${difficulty}"`);
  if (ti < 0) throw new Error(`unknown theme "${theme}"`);
  const packed = BigInt(seed >>> 0) * 100n + BigInt(di) * 10n + BigInt(ti);
  const body = packed.toString(36);
  const check = ALPHABET[Number(packed % 36n)];
  return `${body}${check}`;
}

export function decodeShareCode(code) {
  const clean = String(code).trim().toLowerCase();
  if (clean.length < 2) throw new Error("share code too short");
  const body = clean.slice(0, -1);
  const check = clean.slice(-1);
  const packed = BigInt(parseInt(body, 36));
  if (Number.isNaN(Number(packed))) throw new Error("bad share code");
  if (ALPHABET[Number(packed % 36n)] !== check) throw new Error("bad share code (checksum)");
  const ti = Number(packed % 10n);
  const di = Number((packed / 10n) % 10n);
  const seed = Number(packed / 100n);
  const difficulty = DIFFICULTY_KEYS[di];
  const theme = THEME_KEYS[ti];
  if (!difficulty || !theme) throw new Error("share code references unknown difficulty/theme");
  return { seed, difficulty, theme };
}
