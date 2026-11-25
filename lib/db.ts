import "server-only";
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Data stays on the server. Supabase's pooler stalls when a connection is reused for a second query, so each
// query opens its own short-lived connection (prepared statements off, as the pooler requires).
const open = () => postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, idle_timeout: 2, connect_timeout: 15, onnotice: () => {} });

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Runs a saved file from queries/. :from and :to are replaced with validated dates.
export async function run<T = Record<string, any>>(name: string, from = "1900-01-01", to = "2999-12-31"): Promise<T[]> {
  if (!DAY.test(from) || !DAY.test(to)) throw new Error("Bad date");
  const text = readFileSync(join(process.cwd(), "queries", `${name}.sql`), "utf8")
    .replaceAll(":from", `'${from}'::date`).replaceAll(":to", `'${to}'::date`);
  const sql = open();
  try {
    return (await sql.unsafe(text)) as unknown as T[];
  } finally {
    await sql.end({ timeout: 2 });
  }
}
