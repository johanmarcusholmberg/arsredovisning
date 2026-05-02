/**
 * Compose the export readiness verdict from:
 *   1. Validation engine output (blocking / warning / info)
 *   2. Export-time consistency checks (orphan refs, reclass balance, …)
 *   3. Permission state (owner role required to export)
 *   4. Entitlement state (paid / demo)
 *
 * The verdict is an ordered list of `ReadinessItem`s plus aggregate flags
 * (`canExportFinal`, `canExportDraft`) the UI uses to enable/disable the
 * download buttons.
 */

import type {
  ExportReadiness,
  ReadinessItem,
  ReadinessLevel,
} from "@workspace/export-contract";
import { runValidation } from "./validationEngine.js";
import { runExportConsistencyChecks } from "./exportConsistency.js";
import { resolveProjectForReport } from "../helpers/projectReportLink.js";
import { isDemoProject, isKnownDemoProjectId } from "../helpers/demo.js";
import {
  hasPaidProjectEntitlement,
  canExportProject,
} from "../helpers/permissions.js";

const LEVEL_RANK: Record<ReadinessLevel, number> = {
  blocking: 0,
  warning: 1,
  info: 2,
  ok: 3,
};

export async function buildExportReadiness(
  reportId: string,
  profileId: string,
): Promise<ExportReadiness> {
  const items: ReadinessItem[] = [];

  // 1. Validation engine.
  const validation = await runValidation(reportId);
  for (const issue of validation.issues) {
    if (issue.level === "blocking") {
      items.push({
        code: "validation_blocking",
        level: "blocking",
        message: issue.message,
        quickLinkPath: issue.quickLinkPath ?? "validation",
      });
    } else if (issue.level === "warning") {
      items.push({
        code: "validation_warning",
        level: "warning",
        message: issue.message,
        quickLinkPath: issue.quickLinkPath ?? "validation",
      });
    }
  }

  // 2. Consistency checks (also produces blocking items for unconfirmed
  // notes and missing required text).
  const consistency = await runExportConsistencyChecks(reportId);
  items.push(...consistency);

  // 3. Permission + entitlement state.
  const link = await resolveProjectForReport(reportId);
  const projectId = link?.projectId ?? null;

  let isDemo = false;
  let isPaid = true;
  let canExport = true;

  if (projectId) {
    isDemo = isKnownDemoProjectId(projectId) || (await isDemoProject(projectId));
    isPaid = await hasPaidProjectEntitlement(projectId);
    canExport = await canExportProject(profileId, projectId);
  }

  if (!canExport) {
    items.push({
      code: "permissions_required",
      level: "blocking",
      message:
        "Endast projektägaren kan generera den slutgiltiga exporten. Be ägaren slutföra steget.",
    });
  }
  if (!isDemo && !isPaid) {
    items.push({
      code: "entitlement_required",
      level: "blocking",
      message:
        "Slutgiltig export kräver att projektet betalas. Endast vattenmärkt utkast kan laddas ner.",
    });
  }
  if (isDemo) {
    items.push({
      code: "demo_only",
      level: "info",
      message:
        "Detta är ett demoprojekt – alla exporter förses med vattenmärket DEMO – EJ FÖR INLÄMNING.",
    });
  }

  // Sort: blocking → warning → info → ok.
  items.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);

  const blockingCount = items.filter((i) => i.level === "blocking").length;
  const level: ReadinessLevel =
    blockingCount > 0
      ? "blocking"
      : items.some((i) => i.level === "warning")
      ? "warning"
      : items.some((i) => i.level === "info")
      ? "info"
      : "ok";

  if (items.length === 0) {
    items.push({
      code: "ready",
      level: "ok",
      message: "Rapporten är redo för slutgiltig export.",
    });
  }

  return {
    level,
    canExportFinal: blockingCount === 0,
    canExportDraft: true,
    items,
    isDemo,
    isPaid,
    canExport,
  };
}
