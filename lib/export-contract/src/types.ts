/**
 * Single source-of-truth contract for the Swedish annual report export.
 *
 * The same `AnnualReportExportData` object powers:
 *   1. The on-screen Preview & Export page (HTML/React render)
 *   2. The server-side PDF renderer (pdfkit)
 *   3. The server-side Word renderer (docx)
 *
 * Output is always Swedish — UI may be bilingual but the document is svensk
 * årsredovisning. Numbers are stored as plain JS `number` (SEK), formatted on
 * render via `formatSEK` / `formatYear` helpers in `./format`.
 */

export type Framework = "K2" | "K3";

export type StatementType = "income_statement" | "balance_sheet" | "cash_flow";

// ---------- Cover sheet -----------------------------------------------------

export type CoverMode = "auto" | "uploaded" | "logo";

export interface ExportCoverSheet {
  mode: CoverMode;
  /** Title to render on the cover. Defaults to "Årsredovisning". */
  title: string;
  /** Subtitle, typically the fiscal-year label (e.g. "Räkenskapsåret 2024"). */
  subtitle: string;
  /** Optional logo URL (used when mode = "logo" or "auto" and a logo is set). */
  logoUrl: string | null;
  /** When mode = "uploaded", the cover is replaced by the user-supplied PDF. */
  uploadedFileId: string | null;
  /** Resolved download URL for the uploaded cover (server-side resolved). */
  uploadedFileUrl: string | null;
}

// ---------- Header / company metadata --------------------------------------

export interface CompanySnapshot {
  id: string;
  name: string;
  organizationNumber: string;
  registeredAddress: string | null;
  framework: Framework;
}

export interface FiscalPeriod {
  start: string; // ISO date
  end: string; // ISO date
  label: string; // "Räkenskapsåret 2024"
  comparativeLabel: string | null; // "Räkenskapsåret 2023"
}

// ---------- Förvaltningsberättelse -----------------------------------------

export interface ManagementReportSection {
  /** Heading shown in the document (e.g. "Verksamheten"). */
  heading: string;
  /** Multi-paragraph body text. Each entry is one paragraph. */
  paragraphs: string[];
}

export interface ManagementReport {
  /** Required ordered sections of the förvaltningsberättelse. */
  sections: ManagementReportSection[];
  /** Optional 5-year overview (flerårsöversikt). */
  multiYearOverview: MultiYearOverviewRow[] | null;
}

export interface MultiYearOverviewRow {
  label: string;
  values: (number | null)[]; // most-recent year first
}

// ---------- Financial statements -------------------------------------------

/**
 * One rendered line of a financial statement (Resultaträkning, Balansräkning,
 * or Kassaflödesanalys). Contains the *presented* amounts (after any active
 * reclassifications) — the renderer is allowed to trust these and never
 * recompute.
 */
export interface StatementLine {
  id: string;
  lineKey: string;
  label: string;
  currentYearAmount: number | null;
  previousYearAmount: number | null;
  isHeading: boolean;
  isSubtotal: boolean;
  isTotal: boolean;
  /** "Not"-column text — already resolved (e.g. "1, 4" or "12"). */
  noteReferenceText: string | null;
  sortOrder: number;
}

export interface FinancialStatement {
  type: StatementType;
  /** Swedish heading (e.g. "Resultaträkning"). */
  heading: string;
  lines: StatementLine[];
}

// ---------- Notes -----------------------------------------------------------

export interface NoteRow {
  id: string;
  label: string;
  currentYearAmount: number | null;
  previousYearAmount: number | null;
  isSubtotal: boolean;
}

export interface RenderedNote {
  id: string;
  /** Final assigned note number (1..N). null for not_applicable notes. */
  noteNumber: number | null;
  noteType: string;
  title: string;
  /** Final, accepted text. May be empty for purely tabular notes. */
  text: string | null;
  rows: NoteRow[];
  /** Whether the AI text was confirmed by the user. */
  confirmedByUser: boolean;
  /** Whether the note has any unresolved blocking issue (e.g. missing text). */
  hasBlockingIssue: boolean;
}

// ---------- Signatures ------------------------------------------------------

export interface SignatureSlot {
  /** "Styrelseledamot", "Ordförande", "Revisor", … */
  role: string;
  name: string;
  /** Optional signing location (e.g. "Stockholm"). */
  location: string | null;
  /** Optional signing date (ISO). */
  signedDate: string | null;
}

// ---------- Watermark / demo --------------------------------------------------

export interface ExportWatermark {
  /** True when the document must show a "DEMO – EJ FÖR INLÄMNING" overlay. */
  show: boolean;
  /** Reason for watermark (rendered as small footer hint when shown). */
  reason: "demo" | "unpaid" | null;
  /** Localized text. */
  text: string;
}

// ---------- Top-level contract ---------------------------------------------

export interface AnnualReportExportData {
  schemaVersion: 1;
  /** ISO timestamp of when the snapshot was built. */
  generatedAt: string;
  projectId: string | null;
  reportId: string;
  cover: ExportCoverSheet;
  company: CompanySnapshot;
  period: FiscalPeriod;
  managementReport: ManagementReport;
  statements: FinancialStatement[];
  notes: RenderedNote[];
  signatures: SignatureSlot[];
  watermark: ExportWatermark;
}

// ---------- Readiness / consistency ----------------------------------------

export type ReadinessLevel = "blocking" | "warning" | "info" | "ok";

export type ReadinessCode =
  | "validation_blocking"
  | "validation_warning"
  | "notes_unconfirmed"
  | "notes_missing_text"
  | "notes_orphan_reference"
  | "notes_unmapped_reference"
  | "reclass_inconsistency"
  | "signatures_missing"
  | "permissions_required"
  | "entitlement_required"
  | "demo_only"
  | "ready";

export interface ReadinessItem {
  code: ReadinessCode;
  level: ReadinessLevel;
  /** Swedish-safe message shown to the user. */
  message: string;
  /** Optional deep-link path (relative to current report). */
  quickLinkPath?: string | null;
}

export interface ExportReadiness {
  /** Aggregate verdict for the whole report. */
  level: ReadinessLevel;
  /** True when no blocking items are present and required gates pass. */
  canExportFinal: boolean;
  /** True when the user can at least preview / generate a watermarked draft. */
  canExportDraft: boolean;
  /** Sorted blocking → warning → info → ok. */
  items: ReadinessItem[];
  /** Whether the project is in demo mode. */
  isDemo: boolean;
  /** Whether a paid entitlement exists for the project. */
  isPaid: boolean;
  /** Whether the caller can export (owner role or project-not-found fallback). */
  canExport: boolean;
}

// ---------- Export history --------------------------------------------------

export type ExportFormat = "pdf" | "word" | "package";

export interface ExportHistoryEntry {
  id: string;
  format: ExportFormat;
  filename: string;
  watermark: boolean;
  exportStatus: "pending" | "ready" | "failed";
  fileSize: number | null;
  generatedAt: string;
  generatedByProfileId: string | null;
  /** Brief snapshot summary (counts, period) captured at export time. */
  snapshotSummary: ExportSnapshotSummary | null;
}

export interface ExportSnapshotSummary {
  fiscalYearLabel: string;
  noteCount: number;
  statementLineCount: number;
  blockingIssues: number;
  warningIssues: number;
  watermark: boolean;
  framework: Framework;
}
