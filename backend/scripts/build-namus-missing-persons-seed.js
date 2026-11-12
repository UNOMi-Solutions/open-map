// Downloads every open NamUs missing persons case and writes the compressed copy
// that ships with the server, used whenever NamUs can't be reached.
import fs from "fs/promises";
import path from "path";
import zlib from "zlib";
import {
    NAMUS_SNAPSHOT_PATH,
    downloadNamusMissingPersons,
} from "../lib/namusMissingPersons.js";

const rows = await downloadNamusMissingPersons();
if (!rows.length || !("namus2Number" in rows[0])) {
    throw new Error("Unexpected NamUs response format; snapshot not written");
}

await fs.mkdir(path.dirname(NAMUS_SNAPSHOT_PATH), { recursive: true });
await fs.writeFile(NAMUS_SNAPSHOT_PATH, zlib.gzipSync(Buffer.from(JSON.stringify(rows))));
console.log(`[namus] wrote bundled set (${rows.length} cases) to ${NAMUS_SNAPSHOT_PATH}`);
