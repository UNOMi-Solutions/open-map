import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { feature, mesh } from "topojson-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const src = path.join(__dirname, "../client/public/geo/states-10m.json");
const outDir = path.join(__dirname, "../client/public/geo");

const topo = JSON.parse(fs.readFileSync(src, "utf-8"));

const nation = feature(topo, topo.objects.nation);
const statesFC = feature(topo, topo.objects.states);
const stateBorders = mesh(topo, topo.objects.states, (a, b) => a !== b);

fs.writeFileSync(path.join(outDir, "us-nation.geojson"), JSON.stringify(nation));
fs.writeFileSync(path.join(outDir, "us-states.geojson"), JSON.stringify(statesFC));
fs.writeFileSync(path.join(outDir, "us-states-borders.geojson"), JSON.stringify(stateBorders));

console.log("Wrote geo/us-nation.geojson, geo/us-states.geojson, geo/us-states-borders.geojson");