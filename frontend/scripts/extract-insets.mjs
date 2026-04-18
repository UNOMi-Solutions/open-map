import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { feature } from "topojson-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const topoPath = resolve(__dirname, "../node_modules/us-atlas/states-10m.json");

const topo = JSON.parse(readFileSync(topoPath, "utf8"));

const states = feature(topo, topo.objects.states).features;

// FIPS: Alaska = 02, Hawaii = 15
const AK = states.find(f => f.id === "02");
const HI = states.find(f => f.id === "15");

const outDir = resolve(__dirname, "../client/public/geo");
mkdirSync(outDir, { recursive: true });

writeFileSync(resolve(outDir, "ak.json"), JSON.stringify(AK));
writeFileSync(resolve(outDir, "hi.json"), JSON.stringify(HI));

console.log("Wrote:", resolve(outDir, "ak.json"), resolve(outDir, "hi.json"));