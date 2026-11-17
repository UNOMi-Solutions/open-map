// Downloads the Gun Violence Archive mass shootings table and writes the compressed copy
// that ships with the server, used whenever the Data Hub can't be reached.
import dotenv from "dotenv";
dotenv.config();

import fs from "fs/promises";
import path from "path";
import zlib from "zlib";
import {
    GVA_SNAPSHOT_PATH,
    downloadGvaMassShootingsCsv,
    parseGvaCsv,
} from "../lib/gvaMassShootings.js";

const csv = await downloadGvaMassShootingsCsv();
const rows = await parseGvaCsv(csv);
if (!rows.length || !("victims_killed" in rows[0])) {
    throw new Error("Unexpected Data Hub CSV format; snapshot not written");
}

await fs.mkdir(path.dirname(GVA_SNAPSHOT_PATH), { recursive: true });
await fs.writeFile(GVA_SNAPSHOT_PATH, zlib.gzipSync(Buffer.from(csv)));
console.log(`[gva] wrote bundled set (${rows.length} incidents) to ${GVA_SNAPSHOT_PATH}`);
