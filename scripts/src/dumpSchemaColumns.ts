import * as schema from "@workspace/db/schema";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";

const out: Record<string, Array<{ name: string; sqlType: string; notNull: boolean; hasDefault: boolean; default: unknown; primary: boolean; isUnique: boolean }>> = {};

for (const [exportName, value] of Object.entries(schema)) {
  if (!value || typeof value !== "object") continue;
  // Heuristic: PgTable instance
  try {
    const cfg = getTableConfig(value as PgTable);
    if (!cfg || !cfg.name) continue;
    out[cfg.name] = cfg.columns.map((c) => ({
      name: c.name,
      sqlType: c.getSQLType(),
      notNull: c.notNull,
      hasDefault: c.hasDefault,
      default: c.default,
      primary: c.primary,
      isUnique: !!c.isUnique,
    }));
  } catch {
    // not a table
  }
}

console.log(JSON.stringify(out, null, 2));
