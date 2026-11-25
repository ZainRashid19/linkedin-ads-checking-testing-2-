// Run the automatic syncs by hand. Usage: node scripts/sync.mjs [manyreach]
// Reads DATABASE_URL and the API keys from .env.local. Needs Node 22.18+ (runs the TypeScript directly).
import postgres from "postgres";
import { runSync } from "../lib/sync/run.ts";
process.loadEnvFile(".env.local");
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
try { for (const r of await runSync(sql, process.argv[2])) console.log(r.ok ? "ok  " : "FAIL", r.source, "-", r.message); }
finally { await sql.end(); }
