/**
 * Mapping routes — Phase 3.
 *
 * Handles account mapping operations:
 *   1. List account mappings (with filter + search) (GET /projects/:projectId/mappings)
 *   2. Save manual mapping override (POST .../mappings/:mappingId/override)
 *   3. List mapping templates (GET /projects/:projectId/mapping-templates)
 *   4. Save mapping template (POST /projects/:projectId/mapping-templates)
 *   5. Apply mapping template (POST .../mapping-templates/:templateId/apply)
 *
 * All mutating actions are audit-logged.
 */

import { Router, type IRouter } from "express";
import { eq, and, or, ilike } from "drizzle-orm";
import {
  db,
  accountMappingsTable,
  mappingOverridesTable,
  mappingTemplatesTable,
  importBatchesTable,
} from "@workspace/db";
import { canEditProject, canViewProject } from "../helpers/permissions.js";
import { logAuditEvent } from "../helpers/auditLog.js";
import {
  getAssistantSuggestionForMapping,
  scanMappingsForAssistance,
} from "../lib/mappingAssistantService.js";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/projects/:projectId/mappings/:mappingId/assistant
// Returns a structured rule-based suggestion for ONE mapping row.
//
// Read-only: gated on canViewProject so any project member (including
// viewers and free/demo users) can SEE the suggestion. Applying the
// suggestion goes through the override endpoint below, which requires
// canEditProject — so demo users cannot mutate state.
// ---------------------------------------------------------------------------
router.get(
  "/projects/:projectId/mappings/:mappingId/assistant",
  async (req, res): Promise<void> => {
    const { projectId, mappingId } = req.params;
    const profileId = req.profile?.id;

    if (!profileId) {
      res.status(401).json({ error: "unauthorized", message: "Authentication required" });
      return;
    }
    if (!(await canViewProject(profileId, projectId))) {
      res.status(403).json({ error: "forbidden", message: "Åtkomst nekad." });
      return;
    }

    const suggestion = await getAssistantSuggestionForMapping(projectId, mappingId);
    if (!suggestion) {
      res.status(404).json({ error: "not_found", message: "Kontomappning hittades inte." });
      return;
    }
    res.json(suggestion);
  },
);

// ---------------------------------------------------------------------------
// GET /api/projects/:projectId/mappings/assistant/scan
// Bulk scan — returns only rows that need attention. Read-only.
// ---------------------------------------------------------------------------
router.get(
  "/projects/:projectId/mappings/assistant/scan",
  async (req, res): Promise<void> => {
    const { projectId } = req.params;
    const profileId = req.profile?.id;

    if (!profileId) {
      res.status(401).json({ error: "unauthorized", message: "Authentication required" });
      return;
    }
    if (!(await canViewProject(profileId, projectId))) {
      res.status(403).json({ error: "forbidden", message: "Åtkomst nekad." });
      return;
    }

    const result = await scanMappingsForAssistance(projectId);
    res.json(result);
  },
);

// ---------------------------------------------------------------------------
// GET /api/projects/:projectId/mappings
// ---------------------------------------------------------------------------
router.get("/projects/:projectId/mappings", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const profileId = req.profile?.id;
  const { filter, search } = req.query as { filter?: string; search?: string };

  if (!profileId) {
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }

  if (!(await canEditProject(profileId, projectId))) {
    res.status(403).json({ error: "forbidden", message: "Åtkomst nekad." });
    return;
  }

  const confirmedBatch = await db
    .select({ id: importBatchesTable.id })
    .from(importBatchesTable)
    .where(and(eq(importBatchesTable.projectId, projectId), eq(importBatchesTable.status, "confirmed")))
    .orderBy(importBatchesTable.confirmedAt)
    .limit(1);

  if (confirmedBatch.length === 0) {
    res.json([]);
    return;
  }

  const batchId = confirmedBatch[0].id;
  const baseCondition = and(
    eq(accountMappingsTable.projectId, projectId),
    eq(accountMappingsTable.batchId, batchId),
  );

  let rows = await db
    .select()
    .from(accountMappingsTable)
    .where(baseCondition)
    .orderBy(accountMappingsTable.accountNumber);

  if (filter === "unmapped") {
    rows = rows.filter((r) => r.confidence === "unmapped" || r.status === "unmapped");
  } else if (filter === "low_confidence") {
    rows = rows.filter((r) => r.confidence === "low");
  } else if (filter === "needs_review") {
    rows = rows.filter((r) => r.status === "needs_review" || r.confidence === "low" || r.confidence === "unmapped");
  }

  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.accountNumber.toLowerCase().includes(q) ||
        (r.accountName ?? "").toLowerCase().includes(q),
    );
  }

  res.json(rows.map(formatMapping));
});

