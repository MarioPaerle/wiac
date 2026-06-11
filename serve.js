#!/usr/bin/env node
// Tiny dependency-free static server for the web UI.
// Needed because Chrome/Firefox block ES-module imports over file:// (Safari allows it).
//   node serve.js  →  open http://localhost:5173/web/

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = process.env.PORT || 5173;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/web/index.html";
    if (p.endsWith("/")) p += "index.html";
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ""));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end("forbidden"); return; }
    const data = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(PORT, () => console.log(`WIAC web → http://localhost:${PORT}/web/`));
