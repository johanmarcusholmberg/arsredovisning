/**
 * Import routes — Phase 3.
 *
 * Handles the full import lifecycle:
 *   1. Upload metadata registration (POST /projects/:projectId/imports/upload)
 *   2. List import history (GET /projects/:projectId/imports)
 *   3. Get batch status + staging preview (GET /projects/:projectId/imports/:batchId)
 *   4. Get staging preview (GET /projects/:projectId/imports/:batchId/staging)
 *   5. Confirm staging → promote to project data (POST .../confirm)
 *   6. Cancel staging (POST .../cancel)
 *   7. CSV/Excel column mapping submission (POST .../column-mapping)
 *
 * SIE files: parsed immediately on upload (server-side, never browser).
 * CSV/Excel: require a column-mapping step first, then parsed on submission.
 *
 * Security:
 *   - All routes require authentication (applied in routes/index.ts).
 *   - Real projects require paid entitlement; demo projects skip that check.
 *   - File type validated server-side; size validated server-side.
 *   - Demo projects: upload is blocked with a clear upgrade prompt.
 *
 * Storage:
 *   TODO (Supabase Storage): Replace stub upload URLs with real signed URLs.
 *   See inline TODO comments for exact replacement points.
 */

import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  db,
  importBatchesTable,
  stagingAccountsTable,
  stagingBalancesTable,
  stagingTransactionsTable,
  accountMappingsTable,
} from "@workspace/db";
import { canEditProject, hasPaidProjectEntitlement } from "../helpers/permissions.js";
import { isDemoProject, resolveUploadBucket, buildStoragePath } from "../helpers/demo.js";
import { logAuditEvent } from "../helpers/auditLog.js";
import { parseSIEContent } from "../helpers/sieParser.js";
import { parseWithColumnMapping } from "../helpers/csvExcelParser.js";
import { autoMapAccounts } from "../helpers/autoMapper.js";
import { logger } from "../lib/logger.js";
import {
  createSignedUploadUrl,
  STORAGE_NOT_CONFIGURED_MESSAGE,
} from "../lib/storageSignedUrls.js";

const router: IRouter = Router();

const ALLOWED_EXTENSIONS: Record<string, "sie" | "csv" | "excel"> = {
  sie: "sie",
  csv: "csv",
  xlsx: "excel",
  xls: "excel",
};
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

function detectFileType(filename: string): "sie" | "csv" | "excel" | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ALLOWED_EXTENSIONS[ext] ?? null;
}

// ---------------------------------------------------------------------------
// POST /api/projects/:projectId/imports/upload
// ---------------------------------------------------------------------------
router.post("/projects/:projectId/imports/upload", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }

  const isDemo = await isDemoProject(projectId);

  if (isDemo) {
    res.status(403).json({
      error: "demo_project",
      message: "Filuppladdning är inte tillgänglig för demoprojekt. Uppgradera till ett betalt projekt för att importera riktiga bokföringsdata.",
    });
    return;
  }

  if (!(await canEditProject(profileId, projectId))) {
    res.status(403).json({ error: "forbidden", message: "Du saknar behörighet att ladda upp filer till detta projekt." });
    return;
  }

  if (!(await hasPaidProjectEntitlement(projectId))) {
    res.status(402).json({
      error: "payment_required",
      message: "En betald licens krävs för att importera bokföringsdata.",
    });
    return;
  }

  // Storage path & bucket are server-derived. Client-supplied values are
  // ignored to prevent cross-project path manipulation via signed URLs.
  const { originalFilename, fileType: explicitFileType, fileSizeBytes } = req.body as {
    originalFilename?: string;
    fileType?: string;
    fileSizeBytes?: number;
  };

  if (!originalFilename) {
    res.status(400).json({ error: "invalid_input", message: "originalFilename krävs." });
    return;
  }

  const detectedType = detectFileType(originalFilename);
  const fileType = (explicitFileType as "sie" | "csv" | "excel" | undefined) ?? detectedType;

  if (!fileType || !["sie", "csv", "excel"].includes(fileType)) {
    res.status(400).json({
      error: "invalid_file_type",
      message: `Filformatet stöds inte. Tillåtna format: .sie, .csv, .xlsx, .xls`,
    });
    return;
  }

  if (fileSizeBytes !== undefined && fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    res.status(400).json({
      error: "file_too_large",
      message: `Filen är för stor. Maximal filstorlek: ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB`,
    });
    return;
  }

  const batchId = randomUUID();
  const bucket = resolveUploadBucket(isDemo, "import-files");
  const finalStoragePath = buildStoragePath(projectId, batchId, originalFilename);

  const [batch] = await db
    .insert(importBatchesTable)
    .values({
      id: batchId,
      projectId,
      uploadedByProfileId: profileId,
      originalFilename,
      fileType,
      fileSizeBytes: fileSizeBytes ?? null,
      storageBucket: bucket,
      storagePath: finalStoragePath,
      status: "pending",
      isDemo: false,
    })
    .returning();

  await logAuditEvent({
    eventType: "import_file_uploaded",
    projectId,
    actorProfileId: profileId,
    eventData: { batchId, originalFilename, fileType, fileSizeBytes },
  });

  const signed = await createSignedUploadUrl(bucket, finalStoragePath);
  if (!signed) {
    res.status(503).json({
      error: "storage_not_configured",
      message: STORAGE_NOT_CONFIGURED_MESSAGE,
    });
    return;
  }

  res.status(201).json({
    ...formatBatch(batch),
    uploadUrl: signed.uploadUrl,
    uploadToken: signed.token,
  });
});

