// Downloads the ALPR camera set and writes the compressed copy that ships with the server.
// A fresh server draws this file immediately instead of waiting on OpenStreetMap.
import fs from "fs/promises";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";
import { refreshAlprCache } from "../lib/alprCameras.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = path.join(root, "cache", "alpr", "dataset.json");
const to = path.join(root, "data", "alpr-seed.json.gz");

const count = await refreshAlprCache();
const saved = JSON.parse(await fs.readFile(from, "utf8"));
await fs.mkdir(path.dirname(to), { recursive: true });
await fs.writeFile(to, zlib.gzipSync(Buffer.from(JSON.stringify(saved))));
console.log(`[alpr] wrote bundled set (${count} cameras) to ${to}`);
