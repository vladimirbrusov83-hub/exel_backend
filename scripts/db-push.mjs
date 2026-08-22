// Applies db/schema.sql to DATABASE_URL. Idempotent — safe to re-run.
//   npm run db:push
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Put it in .env.local and try again.");
  process.exit(1);
}

const sql = neon(url);
const file = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

// The HTTP driver sends one statement per request, so the file is split rather
// than sent whole. Comments go first so a "--" line can't hide a semicolon.
const statements = file
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  try {
    await sql.query(statement);
  } catch (err) {
    console.error(`\nFailed on:\n${statement}\n`);
    throw err;
  }
}

const [{ count }] = await sql`SELECT count(*)::int AS count FROM clients`;
console.log(`schema applied — ${statements.length} statements, ${count} clients`);