// ---------------------------------------------------------------------------
// POST /api/projects/:projectId/mappings/:mappingId/override
// ---------------------------------------------------------------------------
router.post("/projects/:projectId/mappings/:mappingId/override", async (req, res): Promise<void> => {
  const { projectId, mappingId } = req.params;
  const profileId = req.profile?.id;

  if (!profileId) {
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }

  if (!(await canEditProject(profileId, projectId))) {
    res.status(403).json({ error: "forbidden", message: "Åtkomst nekad." });
    return;
  }

  const [existing] = await db
    .select()
    .from(accountMappingsTable)
    .where(and(eq(accountMappingsTable.id, mappingId), eq(accountMappingsTable.projectId, projectId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "not_found", message: "Kontomappning hittades inte." });
    return;
  }

  const { reportLine, reportLineLabel, reason } = req.body as {
    reportLine?: string;
    reportLineLabel?: string;
    reason?: string;
  };

  if (!reportLine || !reportLineLabel) {
    res.status(400).json({ error: "invalid_input", message: "reportLine och reportLineLabel krävs." });
    return;
  }

  await db.insert(mappingOverridesTable).values({
    projectId,
    accountMappingId: mappingId,
    accountNumber: existing.accountNumber,
    previousReportLine: existing.reportLine,
    newReportLine: reportLine,
    reason: reason ?? null,
    overriddenByProfileId: profileId,
  });

  const [updated] = await db
    .update(accountMappingsTable)
    .set({
      reportLine,
      reportLineLabel,
      confidence: "high",
      status: "manually_mapped",
      isManualOverride: true,
      overriddenByProfileId: profileId,
      updatedAt: new Date(),
    })
    .where(eq(accountMappingsTable.id, mappingId))
    .returning();

  await logAuditEvent({
    eventType: "mapping_override_created",
    projectId,
    actorProfileId: profileId,
    eventData: {
      mappingId,
      accountNumber: existing.accountNumber,
      previousReportLine: existing.reportLine,
      newReportLine: reportLine,
    },
  });

  res.json(formatMapping(updated));
});

// ---------------------------------------------------------------------------
// GET /api/projects/:projectId/mapping-templates
// ---------------------------------------------------------------------------
router.get("/projects/:projectId/mapping-templates", async (req, res): Promise<void> => {
  const { projectId: _projectId } = req.params;
  const profileId = req.profile?.id;

  if (!profileId) {
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }

  const templates = await db
    .select()
    .from(mappingTemplatesTable)
    .where(eq(mappingTemplatesTable.createdByProfileId, profileId))
    .orderBy(mappingTemplatesTable.createdAt);

  res.json(templates.map(formatTemplate));
});

// ---------------------------------------------------------------------------
// POST /api/projects/:projectId/mapping-templates
// ---------------------------------------------------------------------------
router.post("/projects/:projectId/mapping-templates", async (req, res): Promise<void> => {
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

  const { name, description, mappings } = req.body as {
    name?: string;
    description?: string;
    mappings?: Array<{ accountNumber: string; reportLine: string; reportLineLabel: string }>;
  };

  if (!name || !mappings || !Array.isArray(mappings)) {
    res.status(400).json({ error: "invalid_input", message: "name och mappings krävs." });
    return;
  }

  const [template] = await db
    .insert(mappingTemplatesTable)
    .values({
      name,
      description: description ?? null,
      mappingsJson: mappings,
      createdByProfileId: profileId,
    })
    .returning();

  await logAuditEvent({
    eventType: "mapping_template_saved",
    projectId,
    actorProfileId: profileId,
    eventData: { templateId: template.id, name, mappingsCount: mappings.length },
  });

  res.status(201).json(formatTemplate(template));
});

