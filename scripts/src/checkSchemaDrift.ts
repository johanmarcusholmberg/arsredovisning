import { Client } from "pg";
import * as schema from "@workspace/db/schema";
import { getTableConfig, PgEnum, PgTable } from "drizzle-orm/pg-core";

type ExpectedCol = {
  name: string;
  sqlType: string;
  notNull: boolean;
  /** Literal/SQL default we can compare against pg's column_default. NULL when
   * the column has no default OR when drizzle uses a runtime defaultFn. */
  defaultRaw: string | null;
  /** True when drizzle declares any default (literal, sql, or defaultFn) so we
   * can at least assert the live column has *some* default even when we can't
   * compare values exactly. */
  hasAnyDefault: boolean;
};

type ExpectedFk = {
  cols: string[];
  refTable: string;
  refCols: string[];
};

type ExpectedIndex = {
  name: string | undefined;
  cols: string[];
  unique: boolean;
};

type ExpectedCheck = { name: string };

type ExpectedTable = {
  cols: ExpectedCol[];
  /** Each entry is a sorted list of column names forming a PK (one entry per PK; usually 1). */
  primaryKeys: string[][];
  /** Each entry is a sorted list of column names with a unique constraint or unique index. */
  uniques: string[][];
  foreignKeys: ExpectedFk[];
  /** Non-unique indexes only (uniques are tracked above). */
  indexes: ExpectedIndex[];
  checks: ExpectedCheck[];
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

/** Sort + join column names into a stable key for set-style comparisons (PK/unique). */
function colKey(cols: string[]): string {
  return [...cols].sort().join(",");
}

/** Order-preserving join — for indexes and FKs where column order is semantic. */
function orderedKey(cols: string[]): string {
  return cols.join(",");
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
  const expected: Record<string, ExpectedTable> = {};
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

      const cols: ExpectedCol[] = cfg.columns.map((c) => {
        const hasLiteral = c.default !== undefined && c.default !== null;
        const hasFn = !!c.defaultFn || !!(c as unknown as { hasDefault?: boolean }).hasDefault;
        let defaultRaw: string | null = null;
        if (hasLiteral) {
          if (typeof c.default === "string") defaultRaw = `'${c.default}'`;
          else if (typeof c.default === "boolean" || typeof c.default === "number") defaultRaw = String(c.default);
          else if (c.default && typeof c.default === "object" && "queryChunks" in (c.default as object)) {
            // sql`...` template — best-effort: the underlying string lives on a
            // private field; we leave defaultRaw=null but still set hasAnyDefault.
          }
        }
        return {
          name: c.name,
          sqlType: c.getSQLType(),
          notNull: c.notNull,
          defaultRaw,
          hasAnyDefault: hasLiteral || hasFn,
        };
      });

      // Primary keys: composite via cfg.primaryKeys + inline single-col via column.primary
      const primaryKeys: string[][] = [];
      for (const pk of cfg.primaryKeys) primaryKeys.push(pk.columns.map((c) => c.name));
      const inlinePk = cfg.columns.filter((c) => c.primary).map((c) => c.name);
      if (inlinePk.length > 0) primaryKeys.push(inlinePk);

      // Uniques: cfg.uniqueConstraints + column.isUnique + uniqueIndex(...) entries
      const uniques: string[][] = [];
      for (const uq of cfg.uniqueConstraints) uniques.push(uq.columns.map((c) => c.name));
      for (const c of cfg.columns) if (c.isUnique) uniques.push([c.name]);
      for (const idx of cfg.indexes) {
        if (!idx.config.unique) continue;
        const cols: string[] = [];
        for (const ic of idx.config.columns) {
          const n = (ic as { name?: string } | undefined)?.name;
          if (typeof n === "string") cols.push(n);
          else cols.push("<expr>");
        }
        uniques.push(cols);
      }

      // Foreign keys: cfg.foreignKeys (covers both inline .references() and foreignKey())
      const foreignKeys: ExpectedFk[] = [];
      for (const fk of cfg.foreignKeys) {
        const ref = fk.reference();
        const refTableName = (() => {
          try {
            return getTableConfig(ref.foreignTable).name;
          } catch {
            return "<unknown>";
          }
        })();
        foreignKeys.push({
          cols: ref.columns.map((c) => c.name),
          refTable: refTableName,
          refCols: ref.foreignColumns.map((c) => c.name),
        });
      }

      // Non-unique indexes only (unique ones are folded into `uniques`)
      const indexes: ExpectedIndex[] = [];
      for (const idx of cfg.indexes) {
        if (idx.config.unique) continue;
        const cols: string[] = [];
        for (const ic of idx.config.columns) {
          const n = (ic as { name?: string } | undefined)?.name;
          if (typeof n === "string") cols.push(n);
          else cols.push("<expr>");
        }
        indexes.push({ name: idx.config.name, cols, unique: false });
      }

      // Named check constraints (drizzle's check(name, value))
      const checks: ExpectedCheck[] = cfg.checks.map((ch) => ({ name: ch.name }));

      expected[cfg.name] = { cols, primaryKeys, uniques, foreignKeys, indexes, checks };
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

  // Constraints (PK / UNIQUE / FK / CHECK) with column lists
  const conRes = await client.query<{
    conname: string;
    contype: "p" | "u" | "f" | "c";
    table_name: string;
    columns: string[] | null;
    ref_table: string | null;
    ref_columns: string[] | null;
  }>(`
    SELECT
      c.conname,
      c.contype::text AS contype,
      tn.relname AS table_name,
      CASE WHEN c.contype IN ('p','u','f') THEN (
        SELECT array_agg(a.attname::text ORDER BY u.ord)
        FROM unnest(c.conkey::int[]) WITH ORDINALITY AS u(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
      ) END AS columns,
      CASE WHEN c.contype='f' THEN fn.relname::text END AS ref_table,
      CASE WHEN c.contype='f' THEN (
        SELECT array_agg(fa.attname::text ORDER BY fu.ord)
        FROM unnest(c.confkey::int[]) WITH ORDINALITY AS fu(attnum, ord)
        JOIN pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = fu.attnum
      ) END AS ref_columns
    FROM pg_constraint c
    JOIN pg_class tn ON tn.oid = c.conrelid
    LEFT JOIN pg_class fn ON fn.oid = c.confrelid
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname='public'
      AND c.contype IN ('p','u','f','c')
      AND tn.relname <> '__drizzle_migrations'`);

  // Indexes (covers unique indexes too). We exclude PK indexes to avoid double-reporting.
  const idxRes = await client.query<{
    index_name: string;
    table_name: string;
    is_unique: boolean;
    is_primary: boolean;
    columns: string[];
  }>(`
    SELECT
      i.relname AS index_name,
      t.relname AS table_name,
      ix.indisunique AS is_unique,
      ix.indisprimary AS is_primary,
      (
        SELECT array_agg(
                 (CASE WHEN u.attnum = 0 THEN '<expr>'
                       ELSE (SELECT a.attname::text FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attnum = u.attnum)
                  END)::text
                 ORDER BY u.ord)
        FROM unnest(ix.indkey::int[]) WITH ORDINALITY AS u(attnum, ord)
      ) AS columns
    FROM pg_index ix
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='public'
      AND t.relname <> '__drizzle_migrations'`);

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
      drift.push({ table: t, kind: "MISSING_TABLE", detail: `${exp.cols.length} cols defined in schema` });
      continue;
    }
    const expByName = new Map(exp.cols.map((c) => [c.name, c]));
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
      if (FLAGS.defaults) {
        const livD = normalizeDefault(lc.column_default);
        if (ec.defaultRaw !== null) {
          const expD = normalizeDefault(ec.defaultRaw);
          if (expD !== null && livD !== null && expD.toLowerCase() !== livD.toLowerCase()) {
            drift.push({ table: t, kind: "DEFAULT_MISMATCH", col: name, detail: `expected ${expD}, live ${livD}` });
          } else if (expD !== null && livD === null) {
            drift.push({ table: t, kind: "DEFAULT_MISMATCH", col: name, detail: `expected ${expD}, live <none>` });
          }
        } else if (ec.hasAnyDefault && livD === null) {
          // Drizzle declares a defaultFn / sql`` default but the live column has
          // no default at all. We can't compare values, but missing-vs-present
          // is still drift.
          drift.push({ table: t, kind: "DEFAULT_MISSING", col: name, detail: "drizzle declares a default (defaultFn or sql``); live column has no default" });
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

  // 3c. constraints (PK, UNIQUE, FK, CHECK)
  if (FLAGS.constraints) {
    // Bucket live constraints per table.
    const livePkByTable: Record<string, string[][]> = {};
    const liveUqByTable: Record<string, string[][]> = {};
    const liveFkByTable: Record<string, ExpectedFk[]> = {};
    const liveCkByTable: Record<string, Set<string>> = {};
    for (const r of conRes.rows) {
      if (r.contype === "p" && r.columns) (livePkByTable[r.table_name] ||= []).push(r.columns);
      else if (r.contype === "u" && r.columns) (liveUqByTable[r.table_name] ||= []).push(r.columns);
      else if (r.contype === "f" && r.columns && r.ref_table && r.ref_columns)
        (liveFkByTable[r.table_name] ||= []).push({ cols: r.columns, refTable: r.ref_table, refCols: r.ref_columns });
      else if (r.contype === "c") (liveCkByTable[r.table_name] ||= new Set()).add(r.conname);
    }
    // Fold unique indexes (drizzle's uniqueIndex(...) produces these, not unique constraints)
    // into the live-uniques bucket so we compare them against expected uniques uniformly.
    for (const r of idxRes.rows) {
      if (r.is_primary || !r.is_unique) continue;
      // Skip any unique index whose column tuple is already covered by a UNIQUE constraint
      const existing = liveUqByTable[r.table_name] ?? [];
      const key = colKey(r.columns);
      if (existing.some((c) => colKey(c) === key)) continue;
      (liveUqByTable[r.table_name] ||= []).push(r.columns);
    }

    for (const [t, et] of Object.entries(expected)) {
      // Primary keys
      const livePks = livePkByTable[t] ?? [];
      const expPkKeys = new Set(et.primaryKeys.map(colKey));
      const livePkKeys = new Set(livePks.map(colKey));
      for (const k of expPkKeys) if (!livePkKeys.has(k)) drift.push({ table: t, kind: "PK_MISSING", detail: `expected primary key on (${k})` });
      for (const k of livePkKeys) if (!expPkKeys.has(k)) drift.push({ table: t, kind: "PK_EXTRA", detail: `live primary key on (${k}) not in schema` });

      // Unique constraints / unique indexes (compared as a set of column-tuples)
      const liveUqs = liveUqByTable[t] ?? [];
      const expUqKeys = new Set(et.uniques.map(colKey));
      const liveUqKeys = new Set(liveUqs.map(colKey));
      for (const k of expUqKeys) if (!liveUqKeys.has(k)) drift.push({ table: t, kind: "UNIQUE_MISSING", detail: `expected unique on (${k})` });
      for (const k of liveUqKeys) if (!expUqKeys.has(k)) drift.push({ table: t, kind: "UNIQUE_EXTRA", detail: `live unique on (${k}) not in schema` });

      // Foreign keys — column order is positional/semantic, so compare order-aware.
      const liveFks = liveFkByTable[t] ?? [];
      const fkKey = (f: ExpectedFk) => `${orderedKey(f.cols)} -> ${f.refTable}(${orderedKey(f.refCols)})`;
      const expFkKeys = new Set(et.foreignKeys.map(fkKey));
      const liveFkKeys = new Set(liveFks.map(fkKey));
      for (const k of expFkKeys) if (!liveFkKeys.has(k)) drift.push({ table: t, kind: "FK_MISSING", detail: `expected foreign key ${k}` });
      for (const k of liveFkKeys) if (!expFkKeys.has(k)) drift.push({ table: t, kind: "FK_EXTRA", detail: `live foreign key ${k} not in schema` });

      // Check constraints (compare named drizzle checks against live conname)
      const liveCks = liveCkByTable[t] ?? new Set<string>();
      for (const c of et.checks) if (!liveCks.has(c.name)) drift.push({ table: t, kind: "CHECK_MISSING", detail: `expected check constraint "${c.name}"` });
      // Note: we deliberately do NOT report EXTRA check constraints. Drizzle does
      // not surface anonymous defaults like NOT NULL implicit checks, and pg may
      // synthesize check names we don't track in schema files.
    }
  }

  // 3d. indexes (non-unique) — compared by name + columns
  if (FLAGS.indexes) {
    // Build live non-unique index map per table, keyed by index name.
    const liveIdxByTable: Record<string, Map<string, string[]>> = {};
    for (const r of idxRes.rows) {
      if (r.is_primary || r.is_unique) continue;
      (liveIdxByTable[r.table_name] ||= new Map()).set(r.index_name, r.columns);
    }
    for (const [t, et] of Object.entries(expected)) {
      const live = liveIdxByTable[t] ?? new Map<string, string[]>();
      const expByName = new Map<string, string[]>();
      for (const idx of et.indexes) if (idx.name) expByName.set(idx.name, idx.cols);
      for (const [name, cols] of expByName) {
        const liveCols = live.get(name);
        if (!liveCols) {
          drift.push({ table: t, kind: "INDEX_MISSING", detail: `expected index "${name}" on (${cols.join(",")})` });
          continue;
        }
        // Index column order is semantic (affects which queries can use the
        // index), so compare order-aware rather than as a sorted set.
        if (orderedKey(cols) !== orderedKey(liveCols))
          drift.push({ table: t, kind: "INDEX_COLS_MISMATCH", detail: `index "${name}" expected (${cols.join(",")}), live (${liveCols.join(",")})` });
      }
      for (const [name] of live) {
        if (!expByName.has(name)) drift.push({ table: t, kind: "INDEX_EXTRA", detail: `live index "${name}" not in schema` });
      }
    }
  }

  // 3e. RLS / policies — informational by default; surfaces drift if a table in the schema has policies
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
    console.log("[schema-drift] OK — Drizzle schema matches Postgres (cols, types, nullability, defaults, enums, PK/UNIQUE/FK/CHECK, indexes, RLS).");
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
