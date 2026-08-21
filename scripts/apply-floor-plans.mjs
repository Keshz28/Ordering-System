/**
 * Rewrites the four table arrangements in src/db/branch-data.ts.
 *
 * Uses index-based splicing rather than a regex: the arrays are found by their
 * declaration line and cut at the first line that is exactly "];", which is
 * unambiguous here and avoids escaping a multiline pattern.
 *
 *   node scripts/apply-floor-plans.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/db/branch-data.ts";

const ARRANGEMENTS = {
  bangsarTables: `
  // Stools at the pass, facing the wood-fired oven
  { number: 1, label: "C1", seats: 2, zone: "Chef's Counter", shape: "counter", x: 32, y: 18, w: 11, h: 8 },
  { number: 2, label: "C2", seats: 2, zone: "Chef's Counter", shape: "counter", x: 50, y: 18, w: 11, h: 8 },
  { number: 3, label: "C3", seats: 2, zone: "Chef's Counter", shape: "counter", x: 68, y: 18, w: 11, h: 8 },
  // Two-tops along the street windows
  { number: 4, seats: 2, zone: "Window Row", shape: "round", x: 14, y: 34, w: 13, h: 13 },
  { number: 5, seats: 2, zone: "Window Row", shape: "round", x: 14, y: 48, w: 13, h: 13 },
  { number: 6, seats: 2, zone: "Window Row", shape: "round", x: 14, y: 62, w: 13, h: 13 },
  { number: 7, seats: 2, zone: "Window Row", shape: "round", x: 14, y: 76, w: 13, h: 13 },
  // Banquette down the brick wall
  { number: 8, seats: 4, zone: "Banquette", shape: "booth", x: 85, y: 36, w: 15, h: 11 },
  { number: 9, seats: 4, zone: "Banquette", shape: "booth", x: 85, y: 51, w: 15, h: 11 },
  { number: 10, seats: 4, zone: "Banquette", shape: "booth", x: 85, y: 66, w: 15, h: 11 },
  { number: 11, seats: 6, zone: "Banquette", shape: "booth", x: 85, y: 82, w: 15, h: 13 },
  // Centre of the room
  { number: 12, seats: 4, zone: "Main Floor", shape: "square", x: 48, y: 32, w: 15, h: 12 },
  { number: 13, label: "Communal", seats: 10, zone: "Main Floor", shape: "rect", x: 48, y: 53, w: 34, h: 12 },
  { number: 14, seats: 4, zone: "Main Floor", shape: "round", x: 48, y: 75, w: 15, h: 14 },
`,

  setapakTables: `
  // Two-tops just inside the door
  { number: 1, seats: 2, zone: "Entrance", shape: "round", x: 13, y: 26, w: 11, h: 15 },
  { number: 2, seats: 2, zone: "Entrance", shape: "round", x: 13, y: 52, w: 11, h: 15 },
  // Six-seat rounds through the middle — the family default
  { number: 3, seats: 6, zone: "Main Hall", shape: "round", x: 30, y: 28, w: 15, h: 21 },
  { number: 4, seats: 6, zone: "Main Hall", shape: "round", x: 50, y: 28, w: 15, h: 21 },
  { number: 5, seats: 6, zone: "Main Hall", shape: "round", x: 70, y: 28, w: 15, h: 21 },
  { number: 6, seats: 6, zone: "Main Hall", shape: "round", x: 30, y: 54, w: 15, h: 21 },
  { number: 7, seats: 4, zone: "Main Hall", shape: "square", x: 50, y: 54, w: 13, h: 18 },
  { number: 8, seats: 6, zone: "Main Hall", shape: "round", x: 70, y: 54, w: 15, h: 21 },
  // The long family tables
  { number: 9, label: "Family A", seats: 8, zone: "Family Corner", shape: "rect", x: 90, y: 28, w: 13, h: 26 },
  { number: 10, label: "Family B", seats: 8, zone: "Family Corner", shape: "rect", x: 90, y: 56, w: 13, h: 26 },
  // Covered garden terrace across the back
  { number: 11, seats: 4, zone: "Garden Terrace", shape: "square", x: 20, y: 80, w: 12, h: 16 },
  { number: 12, seats: 4, zone: "Garden Terrace", shape: "square", x: 40, y: 80, w: 12, h: 16 },
  { number: 13, seats: 4, zone: "Garden Terrace", shape: "square", x: 60, y: 80, w: 12, h: 16 },
  { number: 14, seats: 4, zone: "Garden Terrace", shape: "square", x: 80, y: 80, w: 12, h: 16 },
`,

  bukitJelutongTables: `
  // Deck tables, scattered under the trees rather than gridded
  { number: 1, seats: 4, zone: "Alfresco Deck", shape: "round", x: 20, y: 20, w: 14, h: 20 },
  { number: 2, seats: 4, zone: "Alfresco Deck", shape: "round", x: 39, y: 18, w: 14, h: 20 },
  { number: 3, seats: 2, zone: "Alfresco Deck", shape: "round", x: 18, y: 44, w: 11, h: 15 },
  { number: 4, seats: 4, zone: "Alfresco Deck", shape: "round", x: 38, y: 44, w: 14, h: 20 },
  { number: 5, seats: 6, zone: "Alfresco Deck", shape: "round", x: 27, y: 68, w: 16, h: 23 },
  { number: 6, seats: 2, zone: "Alfresco Deck", shape: "round", x: 14, y: 88, w: 11, h: 15 },
  { number: 7, seats: 2, zone: "Alfresco Deck", shape: "round", x: 38, y: 88, w: 11, h: 15 },
  // Indoor, air-conditioned
  { number: 8, seats: 4, zone: "Indoor Dining", shape: "square", x: 68, y: 32, w: 13, h: 18 },
  { number: 9, seats: 4, zone: "Indoor Dining", shape: "square", x: 88, y: 32, w: 13, h: 18 },
  { number: 10, seats: 4, zone: "Indoor Dining", shape: "square", x: 68, y: 54, w: 13, h: 18 },
  { number: 11, seats: 4, zone: "Indoor Dining", shape: "square", x: 88, y: 54, w: 13, h: 18 },
  // Curtains off for a private eight
  { number: 12, label: "The Nook", seats: 8, zone: "Private Nook", shape: "booth", x: 78, y: 15, w: 26, h: 12 },
  // Under the pergola
  { number: 13, label: "Pergola", seats: 12, zone: "Alfresco Deck", shape: "rect", x: 72, y: 82, w: 34, h: 12 },
  { number: 14, seats: 2, zone: "Indoor Dining", shape: "counter", x: 60, y: 70, w: 9, h: 12 },
`,

  putrajayaTables: `
  // The lake-view row everyone asks for
  { number: 1, label: "Lake 1", seats: 4, zone: "Lake View", shape: "square", x: 14, y: 22, w: 13, h: 19 },
  { number: 2, label: "Lake 2", seats: 4, zone: "Lake View", shape: "square", x: 32, y: 22, w: 13, h: 19 },
  { number: 3, label: "Lake 3", seats: 2, zone: "Lake View", shape: "round", x: 50, y: 22, w: 10, h: 15 },
  { number: 4, label: "Lake 4", seats: 4, zone: "Lake View", shape: "square", x: 68, y: 22, w: 13, h: 19 },
  { number: 5, label: "Lake 5", seats: 4, zone: "Lake View", shape: "square", x: 86, y: 22, w: 13, h: 19 },
  // Working lunches
  { number: 6, label: "Boardroom A", seats: 10, zone: "Boardroom", shape: "rect", x: 29, y: 44, w: 32, h: 13 },
  { number: 7, label: "Boardroom B", seats: 10, zone: "Boardroom", shape: "rect", x: 72, y: 44, w: 32, h: 13 },
  // Main floor
  { number: 8, seats: 4, zone: "Main Floor", shape: "square", x: 16, y: 70, w: 13, h: 19 },
  { number: 9, seats: 4, zone: "Main Floor", shape: "square", x: 36, y: 70, w: 13, h: 19 },
  { number: 10, seats: 4, zone: "Main Floor", shape: "square", x: 56, y: 70, w: 13, h: 19 },
  { number: 11, seats: 6, zone: "Main Floor", shape: "round", x: 78, y: 70, w: 15, h: 22 },
  // Quiet two-tops at the back
  { number: 12, seats: 2, zone: "Main Floor", shape: "round", x: 26, y: 90, w: 11, h: 15 },
  { number: 13, seats: 2, zone: "Main Floor", shape: "round", x: 50, y: 90, w: 11, h: 15 },
  { number: 14, seats: 2, zone: "Main Floor", shape: "round", x: 74, y: 90, w: 11, h: 15 },
`,
};

let text = readFileSync(FILE, "utf8");

for (const [name, body] of Object.entries(ARRANGEMENTS)) {
  const decl = `const ${name}: SeedTable[] = [`;
  const start = text.indexOf(decl);
  if (start === -1) {
    console.error(`MISSING declaration for ${name}`);
    process.exit(1);
  }
  const bodyStart = start + decl.length;
  const end = text.indexOf("\n];", bodyStart);
  if (end === -1) {
    console.error(`MISSING terminator for ${name}`);
    process.exit(1);
  }
  text = text.slice(0, bodyStart) + body.replace(/\n$/, "") + text.slice(end);
  console.log(`rewrote ${name}`);
}

writeFileSync(FILE, text);
console.log("done");
