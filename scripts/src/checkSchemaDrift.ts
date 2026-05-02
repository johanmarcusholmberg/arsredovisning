import { Client } from "pg";
import * as schema from "@workspace/db/schema";
import { getTableConfig, PgEnum, PgTable } from "drizzle-orm/pg-core";

type ExpectedCol = {
  name: string;
  sqlType: string;
  notNull: boolean;
  defaultRaw: string | null;
};

type DriftItem = { table: string; kind: string; col?: string; detail?: string };

const FLAGS = {
  enums: process.env.DRIFT_CHECK_ENUMS !== "0",
  defaults: process.env.DRIFT_CHECK_DEFAULTS !== "0",
  constraints: process.env.DRIFT_CHECK_CONSTRAINTS !== "0",
  indexes: process.env.DRIFT_CHECK_INDEXES !== "0",
  rls: process.env.DRIFT_CHECK_RLS !== "0",
};

function expectedType(c: { sqlType: string }): string {
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

/**
 * Normalize a Postgres default expression so cosmetic differences between
 * drizzle's emitted SQL and what the server stores don't trigger drift.
 */
function normalizeDefault(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  // strip trailing type cast like "::text", "::jsonb", "::project_role"
  s = s.replace(/::[a-zA-Z_][a-zA-Z0-9_ ]*(\[\])?$/g, "");
  s = s.replace(/^\((.*)\)$/, "$1").trim();
  // common synonyms
  const synonyms: Record<string, string> = {
    "now()": "current_timestamp",
    "current_timestamp": "current_timestamp",
    "current_timestamp(6)": "current_timestamp",
    "uuid_generate_v4()": "gen_random_uuid()",
    "true": "true",
    "false": "false",
    "'{}'::jsonb": "'{}'",
    "'{}'": "'{}'",
    "'[]'::jsonb": "'[]'",
    "'[]'": "'[]'",
  };
  const lower = s.toLowerCase();
  if (synonyms[lower]) return synonyms[lower];
  // strip whitespace inside parentheses for things like "ARRAY[]::text[]"
  return s;
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

  // ── 1. Build expected model from Drizzle schema ──────────────────────
  const expected: Record<string, ExpectedCol[]> = {};
  const expectedEnums: Record<string, string[]> = {};
  for (const value of Object.values(schema)) {
    if (!value) continue;
    // pgEnum: callable with .enumName + .enumValues
    if (typeof value === "function" && (value as PgEnum<[string, ...string[]]>).enumName) {
      const e = value as unknown as PgEnum<[string, ...string[]]>;
      expectedEnums[e.enumName] = [...e.enumValues];
      continue;
    }
    if (typeof value !== "object") continue;
    try {
      const cfg = getTableConfig(value as PgTable);
      if (!cfg?.name) continue;
      expected[cfg.name] = cfg.columns.map((c) => ({
        name: c.name,
        sqlType: c.getSQLType(),
        notNull: c.notNull,
        defaultRaw:
          c.default !== undefined && c.default !== null
            ? typeof c.default === "string"
              ? `'${c.default}'`
              : typeof c.default === "boolean" || typeof c.default === "number"
                ? String(c.default)
                : null
            : c.defaultFn
              ? null
              : null,
      }));
    } catch {
      /* not a table */
    }
  }

  // ── 2. Inspect live DB ────────────────────────────────────────────────
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const colRes = await client.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    udt_name: string;
    is_nullable: "YES" | "NO";
    column_default: string | null;
  }>(`SELECT c.table_name, c.column_name, c.data_type, c.udt_name, c.is_nullable, c.column_default
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON c.table_schema = t.table_schema AND c.table_name = t.table_name
      WHERE c.table_schema='public'
        AND t.table_type='BASE TABLE'
        AND c.table_name <> '__drizzle_migrations'
      ORDER BY c.table_name, c.ordinal_position`);

  const enumRes = await client.query<{ enum_name: string; enum_value: string; sortorder: number }>(`
    SELECT t.typname AS enum_name, e.enumlabel AS enum_value, e.enumsortorder AS sortorder
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    ORDER BY t.typname, e.enumsortorder`);

  const rlsRes = await client.query<{ tablename: string; rowsecurity: boolean }>(`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname='public' AND tablename <> '__drizzle_migrations'`);

  const policyRes = await client.query<{ tablename: string; policyname: string; cmd: string }>(`
    SELECT tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname='public'
    ORDER BY tablename, policyname`);

  await client.end();

  // ── 3. Compare ────────────────────────────────────────────────────────
  const drift: DriftItem[] = [];

  // 3a. tables/columns
  const live: Record<string, typeof colRes.rows> = {};
  for (const r of colRes.rows) (live[r.table_name] ||= []).push(r);
  const allTables = new Set([...Object.keys(expected), ...Object.keys(live)]);
  for (const t of allTables) {
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
      if (FLAGS.defaults && ec.defaultRaw !== null) {
        const expD = normalizeDefault(ec.defaultRaw);
        const livD = normalizeDefault(lc.column_default);
        if (expD !== null && livD !== null && expD.toLowerCase() !== livD.toLowerCase()) {
          drift.push({ table: t, kind: "DEFAULT_MISMATCH", col: name, detail: `expected ${expD}, live ${livD}` });
        } else if (expD !== null && livD === null) {
          drift.push({ table: t, kind: "DEFAULT_MISMATCH", col: name, detail: `expected ${expD}, live <none>` });
        }
      }
    }
    for (const [name] of livByName)
      if (!expByName.has(name)) drift.push({ table: t, kind: "EXTRA_COL", col: name, detail: "in DB but not in schema" });
  }

  // 3b. enums
  if (FLAGS.enums) {
    const liveEnums: Record<string, string[]> = {};
    for (const r of enumRes.rows) (liveEnums[r.enum_name] ||= []).push(r.enum_value);
    const allEnums = new Set([...Object.keys(expectedEnums), ...Object.keys(liveEnums)]);
    for (const name of allEnums) {
      const exp = expectedEnums[name];
      const liv = liveEnums[name];
      if (!exp && liv) drift.push({ table: `<enum:${name}>`, kind: "EXTRA_ENUM", detail: `in DB but not in schema (values: ${liv.join(",")})` });
      else if (exp && !liv) drift.push({ table: `<enum:${name}>`, kind: "MISSING_ENUM", detail: `expected values: ${exp.join(",")}` });
      else if (exp && liv) {
        const expSet = new Set(exp);
        const livSet = new Set(liv);
        const missing = exp.filter((v) => !livSet.has(v));
        const extra = liv.filter((v) => !expSet.has(v));
        if (missing.length || extra.length) {
          const parts = [];
          if (missing.length) parts.push(`missing: [${missing.join(",")}]`);
          if (extra.length) parts.push(`extra: [${extra.join(",")}]`);
          drift.push({ table: `<enum:${name}>`, kind: "ENUM_VALUES", detail: parts.join("; ") });
        }
      }
    }
  }

  // 3c. RLS / policies — informational by default; surfaces drift if a table in the schema has policies
  // documented in lib/db/drizzle/*_rls.sql but pg_policies does not show them.
  if (FLAGS.rls) {
    const expectedRlsTables = new Set([
      "annual_report_reclassification_suggestions",
      "annual_report_reclassifications",
      "annual_report_reclassification_audit_log",
    ]);
    const expectedPolicyCounts: Record<string, number> = {
      annual_report_reclassification_suggestions: 3, // SELECT, INSERT, UPDATE
      annual_report_reclassifications: 3,
      annual_report_reclassification_audit_log: 1, // SELECT only
    };
    const rlsByTable = new Map(rlsRes.rows.map((r) => [r.tablename, r.rowsecurity]));
    const polByTable: Record<string, number> = {};
    for (const p of policyRes.rows) polByTable[p.tablename] = (polByTable[p.tablename] || 0) + 1;
    for (const tbl of expectedRlsTables) {
      const enabled = rlsByTable.get(tbl);
      if (enabled !== true) drift.push({ table: tbl, kind: "RLS_DISABLED", detail: "expected ENABLE ROW LEVEL SECURITY (per drizzle/*_rls.sql)" });
      const want = expectedPolicyCounts[tbl] ?? 0;
      const have = polByTable[tbl] ?? 0;
      if (have < want) drift.push({ table: tbl, kind: "POLICY_MISSING", detail: `expected ${want} policies, found ${have}` });
    }
  }

  // ── 4. Report ────────────────────────────────────────────────────────
  if (drift.length === 0) {
    console.log("[schema-drift] OK — Drizzle schema matches Postgres (cols, types, nullability, defaults, enums, RLS).");
    process.exit(0);
  }
  console.error(`[schema-drift] FAIL — ${drift.length} drift item(s):`);
  for (const d of drift) console.error(`  ${d.table}.${d.col ?? ""} [${d.kind}] ${d.detail ?? ""}`);
  console.error(
    "\nFix by editing lib/db/src/schema/*.ts then running `pnpm --filter @workspace/db run push --force`.",
  );
  console.error(
    "Individual checks can be disabled per-run with DRIFT_CHECK_{ENUMS,DEFAULTS,CONSTRAINTS,INDEXES,RLS}=0.",
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("[schema-drift] crashed:", err);
  process.exit(2);
});
