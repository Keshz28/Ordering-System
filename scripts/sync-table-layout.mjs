/**
 * Pushes the floor-plan geometry from branch-data.ts into a live database.
 *
 * Updates only the layout columns of existing tables, matched on
 * (branch, table number). Reservations, orders and table status are left
 * alone — this exists so a layout change never costs a re-seed.
 *
 *   node --experimental-strip-types scripts/sync-table-layout.mjs
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node ... (production)
 */
import { createClient } from "@libsql/client";
import { BRANCHES } from "../src/db/branch-data.ts";

const url =
  process.env.TURSO_DATABASE_URL ?? process.env.DB_URL ?? "file:./.data/db.sqlite";
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient(
  url.startsWith("file:") ? { url } : { url, authToken },
);

const where = url.startsWith("file:") ? "local" : new URL(url.replace(/^libsql:/, "https:")).host;
console.log(`syncing layout -> ${where}`);

let updated = 0;
let missing = 0;
let inserted = 0;

for (const branch of BRANCHES) {
  const found = await client.execute({
    sql: "select id from branch where slug = ?",
    args: [branch.slug],
  });
  const branchId = found.rows[0]?.id;
  if (!branchId) {
    console.log(`  ${branch.shortName.padEnd(16)} branch missing — skipped`);
    missing += branch.tables.length;
    continue;
  }

  for (const t of branch.tables) {
    const res = await client.execute({
      sql: `update restaurant_table
               set label = ?, seats = ?, zone = ?, shape = ?,
                   x = ?, y = ?, w = ?, h = ?, bookable = ?
             where branch_id = ? and number = ?`,
      args: [
        t.label ?? null,
        t.seats,
        t.zone,
        t.shape,
        t.x,
        t.y,
        t.w,
        t.h,
        (t.bookable ?? true) ? 1 : 0,
        branchId,
        t.number,
      ],
    });

    if (res.rowsAffected > 0) {
      updated += 1;
    } else {
      // A layout can add tables; create any that don't exist yet.
      await client.execute({
        sql: `insert into restaurant_table
                (branch_id, number, label, seats, zone, shape, x, y, w, h, bookable, status)
              values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'free')`,
        args: [
          branchId,
          t.number,
          t.label ?? null,
          t.seats,
          t.zone,
          t.shape,
          t.x,
          t.y,
          t.w,
          t.h,
          (t.bookable ?? true) ? 1 : 0,
        ],
      });
      inserted += 1;
    }
  }
  console.log(`  ${branch.shortName.padEnd(16)} ${branch.tables.length} tables`);
}

// Anything left behind by an older layout would strand its reservations.
const orphans = await client.execute(
  `select b.short_name, t.number
     from restaurant_table t join branch b on b.id = t.branch_id
    order by b.sort_order, t.number`,
);
const expected = new Set(
  BRANCHES.flatMap((b) => b.tables.map((t) => `${b.shortName}:${t.number}`)),
);
const stray = orphans.rows.filter(
  (r) => !expected.has(`${r.short_name}:${r.number}`),
);

console.log(`\nupdated ${updated}, inserted ${inserted}, skipped ${missing}`);
if (stray.length) {
  console.log(
    `⚠ ${stray.length} table(s) in the database are not in the layout:`,
    stray.map((r) => `${r.short_name} #${r.number}`).join(", "),
  );
} else {
  console.log("no stray tables");
}
