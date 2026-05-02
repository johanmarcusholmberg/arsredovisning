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

  const { orgNumber, zipCode, ...rest } = parsed.data;

  const [company] = await db
    .insert(companiesTable)
    .values({
      ...rest,
      organizationNumber: orgNumber,
      postalCode: zipCode ?? null,
      createdByProfileId: profileId,
    })
    .returning();

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

  const { zipCode, ...rest } = parsed.data;

  const [company] = await db
    .update(companiesTable)
    .set({
      ...rest,
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

  if (!company) {
    res.status(404).json({ error: "not_found", message: "Company not found" });
    return;
  }

  res.json(toApiCompany(company));
});

export { toApiCompany };
export default router;