// ---------------------------------------------------------------------------
// GET /api/projects/:projectId/imports
// ---------------------------------------------------------------------------
router.get("/projects/:projectId/imports", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }

  if (!(await canEditProject(profileId, projectId))) {
    res.status(403).json({ error: "forbidden", message: "Åtkomst nekad." });
    return;
  }

  const batches = await db
    .select()
    .from(importBatchesTable)
    .where(eq(importBatchesTable.projectId, projectId))
    .orderBy(desc(importBatchesTable.createdAt));

  res.json(batches.map(formatBatch));
});

// ---------------------------------------------------------------------------
// GET /api/projects/:projectId/imports/:batchId
// ---------------------------------------------------------------------------
router.get("/projects/:projectId/imports/:batchId", async (req, res): Promise<void> => {
  const { projectId, batchId } = req.params;
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }

  if (!(await canEditProject(profileId, projectId))) {
    res.status(403).json({ error: "forbidden", message: "Åtkomst nekad." });
    return;
  }

  const [batch] = await db
    .select()
    .from(importBatchesTable)
    .where(and(eq(importBatchesTable.id, batchId), eq(importBatchesTable.projectId, projectId)))
    .limit(1);

  if (!batch) {
    res.status(404).json({ error: "not_found", message: "Import-batch hittades inte." });
    return;
  }

  res.json({ ...formatBatch(batch), summaryJson: batch.summaryJson, uploadUrl: null });
});

// ---------------------------------------------------------------------------
// GET /api/projects/:projectId/imports/:batchId/staging
// ---------------------------------------------------------------------------
router.get("/projects/:projectId/imports/:batchId/staging", async (req, res): Promise<void> => {
  const { projectId, batchId } = req.params;
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }

  if (!(await canEditProject(profileId, projectId))) {
    res.status(403).json({ error: "forbidden", message: "Åtkomst nekad." });
    return;
  }

  const [batch] = await db
    .select()
    .from(importBatchesTable)
    .where(and(eq(importBatchesTable.id, batchId), eq(importBatchesTable.projectId, projectId)))
    .limit(1);

  if (!batch) {
    res.status(404).json({ error: "not_found", message: "Import-batch hittades inte." });
    return;
  }

  const accounts = await db
    .select()
    .from(stagingAccountsTable)
    .where(eq(stagingAccountsTable.batchId, batchId));

  const missingNameAccounts = accounts.filter((a) => a.hasMissingName).length;

  res.json({
    batchId: batch.id,
    status: batch.status,
    fiscalYearDetected: batch.fiscalYearDetected,
    accountsFound: batch.accountsFound ?? 0,
    balancesFound: batch.balancesFound ?? 0,
    transactionsFound: batch.transactionsFound ?? 0,
    missingNameAccounts,
    parsingErrors: batch.parsingErrors ?? [],
    accounts: accounts.map((a) => ({
      id: a.id,
      accountNumber: a.accountNumber,
      accountName: a.accountName,
      hasMissingName: a.hasMissingName,
      openingBalance: a.openingBalance,
      closingBalance: a.closingBalance,
      currency: a.currency,
    })),
  });
});