// ---------------------------------------------------------------------------
// POST /api/projects/:projectId/mapping-templates/:templateId/apply
// ---------------------------------------------------------------------------
router.post("/projects/:projectId/mapping-templates/:templateId/apply", async (req, res): Promise<void> => {
  const { projectId, templateId } = req.params;
  const profileId = req.profile?.id;

  if (!profileId) {
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }

  if (!(await canEditProject(profileId, projectId))) {
    res.status(403).json({ error: "forbidden", message: "Åtkomst nekad." });
    return;
  }

  const [template] = await db
    .select()
    .from(mappingTemplatesTable)
    .where(eq(mappingTemplatesTable.id, templateId))
    .limit(1);

  if (!template) {
    res.status(404).json({ error: "not_found", message: "Mall hittades inte." });
    return;
  }

  const confirmedBatch = await db
    .select({ id: importBatchesTable.id })
    .from(importBatchesTable)
    .where(and(eq(importBatchesTable.projectId, projectId), eq(importBatchesTable.status, "confirmed")))
    .orderBy(importBatchesTable.confirmedAt)
    .limit(1);

  if (confirmedBatch.length === 0) {
    res.status(409).json({ error: "no_confirmed_batch", message: "Inga bekräftade importer hittades för detta projekt." });
    return;
  }

  const batchId = confirmedBatch[0].id;
  let appliedCount = 0;

  for (const entry of (template.mappingsJson as Array<{ accountNumber: string; reportLine: string; reportLineLabel: string }>)) {
    const [existing] = await db
      .select()
      .from(accountMappingsTable)
      .where(
        and(
          eq(accountMappingsTable.projectId, projectId),
          eq(accountMappingsTable.batchId, batchId),
          eq(accountMappingsTable.accountNumber, entry.accountNumber),
        ),
      )
      .limit(1);

    if (!existing) continue;

    await db.insert(mappingOverridesTable).values({
      projectId,
      accountMappingId: existing.id,
      accountNumber: existing.accountNumber,
      previousReportLine: existing.reportLine,
      newReportLine: entry.reportLine,
      reason: `Tillämpad från mall: ${template.name}`,
      overriddenByProfileId: profileId,
    });

    await db
      .update(accountMappingsTable)
      .set({
        reportLine: entry.reportLine,
        reportLineLabel: entry.reportLineLabel,
        confidence: "high",
        status: "manually_mapped",
        isManualOverride: true,
        overriddenByProfileId: profileId,
        updatedAt: new Date(),
      })
      .where(eq(accountMappingsTable.id, existing.id));

    appliedCount++;
  }

  await logAuditEvent({
    eventType: "mapping_override_created",
    projectId,
    actorProfileId: profileId,
    eventData: { templateId, templateName: template.name, appliedCount },
  });

  res.json({ appliedCount });
});

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
function formatMapping(m: typeof accountMappingsTable.$inferSelect) {
  return {
    id: m.id,
    projectId: m.projectId,
    batchId: m.batchId,
    accountNumber: m.accountNumber,
    accountName: m.accountName,
    reportLine: m.reportLine,
    reportLineLabel: m.reportLineLabel,
    basRange: m.basRange,
    confidence: m.confidence,
    status: m.status,
    noteImpactFlag: m.noteImpactFlag,
    noteImpactMetadata: m.noteImpactMetadata,
    isManualOverride: m.isManualOverride,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

function formatTemplate(t: typeof mappingTemplatesTable.$inferSelect) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    mappingsJson: t.mappingsJson,
    createdByProfileId: t.createdByProfileId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export default router;
