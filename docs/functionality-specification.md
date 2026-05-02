# Functionality Specification — Årsredovisningar

> **Status:** Placeholder. Fill this in with the full product specification before Phase 1 begins.

## Product Overview

**Årsredovisningar** is a web application for preparing Swedish annual reports (årsredovisningar). It is intended to guide accounting professionals and small business owners through the process of producing a compliant annual report from financial data.

---

## Core Entities (preliminary)

These entities are anticipated based on the product domain. Confirm and expand before Phase 2 schema work.

### Company
- Organization number (organisationsnummer)
- Company name
- Legal form (AB, HB, KB, etc.)
- Address
- Fiscal year definition

### Fiscal Year
- Start date / end date
- Status (open, closed, exported)
- Linked to Company

### Annual Report
- Linked to Fiscal Year
- Sections: balance sheet, income statement, notes, signatures
- Completion status per section
- Export status

### User
- Email
- Role (owner, accountant, viewer)
- Linked companies

---

## Core Workflows (preliminary)

1. **Create company** — enter company details and define fiscal year
2. **Import financial data** — upload or enter trial balance / SIE file
3. **Map accounts** — map chart-of-accounts lines to report positions
4. **Enter notes** — complete required disclosures and accounting policies
5. **Validate** — check for missing or inconsistent data
6. **Export** — generate PDF or Word document
7. **Pay** — gate final export behind Stripe payment (if applicable)

---

## Swedish Compliance Requirements (preliminary)

- Must conform to ÅRL (Årsredovisningslagen)
- Must reference K2 or K3 accounting framework
- Balance sheet and income statement formats are legally prescribed
- Specific notes are mandatory depending on company size and legal form
- Auditor signature requirements vary by company size

---

## Out of Scope (initial phases)

- Consolidation (koncernredovisning)
- XBRL/iXBRL output
- Multi-user real-time collaboration
- Direct SIE4 export
- Integration with Skatteverket

---

> Update this file with the complete specification when available.
