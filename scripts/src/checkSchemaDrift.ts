import { Client } from "pg";
import * as schema from "@workspace/db/schema";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";

type ExpectedCol = { name: string; sqlType: string; notNull: boolean };

function expectedType(c: ExpectedCol): string {
  let t = c.sqlType.toLowerCase();
  if (t.startsWith("numeric")) return "numeric";
  if (t.startsWith("timestamp")) return "timestamp with time zone";
  if (t.startsWith("varchar") || t === "character varying") return "character varying";
  if (t === "serial") return "integer";
  if (t === "bigserial") return "bigint";
  if (t.endsWith("[]")) return "ARRAY";
  return t;
}

function pgType(c: { data_type: string; udt_name: string }): string {
  if (c.data_type === "USER-DEFINED") return c.udt_name;
  if (c.data_type === "ARRAY") return "ARRAY";
  return c.data_type;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    if (process.env.SKIP_SCHEMA_DRIFT_CHECK === "1") {
      console.warn("[schema-drift] DATABASE_URL not set and SKIP_SCHEMA_DRIFT_CHECK=1; skipping.");
      process.exit(0);
    }
    console.error("[schema-drift] FAIL — DATABASE_URL not set. Refusing to skip silently.");
    console.error("Set DATABASE_URL or, for local opt-out only, SKIP_SCHEMA_DRIFT_CHECK=1.");
    process.exit(1);
  }

  const expected: Record<string, ExpectedCol[]> = {};
  for (const value of Object.values(schema)) {
    if (!value || typeof value !== "object") continue;
    try {
      const cfg = getTableConfig(value as PgTable);
      if (!cfg?.name) continue;
      expected[cfg.name] = cfg.columns.map((c) => ({
        name: c.name,
        sqlType: c.getSQLType(),
        notNull: c.notNull,
      }));
    } catch {
      /* not a table */
    }
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    udt_name: string;
    is_nullable: "YES" | "NO";
  }>(`SELECT c.table_name, c.column_name, c.data_type, c.udt_name, c.is_nullable
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON c.table_schema = t.table_schema AND c.table_name = t.table_name
      WHERE c.table_schema='public'
        AND t.table_type='BASE TABLE'
        AND c.table_name <> '__drizzle_migrations'
      ORDER BY c.table_name, c.ordinal_position`);
  await client.end();

  const live: Record<string, typeof rows> = {};
  for (const r of rows) (live[r.table_name] ||= []).push(r);

  const drift: Array<{ table: string; kind: string; col?: string; detail?: string }> = [];
  const all = new Set([...Object.keys(expected), ...Object.keys(live)]);
  for (const t of all) {
    const exp = expected[t];
    const liv = live[t];
    if (!exp && liv) {
      drift.push({ table: t, kind: "EXTRA_TABLE", detail: "in DB but not in schema" });
      continue;
    }
    if (exp && !liv) {
      drift.push({ table: t, kind: "MISSING_TABLE", detail: `${exp.length} cols defined in schema` });
      continue;
    }
    const expByName = new Map(exp.map((c) => [c.name, c]));
    const livByName = new Map(liv.map((c) => [c.column_name, c]));
    for (const [name, ec] of expByName) {
      const lc = livByName.get(name);
      if (!lc) {
        drift.push({ table: t, kind: "MISSING_COL", col: name, detail: `expected ${ec.sqlType}` });
        continue;
      }
      const et = expectedType(ec);
      const lt = pgType(lc).toLowerCase();
      if (et !== lt) drift.push({ table: t, kind: "TYPE_MISMATCH", col: name, detail: `expected ${et}, live ${lt}` });
      const lNotNull = lc.is_nullable === "NO";
      if (ec.notNull !== lNotNull)
        drift.push({ table: t, kind: "NULLABILITY", col: name, detail: `expected ${ec.notNull ? "NOT NULL" : "NULL"}, live ${lNotNull ? "NOT NULL" : "NULL"}` });
    }
    for (const [name] of livByName)
      if (!expByName.has(name)) drift.push({ table: t, kind: "EXTRA_COL", col: name, detail: "in DB but not in schema" });
  }

  if (drift.length === 0) {
    console.log("[schema-drift] OK — Drizzle schema matches Postgres.");
    process.exit(0);
  }
  console.error(`[schema-drift] FAIL — ${drift.length} drift item(s):`);
  for (const d of drift) console.error(`  ${d.table}.${d.col ?? ""} [${d.kind}] ${d.detail ?? ""}`);
  console.error("\nFix by editing lib/db/src/schema/*.ts then running `pnpm --filter @workspace/db run push --force`.");
  process.exit(1);
}

main().catch((err) => {
  console.error("[schema-drift] crashed:", err);
  process.exit(2);
});
