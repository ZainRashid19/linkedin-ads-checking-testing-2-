// Create the tables in sql/schema.sql. Usage: node scripts/apply-schema.mjs
import { readFileSync } from "node:fs";
import postgres from "postgres";
process.loadEnvFile(".env.local");
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try { await sql.unsafe(readFileSync("sql/schema.sql", "utf8")); console.log("schema ok"); }
catch (e) { console.error("Schema failed:", e.message); process.exitCode = 1; }
finally { await sql.end(); }
