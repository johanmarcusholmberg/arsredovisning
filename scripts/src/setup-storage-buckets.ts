/**
 * setup-storage-buckets.ts
 *
 * Creates the five required Supabase Storage buckets for Årsredovisningar.
 * Run this script once after Supabase is configured:
 *
 *   pnpm --filter @workspace/scripts run setup-storage-buckets
 *
 * Requirements:
 *   - SUPABASE_URL env var must be set (or VITE_SUPABASE_URL as fallback)
 *   - SUPABASE_SERVICE_ROLE_KEY env var must be set
 *   - @supabase/supabase-js must be accessible in the workspace
 *     (it is installed in artifacts/api-server — run from workspace root)
 *
 * The script is idempotent — running it multiple times is safe.
 * Existing buckets with matching names are left unchanged.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n" +
      "Add them to Replit Secrets before running this script.\n\n" +
      "  SUPABASE_URL=https://your-project.supabase.co\n" +
      "  SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...\n",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Bucket definitions
// ---------------------------------------------------------------------------

interface BucketConfig {
  name: string;
  public: boolean;
  fileSizeLimit: number;
  allowedMimeTypes: string[];
  description: string;
}

const BUCKETS: BucketConfig[] = [
  {
    name: "import-files",
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
    allowedMimeTypes: [
      "application/octet-stream",
      "text/plain",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
    ],
    description: "Raw SIE, Excel, or CSV files uploaded for import",
  },
  {
    name: "previous-annual-reports",
    public: false,
    fileSizeLimit: 20 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf"],
    description: "Previous year PDF annual reports uploaded as reference",
  },
  {
    name: "cover-sheets",
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    description: "Company-specific cover sheet PDF/image uploads",
  },
  {
    name: "exports",
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
    allowedMimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    description: "Generated PDF and Word annual report exports",
  },
  {
    name: "demo-assets",
    public: true,
    fileSizeLimit: 20 * 1024 * 1024,
    allowedMimeTypes: [
      "application/octet-stream",
      "text/plain",
      "application/pdf",
      "image/jpeg",
      "image/png",
    ],
    description: "Static demo files, sample SIE files, placeholder exports (public read)",
  },
];

// ---------------------------------------------------------------------------
// Supabase client factory (dynamic import — avoids compile-time dependency)
// ---------------------------------------------------------------------------

interface StorageBucketApi {
  getBucket(name: string): Promise<{ data: unknown; error: { message: string } | null }>;
  createBucket(
    name: string,
    options: { public: boolean; fileSizeLimit: number; allowedMimeTypes: string[] },
  ): Promise<{ error: { message: string } | null }>;
}

interface SupabaseClientLike {
  storage: StorageBucketApi;
}

async function createSupabaseClient(): Promise<SupabaseClientLike> {
  // Resolve the package from the workspace node_modules
  // @supabase/supabase-js is installed in artifacts/api-server
  let createClient: (url: string, key: string, opts: object) => SupabaseClientLike;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import("@supabase/supabase-js" as string) as any;
    createClient = mod.createClient;
  } catch {
    console.error(
      "ERROR: @supabase/supabase-js could not be loaded.\n" +
        "Ensure it is installed in the workspace:\n" +
        "  pnpm add @supabase/supabase-js --filter @workspace/scripts\n",
    );
    process.exit(1);
  }

  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// Main setup function
// ---------------------------------------------------------------------------

async function setupBuckets(): Promise<void> {
  console.log("Årsredovisningar — Supabase Storage bucket setup\n");
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Buckets to create: ${BUCKETS.map((b) => b.name).join(", ")}\n`);

  const supabase = await createSupabaseClient();

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const bucket of BUCKETS) {
    const { data: existing, error: getError } = await supabase.storage.getBucket(bucket.name);

    if (existing && !getError) {
      console.log(`  ✓ ${bucket.name} — already exists (skipped)`);
      skipped++;
      continue;
    }

    const { error: createError } = await supabase.storage.createBucket(bucket.name, {
      public: bucket.public,
      fileSizeLimit: bucket.fileSizeLimit,
      allowedMimeTypes: bucket.allowedMimeTypes,
    });

    if (createError) {
      console.error(`  ✗ ${bucket.name} — FAILED: ${createError.message}`);
      failed++;
    } else {
      const visibility = bucket.public ? "public" : "private";
      const sizeMB = bucket.fileSizeLimit / 1024 / 1024;
      console.log(
        `  ✓ ${bucket.name} — created [${visibility}, max ${sizeMB}MB] — ${bucket.description}`,
      );
      created++;
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped, ${failed} failed.`);

  if (failed > 0) {
    console.error("\nSome buckets failed to create. Check the errors above and retry.");
    process.exit(1);
  }

  console.log(
    "\nNext steps:\n" +
      "  1. Apply storage RLS policies in the Supabase Dashboard → Storage → Policies\n" +
      "  2. See docs/storage-buckets.md for the full policy SQL\n" +
      "  3. Apply table RLS: paste docs/rls-policies.sql into the Supabase SQL editor\n",
  );
}

setupBuckets().catch((err: unknown) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