// ---------------------------------------------------------------------------
// POST /api/projects/:projectId/imports/:batchId/confirm
// ---------------------------------------------------------------------------
router.post("/projects/:projectId/imports/:batchId/confirm", async (req, res): Promise<void> => {
  const { projectId, batchId } = req.params;
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }

  if (!(await canEditProject(profileId, projectId))) {
    res.status(403).json({ error: "forbidden", message: "Åtkomst nekad." });
    return;
  }

  const [batch] = await db
    .select()
    .from(importBatchesTable)
    .where(and(eq(importBatchesTable.id, batchId), eq(importBatchesTable.projectId, projectId)))
    .limit(1);

  if (!batch) {
    res.status(404).json({ error: "not_found", message: "Import-batch hittades inte." });
    return;
  }

  if (!["parsed", "partial"].includes(batch.status)) {
    res.status(409).json({
      error: "invalid_state",
      message: `Batch kan inte bekräftas med status "${batch.status}". Batchen måste vara i status "parsed" eller "partial".`,
    });
    return;
  }

  const [updated] = await db
    .update(importBatchesTable)
    .set({ status: "confirmed", confirmedAt: new Date(), confirmedByProfileId: profileId, updatedAt: new Date() })
    .where(eq(importBatchesTable.id, batchId))
    .returning();

  await logAuditEvent({
    eventType: "import_confirmed",
    projectId,
    actorProfileId: profileId,
    eventData: { batchId, originalFilename: batch.originalFilename },
  });

  // Trigger auto-mapping on confirmed staging accounts
  try {
    await runAutoMapping(projectId, batchId, profileId);
  } catch (err) {
    logger.error({ err, batchId }, "Auto-mapping failed after confirm — non-fatal");
  }

  res.json(formatBatch(updated));
});

// ---------------------------------------------------------------------------
// POST /api/projects/:projectId/imports/:batchId/cancel
// ---------------------------------------------------------------------------
router.post("/projects/:projectId/imports/:batchId/cancel", async (req, res): Promise<void> => {
  const { projectId, batchId } = req.params;
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }

  if (!(await canEditProject(profileId, projectId))) {
    res.status(403).json({ error: "forbidden", message: "Åtkomst nekad." });
    return;
  }

  const [batch] = await db
    .select()
    .from(importBatchesTable)
    .where(and(eq(importBatchesTable.id, batchId), eq(importBatchesTable.projectId, projectId)))
    .limit(1);

  if (!batch) {
    res.status(404).json({ error: "not_found", message: "Import-batch hittades inte." });
    return;
  }

  const [updated] = await db
    .update(importBatchesTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(importBatchesTable.id, batchId))
    .returning();

  res.json(formatBatch(updated));
});

