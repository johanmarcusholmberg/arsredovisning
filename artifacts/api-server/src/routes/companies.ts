/**
 * Companies routes — Phase 1 / Phase 2 / Phase 2.5.
 *
 * These routes map between the OpenAPI contract (which uses legacy field names
 * from the original spec: orgNumber, zipCode) and the updated Drizzle schema
 * (organizationNumber, postalCode). The API contract field names are preserved
 * for backward compatibility with existing frontend code.
 *
 * The fiscalYearStart / fiscalYearEnd fields from the original spec have been
 * moved to annual_report_projects — they are no longer on companies.
 * The response omits those fields from Phase 2.5 onward.
 *
 * User-scoping: all routes filter by createdByProfileId = req.profile.id,
 * so users only see companies they own (Phase 2 security model).
 */

import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, companiesTable, type Company } from "@workspace/db";
import {
  CreateCompanyBody,
  UpdateCompanyBody,
  GetCompanyParams,
  UpdateCompanyParams,
} from "@workspace/api-zod";
import { logAuditEvent } from "../lib/auditLog.js";

const router: IRouter = Router();

function isValidMonthDay(v: string): boolean {
  if (!/^\d{2}-\d{2}$/.test(v)) return false;
  const [m, d] = v.split("-").map((n) => parseInt(n, 10));
  if (m < 1 || m > 12 || d < 1) return false;
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= daysInMonth[m - 1];
}

/**
 * Map a DB Company row to the API response shape.
 * DB uses organizationNumber/postalCode; OpenAPI/frontend uses orgNumber/zipCode.
 * fiscalYearStart / fiscalYearEnd are omitted (moved to annual_report_projects).
 */
function toApiCompany(c: Company) {
  return {
    id: c.id,
    name: c.name,
    orgNumber: c.organizationNumber,
    legalForm: c.legalForm,
    accountingFramework: c.accountingFramework as "K2" | "K3",
    fiscalYearStart: c.fiscalYearStart,
    fiscalYearEnd: c.fiscalYearEnd,
    address: c.address ?? undefined,
    zipCode: c.postalCode ?? undefined,
    city: c.city ?? undefined,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

router.get("/companies", async (req, res): Promise<void> => {
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const companies = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.createdByProfileId, profileId))
    .orderBy(companiesTable.createdAt);

  res.json(companies.map(toApiCompany));
});

router.post("/companies", async (req, res): Promise<void> => {
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const parsed = CreateCompanyBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid company body");
    res.status(400).json({ error: "invalid_input", message: parsed.error.message });
    return;
  }

  if (!isValidMonthDay(parsed.data.fiscalYearStart) || !isValidMonthDay(parsed.data.fiscalYearEnd)) {
    res.status(400).json({ error: "invalid_input", message: "fiscalYearStart/fiscalYearEnd must be valid MM-DD" });
    return;
  }

  const { orgNumber, zipCode, ...rest } = parsed.data;

  let company;
  try {
    [company] = await db
      .insert(companiesTable)
      .values({
        ...rest,
        organizationNumber: orgNumber,
        postalCode: zipCode ?? null,
        createdByProfileId: profileId,
      })
      .returning();
    if (!company) throw new Error("insert_failed");
  } catch (err: unknown) {
    const pgErr = err as { code?: string; constraint?: string };
    if (pgErr?.code === "23505") {
      req.log.warn({ orgNumber }, "Duplicate organisation number on company create");
      res.status(409).json({
        error: "duplicate_org_number",
        field: "orgNumber",
        message: `A company with organisation number ${orgNumber} already exists.`,
      });
      return;
    }
    throw err;
  }

  await logAuditEvent({
    eventType: "company.created",
    actorProfileId: profileId,
    companyId: company.id,
    payload: { name: company.name },
  });

  res.status(201).json(toApiCompany(company));
});

router.get("/companies/:companyId", async (req, res): Promise<void> => {
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const params = GetCompanyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid_params", message: params.error.message });
    return;
  }

  const [company] = await db
    .select()
    .from(companiesTable)
    .where(
      and(
        eq(companiesTable.id, params.data.companyId),
        eq(companiesTable.createdByProfileId, profileId),
      ),
    );

  if (!company) {
    res.status(404).json({ error: "not_found", message: "Company not found" });
    return;
  }

  res.json(toApiCompany(company));
});

router.patch("/companies/:companyId", async (req, res): Promise<void> => {
  const profileId = req.profile?.id;
  if (!profileId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const params = UpdateCompanyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid_params", message: params.error.message });
    return;
  }

  const parsed = UpdateCompanyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input", message: parsed.error.message });
    return;
  }

  if (parsed.data.fiscalYearStart !== undefined && !isValidMonthDay(parsed.data.fiscalYearStart)) {
    res.status(400).json({ error: "invalid_input", message: "fiscalYearStart must be valid MM-DD" });
    return;
  }
  if (parsed.data.fiscalYearEnd !== undefined && !isValidMonthDay(parsed.data.fiscalYearEnd)) {
    res.status(400).json({ error: "invalid_input", message: "fiscalYearEnd must be valid MM-DD" });
    return;
  }

  const { zipCode, orgNumber, ...rest } = parsed.data;

  let company;
  try {
    [company] = await db
      .update(companiesTable)
      .set({
        ...rest,
        ...(orgNumber !== undefined && { organizationNumber: orgNumber }),
        ...(zipCode !== undefined && { postalCode: zipCode }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(companiesTable.id, params.data.companyId),
          eq(companiesTable.createdByProfileId, profileId),
        ),
      )
      .returning();
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === "23505") {
      res.status(409).json({
        error: "duplicate_org_number",
        field: "orgNumber",
        message: `A company with organisation number ${orgNumber} already exists.`,
      });
      return;
    }
    throw err;
  }

  if (!company) {
    res.status(404).json({ error: "not_found", message: "Company not found" });
    return;
  }

  res.json(toApiCompany(company));
});

export { toApiCompany };
export default router;
