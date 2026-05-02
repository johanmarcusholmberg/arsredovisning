import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ChevronDown, ChevronRight, AlertTriangle, Search,
  GitBranch, Loader2, CheckCircle2, BookOpen, HelpCircle,
  Save, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/badges/ConfidenceBadge";

type Confidence = "high" | "medium" | "low" | "unmapped";
type MappingStatus = "auto_mapped" | "suggested" | "needs_review" | "manually_mapped" | "unmapped";
type FilterType = "all" | "unmapped" | "low_confidence" | "needs_review";

interface AccountMapping {
  id: string;
  projectId: string;
  batchId: string;
  accountNumber: string;
  accountName: string | null;
  reportLine: string | null;
  reportLineLabel: string | null;
  basRange: string | null;
  confidence: Confidence;
  status: MappingStatus;
  noteImpactFlag: boolean;
  noteImpactMetadata: Record<string, unknown> | null;
  isManualOverride: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MappingTemplate {
  id: string;
  name: string;
  description: string | null;
  mappingsJson: Array<{ accountNumber: string; reportLine: string; reportLineLabel: string }>;
  createdByProfileId: string;
  createdAt: string;
  updatedAt: string;
}

interface MappingSectionProps {
  projectId: string;
  isDemo?: boolean;
}

const REPORT_LINE_OPTIONS = [
  { value: "BS_1000_IntangibleAssets", label: "Immateriella anläggningstillgångar" },
  { value: "BS_1100_TangibleAssets", label: "Materiella anläggningstillgångar" },
  { value: "BS_1300_FinancialAssets", label: "Finansiella anläggningstillgångar" },
  { value: "BS_1400_Inventories", label: "Varulager m.m." },
  { value: "BS_1500_CurrentReceivables", label: "Kortfristiga fordringar" },
  { value: "BS_1700_ShortTermInvestments", label: "Kortfristiga placeringar" },
  { value: "BS_1800_CashAndBank", label: "Kassa och bank" },
  { value: "BS_2000_Equity", label: "Eget kapital" },
  { value: "BS_2100_UntaxedReserves", label: "Obeskattade reserver" },
  { value: "BS_2200_Provisions", label: "Avsättningar" },
  { value: "BS_2300_LongTermLiabilities", label: "Långfristiga skulder" },
  { value: "BS_2500_CurrentLiabilities", label: "Kortfristiga skulder" },
  { value: "IS_3000_NetRevenue", label: "Nettoomsättning" },
  { value: "IS_4000_COGS", label: "Råvaror och förnödenheter / Handelsvaror" },
  { value: "IS_5000_ExternalCosts", label: "Övriga externa kostnader" },
  { value: "IS_7000_PersonnelCosts", label: "Personalkostnader" },
  { value: "IS_7700_Depreciation", label: "Avskrivningar och nedskrivningar" },
  { value: "IS_7900_OtherOperatingCosts", label: "Övriga rörelsekostnader" },
  { value: "IS_8000_FinancialItems", label: "Finansiella intäkter och kostnader" },
  { value: "IS_8400_Appropriations", label: "Bokslutsdispositioner" },
  { value: "IS_8800_Tax", label: "Skatter" },
];

function MappingStatusBadge({ status }: { status: MappingStatus }) {
  const { t } = useLanguage();
  const configs: Record<MappingStatus, string> = {
    auto_mapped: "bg-blue-50 text-blue-700 border-blue-200",
    suggested: "bg-purple-50 text-purple-700 border-purple-200",
    needs_review: "bg-amber-50 text-amber-700 border-amber-200",
    manually_mapped: "bg-green-50 text-green-700 border-green-200",
    unmapped: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${configs[status]}`}>
      {t(`workspace.mapping.status.${status}` as Parameters<typeof t>[0])}
    </span>
  );
}

function OverrideModal({
  mapping,
  projectId,
  onSave,
  onClose,
}: {
  mapping: AccountMapping;
  projectId: string;
  onSave: (updated: AccountMapping) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [reportLine, setReportLine] = useState(mapping.reportLine ?? "");
  const [reportLineLabel, setReportLineLabel] = useState(mapping.reportLineLabel ?? "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleReportLineChange = (value: string) => {
    setReportLine(value);
    const opt = REPORT_LINE_OPTIONS.find((o) => o.value === value);
    if (opt) setReportLineLabel(opt.label);
  };

  const handleSave = async () => {
    if (!reportLine || !reportLineLabel) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/mappings/${mapping.id}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reportLine, reportLineLabel, reason: reason || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSaved(true);
        setTimeout(() => { onSave(updated); onClose(); }, 600);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-background rounded-xl border border-border shadow-lg p-6 space-y-4">
        <h3 className="text-base font-semibold text-foreground">{t("workspace.mapping.override.title")}</h3>
        <p className="text-xs text-muted-foreground font-mono">{mapping.accountNumber} — {mapping.accountName}</p>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t("workspace.mapping.override.label")}
          </label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={reportLine}
            onChange={(e) => handleReportLineChange(e.target.value)}
          >
            <option value="">Välj rapportposition...</option>
            {REPORT_LINE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t("workspace.mapping.override.reason")}
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Frivillig kommentar..."
          />
        </div>

        {/* Adaptive guidance */}
        <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <HelpCircle className="size-3.5" />
            {t("workspace.mapping.why.title")}
          </div>
          {mapping.basRange && (
            <p>Kontot mappades automatiskt baserat på BAS-kontoplanens intervall {mapping.basRange}.</p>
          )}
          <p>{t("workspace.mapping.why.override")}: Ditt val ersätter automappningen och markeras som manuellt.</p>
          {mapping.noteImpactFlag && (
            <p className="text-amber-700">⚠ {t("workspace.mapping.note.impact")}</p>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={onClose} disabled={saving}>{t("workspace.mapping.override.cancel")}</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !reportLine}>
            {saving ? <Loader2 className="size-3 mr-1 animate-spin" /> : saved ? <CheckCircle2 className="size-3 mr-1 text-green-500" /> : <Save className="size-3 mr-1" />}
            {saved ? t("workspace.mapping.override.saved") : t("workspace.mapping.override.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SaveTemplateModal({
  mappings,
  projectId,
  onSave,
  onClose,
}: {
  mappings: AccountMapping[];
  projectId: string;
  onSave: () => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const manualOverrides = mappings.filter((m) => m.isManualOverride);

  const handleSave = async () => {
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/mapping-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          description: description || null,
          mappings: manualOverrides.map((m) => ({
            accountNumber: m.accountNumber,
            reportLine: m.reportLine,
            reportLineLabel: m.reportLineLabel,
          })),
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => { onSave(); onClose(); }, 600);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm bg-background rounded-xl border border-border shadow-lg p-6 space-y-4">
        <h3 className="text-base font-semibold text-foreground">{t("workspace.mapping.template.save")}</h3>
        <p className="text-sm text-muted-foreground">{manualOverrides.length} manuella justeringar sparas.</p>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">{t("workspace.mapping.template.name")}</label>
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="T.ex. Standard K3 tjänsteföretag"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">{t("workspace.mapping.template.desc")}</label>
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={onClose}>{t("workspace.mapping.override.cancel")}</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !name}>
            {saving ? <Loader2 className="size-3 mr-1 animate-spin" /> : saved ? <CheckCircle2 className="size-3 mr-1" /> : <Save className="size-3 mr-1" />}
            {saved ? t("workspace.mapping.template.saved") : t("workspace.mapping.template.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function MappingSection({ projectId, isDemo = false }: MappingSectionProps) {
  const { t } = useLanguage();
  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [overrideTarget, setOverrideTarget] = useState<AccountMapping | null>(null);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [highCollapsed, setHighCollapsed] = useState(true);
  const [expandedGuidance, setExpandedGuidance] = useState<string | null>(null);

  const loadMappings = async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("filter", filter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/projects/${projectId}/mappings?${params}`, { credentials: "include" });
      if (res.ok) {
        setMappings(await res.json());
        setLoaded(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    setLoaded(false);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("filter", filter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/projects/${projectId}/mappings?${params}`, { credentials: "include" });
      if (res.ok) setMappings(await res.json());
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  };

  const handleFilterChange = (f: FilterType) => { setFilter(f); setLoaded(false); };
  const handleSearch = (s: string) => { setSearch(s); setLoaded(false); };

  // Load on first render
  if (!loaded && !loading) { loadMappings(); }

  const highConfidence = mappings.filter((m) => m.confidence === "high");
  const needsAttention = mappings.filter((m) => m.confidence !== "high");

  const filteredHighConfidence = highCollapsed ? [] : highConfidence;
  const displayedAttention = needsAttention;

  const manualOverrideCount = mappings.filter((m) => m.isManualOverride).length;

  if (isDemo) {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">{t("workspace.mapping.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("guidance.workspace.mapping")}</p>
        <div className="rounded-lg border border-border p-8 text-center text-muted-foreground text-sm">
          {t("workspace.mapping.empty.desc")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("workspace.mapping.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("workspace.mapping.subtitle")}</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 flex-wrap">
          {(["all", "unmapped", "low_confidence", "needs_review"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted/20"
              }`}
            >
              {t(`workspace.mapping.filter.${f === "low_confidence" ? "low" : f === "needs_review" ? "review" : f}` as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("workspace.mapping.search")}
            className="w-full pl-8 pr-3 py-1.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && refetch()}
          />
        </div>

        <Button size="sm" variant="outline" className="h-8" onClick={refetch} disabled={loading}>
          {loading ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
          Uppdatera
        </Button>

        {manualOverrideCount > 0 && (
          <Button size="sm" variant="outline" className="h-8" onClick={() => setShowSaveTemplate(true)}>
            <Save className="size-3 mr-1" />
            {t("workspace.mapping.template.save")}
          </Button>
        )}
      </div>

      {/* Content */}
      {loading && mappings.length === 0 ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : mappings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <GitBranch className="size-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">{t("workspace.mapping.empty")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("workspace.mapping.empty.desc")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Low confidence / unmapped / needs review — always visible */}
          {displayedAttention.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-amber-50/50 border-b border-border px-4 py-2.5 flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" />
                <span className="text-sm font-semibold text-foreground">
                  {displayedAttention.length} konton behöver granskning
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/20 border-b border-border">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("workspace.mapping.col.account")}</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">{t("workspace.mapping.col.report_line")}</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("workspace.mapping.col.confidence")}</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">{t("workspace.mapping.col.status")}</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("workspace.mapping.col.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedAttention.map((m) => (
                    <MappingRow
                      key={m.id}
                      mapping={m}
                      onOverride={setOverrideTarget}
                      expandedGuidance={expandedGuidance}
                      onToggleGuidance={(id) => setExpandedGuidance(expandedGuidance === id ? null : id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* High confidence — collapsible */}
          {highConfidence.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <button
                className="w-full flex items-center gap-2.5 px-4 py-3 bg-green-50/40 hover:bg-green-50/60 transition-colors text-sm font-semibold text-foreground"
                onClick={() => setHighCollapsed(!highCollapsed)}
              >
                {highCollapsed ? <ChevronRight className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                <CheckCircle2 className="size-4 text-green-600" />
                {highConfidence.length} {t("workspace.mapping.high.collapsed")}
              </button>
              {!highCollapsed && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/20 border-b border-border">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("workspace.mapping.col.account")}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">{t("workspace.mapping.col.report_line")}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("workspace.mapping.col.confidence")}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">{t("workspace.mapping.col.status")}</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("workspace.mapping.col.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHighConfidence.map((m) => (
                      <MappingRow
                        key={m.id}
                        mapping={m}
                        onOverride={setOverrideTarget}
                        expandedGuidance={expandedGuidance}
                        onToggleGuidance={(id) => setExpandedGuidance(expandedGuidance === id ? null : id)}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Override modal */}
      {overrideTarget && (
        <OverrideModal
          mapping={overrideTarget}
          projectId={projectId}
          onSave={(updated) => {
            setMappings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
            setOverrideTarget(null);
          }}
          onClose={() => setOverrideTarget(null)}
        />
      )}

      {/* Save template modal */}
      {showSaveTemplate && (
        <SaveTemplateModal
          mappings={mappings}
          projectId={projectId}
          onSave={() => setShowSaveTemplate(false)}
          onClose={() => setShowSaveTemplate(false)}
        />
      )}
    </div>
  );
}

function MappingRow({
  mapping,
  onOverride,
  expandedGuidance,
  onToggleGuidance,
}: {
  mapping: AccountMapping;
  onOverride: (m: AccountMapping) => void;
  expandedGuidance: string | null;
  onToggleGuidance: (id: string) => void;
}) {
  const { t } = useLanguage();
  const isExpanded = expandedGuidance === mapping.id;

  return (
    <>
      <tr className="border-b border-border hover:bg-muted/10 transition-colors">
        <td className="px-4 py-3">
          <p className="font-mono text-xs font-medium text-foreground">{mapping.accountNumber}</p>
          {mapping.accountName && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[140px]">{mapping.accountName}</p>
          )}
          {mapping.noteImpactFlag && (
            <div className="flex items-center gap-1 mt-1">
              <FileText className="size-3 text-amber-500" />
              <span className="text-[10px] text-amber-600">{t("workspace.mapping.note.impact")}</span>
            </div>
          )}
        </td>
        <td className="px-4 py-3 hidden sm:table-cell">
          {mapping.reportLineLabel ? (
            <span className="text-xs text-foreground">{mapping.reportLineLabel}</span>
          ) : (
            <span className="text-xs text-muted-foreground italic">Ej mappad</span>
          )}
        </td>
        <td className="px-4 py-3">
          <ConfidenceBadge confidence={mapping.confidence === "unmapped" ? "low" : mapping.confidence as "high" | "medium" | "low"} />
        </td>
        <td className="px-4 py-3 hidden md:table-cell">
          <MappingStatusBadge status={mapping.status} />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => onOverride(mapping)}>
              Ändra
            </Button>
            <button
              className="p-1 rounded hover:bg-muted/30 transition-colors"
              onClick={() => onToggleGuidance(mapping.id)}
              title={t("workspace.mapping.why.title")}
            >
              <HelpCircle className={`size-3.5 ${isExpanded ? "text-primary" : "text-muted-foreground"}`} />
            </button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-border bg-muted/5">
          <td colSpan={5} className="px-4 py-3">
            <div className="rounded-lg border border-border bg-background p-3 space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <BookOpen className="size-3.5" />
                {t("workspace.mapping.why.title")}
              </div>
              {mapping.basRange && (
                <p>
                  <span className="font-medium">{t("workspace.mapping.why.bas")}:</span> Konto {mapping.accountNumber} faller inom BAS-intervallet {mapping.basRange} → {mapping.reportLineLabel}.
                </p>
              )}
              {!mapping.basRange && (
                <p>Kontot matchade inget känt BAS-intervall och är omappad. Välj en rapportposition manuellt.</p>
              )}
              <p>
                <span className="font-medium">{t("workspace.mapping.why.override")}:</span> Om du ändrar mappningen ersätts automappningen. Ändringen loggas och kan ses i revisionsloggen.
              </p>
              {mapping.noteImpactFlag && mapping.noteImpactMetadata && (
                <p className="text-amber-700">
                  ⚠ {t("workspace.mapping.note.impact")}: Notkrav för <span className="font-mono">{String((mapping.noteImpactMetadata as Record<string, unknown>).noteType ?? "")}</span> kan aktiveras.
                </p>
              )}
              {mapping.isManualOverride && (
                <p className="text-green-700">✓ Denna mappning har ändrats manuellt.</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