// ---------------------------------------------------------------------------
// POST /api/projects/:projectId/imports/:batchId/column-mapping
// ---------------------------------------------------------------------------
router.post("/projects/:projectId/imports/:batchId/column-mapping", async (req, res): Promise<void> => {
  const { projectId, batchId } = req.params;
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }

  if (!(await canEditProject(profileId, projectId))) {
    res.status(403).json({ error: "forbidden", message: "Åtkomst nekad." });
    return;
  }

  const [batch] = await db
    .select()
    .from(importBatchesTable)
    .where(and(eq(importBatchesTable.id, batchId), eq(importBatchesTable.projectId, projectId)))
    .limit(1);

  if (!batch) {
    res.status(404).json({ error: "not_found", message: "Import-batch hittades inte." });
    return;
  }

  if (batch.fileType === "sie") {
    res.status(400).json({ error: "invalid_file_type", message: "SIE-filer kräver ingen kolumnmappning." });
    return;
  }

  const { accountNumberColumn, accountNameColumn, openingBalanceColumn, closingBalanceColumn, amountColumn, dateColumn, descriptionColumn, fileContent } = req.body as {
    accountNumberColumn?: string;
    accountNameColumn?: string;
    openingBalanceColumn?: string;
    closingBalanceColumn?: string;
    amountColumn?: string;
    dateColumn?: string;
    descriptionColumn?: string;
    fileContent?: string;
  };

  if (!accountNumberColumn || !fileContent) {
    res.status(400).json({ error: "invalid_input", message: "accountNumberColumn och fileContent krävs." });
    return;
  }

  await db
    .update(importBatchesTable)
    .set({ status: "parsing", updatedAt: new Date() })
    .where(eq(importBatchesTable.id, batchId));

  await logAuditEvent({
    eventType: "import_parse_started",
    projectId,
    actorProfileId: profileId,
    eventData: { batchId, fileType: batch.fileType },
  });

  try {
    const parseResult = parseWithColumnMapping({
      accountNumberColumn,
      accountNameColumn,
      openingBalanceColumn,
      closingBalanceColumn,
      amountColumn,
      dateColumn,
      descriptionColumn,
      fileContent,
    });

    const hasErrors = parseResult.errors.some((e) => e.severity === "error");

    if (parseResult.accounts.length > 0) {
      await db.insert(stagingAccountsTable).values(
        parseResult.accounts.map((a) => ({
          batchId,
          projectId,
          accountNumber: a.accountNumber,
          accountName: a.accountName,
          hasMissingName: !a.accountName,
          openingBalance: a.openingBalance?.toString() ?? null,
          closingBalance: a.closingBalance?.toString() ?? null,
        })),
      );
    }

    if (parseResult.transactions.length > 0) {
      await db.insert(stagingTransactionsTable).values(
        parseResult.transactions.map((t) => ({
          batchId,
          projectId,
          accountNumber: t.accountNumber,
          amount: t.amount.toString(),
          transactionDate: t.transactionDate,
          description: t.description,
        })),
      );
    }

    const newStatus = hasErrors ? "failed" : parseResult.errors.length > 0 ? "partial" : "parsed";

    const [updated] = await db
      .update(importBatchesTable)
      .set({
        status: newStatus,
        accountsFound: parseResult.accounts.length,
        transactionsFound: parseResult.transactions.length,
        balancesFound: 0,
        parsingErrors: parseResult.errors,
        updatedAt: new Date(),
      })
      .where(eq(importBatchesTable.id, batchId))
      .returning();

    await logAuditEvent({
      eventType: hasErrors ? "import_parse_failed" : "import_parse_completed",
      projectId,
      actorProfileId: profileId,
      eventData: {
        batchId,
        accountsFound: parseResult.accounts.length,
        errorsCount: parseResult.errors.length,
        status: newStatus,
      },
    });

    res.json(formatBatch(updated));
  } catch (err) {
    logger.error({ err, batchId }, "CSV/Excel parsing failed");
    await db
      .update(importBatchesTable)
      .set({
        status: "failed",
        parsingErrors: [{ section: "parser", message: `Parsning misslyckades: ${err instanceof Error ? err.message : String(err)}`, severity: "error" }],
        updatedAt: new Date(),
      })
      .where(eq(importBatchesTable.id, batchId));

    await logAuditEvent({
      eventType: "import_parse_failed",
      projectId,
      actorProfileId: profileId,
      eventData: { batchId, error: err instanceof Error ? err.message : String(err) },
    });

    res.status(500).json({ error: "parse_failed", message: "Parsning misslyckades. Se parsingErrors för detaljer." });
  }
});

// ---------------------------------------------------------------------------
// Internal: parse SIE and write staging data
// ---------------------------------------------------------------------------
export async function parseSIEBatch(
  batchId: string,
  projectId: string,
  profileId: string,
  fileContent: string,
): Promise<void> {
  await db
    .update(importBatchesTable)
    .set({ status: "parsing", updatedAt: new Date() })
    .where(eq(importBatchesTable.id, batchId));

  await logAuditEvent({
    eventType: "import_parse_started",
    projectId,
    actorProfileId: profileId,
    eventData: { batchId },
  });

  try {
    const result = parseSIEContent(fileContent);

    if (result.accounts.length > 0) {
      await db.insert(stagingAccountsTable).values(
        result.accounts.map((a) => ({
          batchId,
          projectId,
          accountNumber: a.accountNumber,
          accountName: a.accountName,
          hasMissingName: !a.accountName,
        })),
      );
    }

    if (result.balances.length > 0) {
      await db.insert(stagingBalancesTable).values(
        result.balances.map((b) => ({
          batchId,
          projectId,
          accountNumber: b.accountNumber,
          balanceType: b.balanceType,
          yearOffset: b.yearOffset,
          period: b.period ?? null,
          amount: b.amount.toString(),
        })),
      );
    }

    if (result.transactions.length > 0) {
      const CHUNK = 500;
      for (let i = 0; i < result.transactions.length; i += CHUNK) {
        await db.insert(stagingTransactionsTable).values(
          result.transactions.slice(i, i + CHUNK).map((t) => ({
            batchId,
            projectId,
            verificationNumber: t.verificationNumber,
            transactionDate: t.transactionDate,
            accountNumber: t.accountNumber,
            amount: t.amount.toString(),
            description: t.description,
            period: t.period ?? null,
          })),
        );
      }
    }

    const hasFatalErrors = result.errors.some((e) => e.severity === "error");
    const hasWarnings = result.errors.length > 0;
    const status = hasFatalErrors ? "failed" : hasWarnings || result.unsupportedSections.length > 0 ? "partial" : "parsed";

    const fiscalYearDetected = result.fiscalYearStart && result.fiscalYearEnd
      ? `${result.fiscalYearStart} – ${result.fiscalYearEnd}`
      : null;

    await db
      .update(importBatchesTable)
      .set({
        status,
        fiscalYearDetected,
        accountsFound: result.accounts.length,
        balancesFound: result.balances.length,
        transactionsFound: result.transactions.length,
        parsingErrors: result.errors,
        summaryJson: {
          companyName: result.companyName,
          orgNumber: result.orgNumber,
          sieType: result.sieType,
          unsupportedSections: result.unsupportedSections,
        },
        updatedAt: new Date(),
      })
      .where(eq(importBatchesTable.id, batchId));

    await logAuditEvent({
      eventType: hasFatalErrors ? "import_parse_failed" : "import_parse_completed",
      projectId,
      actorProfileId: profileId,
      eventData: {
        batchId,
        accountsFound: result.accounts.length,
        balancesFound: result.balances.length,
        transactionsFound: result.transactions.length,
        errorsCount: result.errors.length,
        unsupportedSections: result.unsupportedSections,
        status,
      },
    });
  } catch (err) {
    logger.error({ err, batchId }, "SIE parsing threw unexpectedly");
    await db
      .update(importBatchesTable)
      .set({
        status: "failed",
        parsingErrors: [{ section: "parser", message: `Parsning misslyckades: ${err instanceof Error ? err.message : String(err)}`, severity: "error" }],
        updatedAt: new Date(),
      })
      .where(eq(importBatchesTable.id, batchId));

    await logAuditEvent({
      eventType: "import_parse_failed",
      projectId,
      actorProfileId: profileId,
      eventData: { batchId, error: err instanceof Error ? err.message : String(err) },
    });
  }
}

