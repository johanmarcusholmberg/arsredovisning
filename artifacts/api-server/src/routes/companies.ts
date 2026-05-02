import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, companiesTable } from "@workspace/db";
import {
  CreateCompanyBody,
  UpdateCompanyBody,
  GetCompanyParams,
  UpdateCompanyParams,
  GetCompanyResponse,
  UpdateCompanyResponse,
  ListCompaniesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/companies", async (req, res): Promise<void> => {
  const companies = await db
    .select()
    .from(companiesTable)
    .orderBy(companiesTable.createdAt);
  res.json(ListCompaniesResponse.parse(companies));
});

router.post("/companies", async (req, res): Promise<void> => {
  const parsed = CreateCompanyBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid company body");
    res.status(400).json({ error: "invalid_input", message: parsed.error.message });
    return;
  }

  const [company] = await db.insert(companiesTable).values(parsed.data).returning();
  res.status(201).json(GetCompanyResponse.parse(company));
});

router.get("/companies/:companyId", async (req, res): Promise<void> => {
  const params = GetCompanyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid_params", message: params.error.message });
    return;
  }

  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, params.data.companyId));

  if (!company) {
    res.status(404).json({ error: "not_found", message: "Company not found" });
    return;
  }

  res.json(GetCompanyResponse.parse(company));
});

router.patch("/companies/:companyId", async (req, res): Promise<void> => {
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

  const [company] = await db
    .update(companiesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(companiesTable.id, params.data.companyId))
    .returning();

  if (!company) {
    res.status(404).json({ error: "not_found", message: "Company not found" });
    return;
  }

  res.json(UpdateCompanyResponse.parse(company));
});

export default router;
