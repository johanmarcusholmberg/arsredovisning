# Export template & preview model (Phase 6.6)

## Single source of truth

`AnnualReportExportData` (in `lib/export-contract`) is the only data shape
the preview page, the PDF renderer, and the Word renderer consume. The
server-side builder (`exportDataBuilder.ts`) is the only producer.

This means: if you change a heading, a Swedish label, the Not-column
formatting, or the cover sheet model, you change it once and all three
surfaces update together.

```
            ┌──────────────────────────────┐
DB          │ buildAnnualReportExportData │  (server)
            └──────────────┬───────────────┘
                           ▼
              AnnualReportExportData
              ┌────────────┼─────────────┐
              ▼            ▼             ▼
         AnnualReport   pdfRenderer   wordRenderer
         Document.tsx   (pdfkit)      (docx)
         (preview)       → .pdf        → .docx
```

## Sections

- **Cover** — three modes (`auto`, `logo`, `uploaded`); always Swedish.
- **Förvaltningsberättelse** — structural skeleton with required headings.
- **Resultaträkning, Balansräkning, Kassaflödesanalys** — rendered from
  `financial_statement_lines` with reclass adjustments applied via
  `presentationAmounts`.
- **Noter** — rendered from `report_notes` + `report_note_rows`,
  filtered to non-`not_applicable` notes, numbered 1..N.
- **Underskrifter** — placeholder block; signatures are filled in by the
  user before submission.

## Cover sheet contract

`annual_report_projects` columns: `cover_mode` (`auto|logo|uploaded`),
`cover_title`, `cover_subtitle`, `cover_logo_url`, `cover_uploaded_file_id`.
The export builder reads these and resolves an `ExportCoverSheet`.

## Watermark policy

`mustWatermark(isDemo, isPaid)` decides:

- `isDemo === true` → always watermarked.
- `isPaid === false` → watermarked.
- otherwise → no watermark.

Server enforces this in `generateExport()`; clients cannot opt out. The
known demo project UUID short-circuits to `true`.

## Readiness model

`ExportReadiness` aggregates four sources:

1. Validation engine (blocking / warning).
2. Export consistency (`exportConsistency.ts`): orphan note refs,
   unconfirmed required notes, reclassification balance.
3. Permissions (`canExportProject` — owner role).
4. Entitlement (`hasPaidProjectEntitlement`).

`canExportFinal === false` blocks PDF/Word generation server-side; the UI
mirrors that by disabling the buttons.