// ---------------------------------------------------------------------------
// Internal: run auto-mapping after batch confirm
// ---------------------------------------------------------------------------
async function runAutoMapping(
  projectId: string,
  batchId: string,
  profileId: string,
): Promise<void> {
  const stagingAccounts = await db
    .select()
    .from(stagingAccountsTable)
    .where(eq(stagingAccountsTable.batchId, batchId));

  if (stagingAccounts.length === 0) return;

  const mappings = await autoMapAccounts(
    stagingAccounts.map((a) => ({ accountNumber: a.accountNumber, accountName: a.accountName })),
  );

  if (mappings.length > 0) {
    await db.insert(accountMappingsTable).values(
      mappings.map((m) => ({
        projectId,
        batchId,
        accountNumber: m.accountNumber,
        accountName: m.accountName,
        reportLine: m.reportLine,
        reportLineLabel: m.reportLineLabel,
        basRange: m.basRange,
        confidence: m.confidence,
        status: m.confidence === "unmapped" ? "unmapped" as const : "auto_mapped" as const,
        noteImpactFlag: m.noteImpactFlag,
        noteImpactMetadata: m.noteImpactMetadata,
        isManualOverride: false,
      })),
    );
  }

  await logAuditEvent({
    eventType: "mapping_auto_applied",
    projectId,
    actorProfileId: profileId,
    eventData: {
      batchId,
      totalAccounts: mappings.length,
      highConfidence: mappings.filter((m) => m.confidence === "high").length,
      mediumConfidence: mappings.filter((m) => m.confidence === "medium").length,
      lowConfidence: mappings.filter((m) => m.confidence === "low").length,
      unmapped: mappings.filter((m) => m.confidence === "unmapped").length,
    },
  });
}

// ---------------------------------------------------------------------------
// Helper: format batch for API response
// ---------------------------------------------------------------------------
function formatBatch(batch: typeof importBatchesTable.$inferSelect) {
  return {
    id: batch.id,
    projectId: batch.projectId,
    originalFilename: batch.originalFilename,
    fileType: batch.fileType,
    fileSizeBytes: batch.fileSizeBytes,
    status: batch.status,
    fiscalYearDetected: batch.fiscalYearDetected,
    accountsFound: batch.accountsFound ?? 0,
    balancesFound: batch.balancesFound ?? 0,
    transactionsFound: batch.transactionsFound ?? 0,
    parsingErrors: batch.parsingErrors ?? [],
    isDemo: batch.isDemo,
    confirmedAt: batch.confirmedAt?.toISOString() ?? null,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
  };
}

export default router;
