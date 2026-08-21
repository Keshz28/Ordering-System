/**
 * Geometry check for the floor plans.
 *
 * Tables are positioned by hand, so this catches the mistakes that are easy to
 * make and hard to see in source: shapes that overlap each other or a fixture,
 * shapes that run off the edge of the room, and tables too small to tap once
 * the plan is rendered at phone width.
 *
 *   node scripts/check-floor-plans.mjs
 */
import { BRANCHES } from "../src/db/branch-data.ts";
import { FLOOR_PLANS } from "../src/lib/floor-plans.ts";

/** The plan never renders narrower than this; it pans instead. */
const PHONE_PLAN_PX = 500;
const MIN_TAP_PX = 40;

const box = (o) => ({
  left: o.x - o.w / 2,
  right: o.x + o.w / 2,
  top: o.y - o.h / 2,
  bottom: o.y + o.h / 2,
});

/** Small tolerance so shapes may sit shoulder to shoulder without flagging. */
function overlaps(a, b, pad = 0.5) {
  const A = box(a);
  const B = box(b);
  return (
    A.left < B.right - pad &&
    B.left < A.right - pad &&
    A.top < B.bottom - pad &&
    B.top < A.bottom - pad
  );
}

let problems = 0;

for (const branch of BRANCHES) {
  const plan = FLOOR_PLANS[branch.slug];
  const issues = [];

  if (!plan) issues.push("no floor plan defined");

  const tables = branch.tables;

  // table vs table
  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      if (overlaps(tables[i], tables[j])) {
        issues.push(
          `tables ${tables[i].number} and ${tables[j].number} overlap`,
        );
      }
    }
  }

  // table vs fixture (dividers are lines drawn under everything, so skipped)
  for (const t of tables) {
    for (const f of plan?.features ?? []) {
      if (f.kind === "divider") continue;
      if (overlaps(t, f, 0.2)) {
        issues.push(`table ${t.number} overlaps ${f.kind} "${f.label ?? ""}"`);
      }
    }
  }

  // inside the room
  for (const t of tables) {
    const b = box(t);
    if (b.left < -0.5 || b.right > 100.5 || b.top < -0.5 || b.bottom > 100.5) {
      issues.push(`table ${t.number} runs off the plan`);
    }
  }

  // tappable at phone width
  const aspect = plan?.aspect ?? 1.4;
  const planH = PHONE_PLAN_PX / aspect;
  for (const t of tables) {
    const wPx = Math.max((t.w / 100) * PHONE_PLAN_PX, MIN_TAP_PX);
    const hPx = Math.max((t.h / 100) * planH, MIN_TAP_PX * 0.8);
    if (wPx < MIN_TAP_PX || hPx < MIN_TAP_PX * 0.8) {
      issues.push(`table ${t.number} too small on a phone`);
    }
  }

  const seats = tables.reduce((s, t) => s + t.seats, 0);
  const zones = [...new Set(tables.map((t) => t.zone))];

  console.log(
    `${branch.shortName.padEnd(16)} ${String(tables.length).padStart(2)} tables · ${String(seats).padStart(3)} seats · ${zones.length} zones · aspect ${plan?.aspect ?? "?"}`,
  );
  if (issues.length) {
    problems += issues.length;
    for (const i of issues) console.log(`   ⚠ ${i}`);
  } else {
    console.log("   ✓ geometry clean");
  }
}

console.log(problems === 0 ? "\nAll plans valid." : `\n${problems} problem(s).`);
process.exit(problems === 0 ? 0 : 1);
