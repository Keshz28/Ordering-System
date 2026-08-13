import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url =
  process.env.TURSO_DATABASE_URL ??
  process.env.DB_STORAGE_URL ??
  "file:./.data/db.sqlite";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
  verbose: true,
  strict: false,
});
