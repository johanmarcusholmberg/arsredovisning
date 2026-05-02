import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  Database,
  KeyRound,
  CreditCard,
  Cloud,
  Sparkles,
  FileText,
  ShieldCheck,
  Users,
  ListChecks,
  Info,
} from "lucide-react";

type Status = "ready" | "partial" | "todo";

function StatusBadge({ status }: { status: Status }) {
  if (status === "ready") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/10">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Klar
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/30 hover:bg-amber-500/10">
        <AlertTriangle className="h-3 w-3 mr-1" /> Delvis
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <Circle className="h-3 w-3 mr-1" /> Att göra
    </Badge>
  );
}

function ChecklistItem({
  label,
  description,
  status,
}: {
  label: string;
  description?: string;
  status: Status;
}) {
  return (
    <li className="flex items-start justify-between gap-4 py-3 border-b last:border-b-0 border-border/60">
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">
        <StatusBadge status={status} />
      </div>
    </li>
  );
}

function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="border-b bg-muted/20 pb-4">
        <div className="flex items-center gap-2">
          <div className="text-primary">{icon}</div>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-2">
        <ul>{children}</ul>
      </CardContent>
    </Card>
  );
}

export function LaunchChecklist() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          <ListChecks className="h-3.5 w-3.5" />
          Internal · Launch readiness
        </div>
        <h1 className="text-3xl font-bold tracking-tight mt-1">
          Launch checklist
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Intern översikt över MVP-statusen för Årsredovisningar. Den här sidan
          är avsedd för utvecklare och produktansvariga inför skarp lansering.
        </p>
      </div>

      <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-4 flex gap-3">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-foreground">
            Compliance-positionering
          </p>
          <p className="text-muted-foreground mt-1">
            Produkten är en complianceassistent — inte en garanti. All publik
            text använder formuleringen{" "}
            <em>
              &quot;No blocking validation issues were found. Please review
              before filing.&quot;
            </em>{" "}
            (sv: &quot;Inga blockerande valideringsfel hittades. Granska
            noggrant innan inlämning.&quot;).
          </p>
        </div>
      </div>

      <Section
        title="Miljövariabler"
        description="Måste vara konfigurerade i Replit Secrets innan deploy."
        icon={<KeyRound className="h-5 w-5" />}
      >
        <ChecklistItem
          label="DATABASE_URL"
          description="PostgreSQL-anslutning (Replit built-in)."
          status="ready"
        />
        <ChecklistItem
          label="SUPABASE_URL / SUPABASE_ANON_KEY"
          description="Klientsidans Supabase-konfiguration."
          status="ready"
        />
        <ChecklistItem
          label="SUPABASE_SERVICE_ROLE_KEY"
          description="Server-only. Får aldrig exponeras i frontend."
          status="ready"
        />
        <ChecklistItem
          label="OPENAI_API_KEY"
          description="Server-only. Används för AI-utkast i noter."
          status="ready"
        />
        <ChecklistItem
          label="STRIPE_SECRET_KEY"
          description="Aktiveras i fas 9. Webhook secret krävs också."
          status="todo"
        />
      </Section>

      <Section
        title="Supabase: tabeller och RLS"
        description="Schema och Row Level Security."
        icon={<Database className="h-5 w-5" />}
      >
        <ChecklistItem
          label="Kärntabeller"
          description="profiles, companies, projects, reports, statement_lines, notes, validation_runs, audit_events, project_snapshots."
          status="ready"
        />
        <ChecklistItem
          label="Entitlement-tabell"
          description="project_entitlements är skapad och redo. Stripe-koppling i fas 9."
          status="partial"
        />
        <ChecklistItem
          label="RLS-policies"
          description="Aktiveras per tabell. Genomgång krävs innan lansering."
          status="partial"
        />
        <ChecklistItem
          label="Storage-buckets"
          description="exports (paid) och demo-assets (demo) är separerade."
          status="ready"
        />
      </Section>

      <Section
        title="Auth"
        description="Supabase Auth med JWT."
        icon={<ShieldCheck className="h-5 w-5" />}
      >
        <ChecklistItem
          label="Inloggning / registrering"
          description="E-post + lösenord, server-validering, profil skapas vid första inloggning."
          status="ready"
        />
        <ChecklistItem
          label="Permission checkers"
          description="canViewProject / canEditProject / canExportProject finns på server-sidan."
          status="ready"
        />
        <ChecklistItem
          label="Inbjudan av kollegor"
          description="Workspace-roller (Owner / Editor / Reviewer / Read-only) — UI saknas."
          status="todo"
        />
      </Section>

      <Section
        title="Betalning"
        description="Stripe-koppling och låsta funktioner."
        icon={<CreditCard className="h-5 w-5" />}
      >
        <ChecklistItem
          label="Demo vs paid"
          description="Demo-projekt är tydligt märkta och använder watermark vid export."
          status="ready"
        />
        <ChecklistItem
          label="Locked-state UI"
          description="Lås visas på exportknappar för obetald åtkomst."
          status="ready"
        />
        <ChecklistItem
          label="Stripe Checkout-flöde"
          description="Implementeras i fas 9."
          status="todo"
        />
        <ChecklistItem
          label="Stripe webhooks"
          description="checkout.session.completed → uppdatera project_entitlements."
          status="todo"
        />
      </Section>

      <Section
        title="Export (PDF / Word)"
        description="In-process renderare i API-server."
        icon={<FileText className="h-5 w-5" />}
      >
        <ChecklistItem
          label="Export-kontrakt"
          description="lib/export-contract är single source of truth (Preview = PDF = Word)."
          status="ready"
        />
        <ChecklistItem
          label="PDF-renderare (pdfkit)"
          description="Externaliserad i build.mjs så att fonter/native-deps löser sig korrekt."
          status="ready"
        />
        <ChecklistItem
          label="Word-renderare (docx)"
          description="Genererar .docx från samma kontrakt."
          status="ready"
        />
        <ChecklistItem
          label="Watermark på demoexporter"
          description="Renderas på alla sidor för demo-projekt."
          status="ready"
        />
        <ChecklistItem
          label="Notnumrering konsistent över Preview/PDF/Word"
          description="Använder samma siffror överallt via export-kontraktet."
          status="ready"
        />
      </Section>

      <Section
        title="AI"
        description="OpenAI för utkast av notetexter."
        icon={<Sparkles className="h-5 w-5" />}
      >
        <ChecklistItem
          label="AI-förslag i noter"
          description="Förslag är märkta &quot;AI-suggested — confirmation required&quot;."
          status="ready"
        />
        <ChecklistItem
          label="Confidence-badges"
          description="Visas i noter och statementrader."
          status="ready"
        />
        <ChecklistItem
          label="Manuell override"
          description="Användaren kan alltid skriva över AI-text och måste godkänna innan publicering."
          status="ready"
        />
      </Section>

      <Section
        title="Lagring"
        description="Filuppladdningar och exporter."
        icon={<Cloud className="h-5 w-5" />}
      >
        <ChecklistItem
          label="Uppladdning av SIE-filer"
          description="Filtypskontroll + storleksbegränsning."
          status="ready"
        />
        <ChecklistItem
          label="Signerade nedladdnings-URL:er"
          description="Korta TTL via /api/exports/:id/download."
          status="ready"
        />
      </Section>

      <Section
        title="Notnumrering & referenser"
        description="Kritisk konsistens-regel."
        icon={<ListChecks className="h-5 w-5" />}
      >
        <ChecklistItem
          label="Automatisk numrering"
          description="Notes få nummer baserat på sortering. Ej tillämpliga noter hoppas över."
          status="ready"
        />
        <ChecklistItem
          label="Referenser i resultat-/balansräkning"
          description="Not-kolumnen uppdateras när notnummer ändras."
          status="ready"
        />
        <ChecklistItem
          label="Brutna referenser"
          description="Detekteras av valideringen och listas under blockerande problem."
          status="ready"
        />
        <ChecklistItem
          label="Konsistens Preview ↔ PDF ↔ Word"
          description="Manuell QA krävs vid varje större ändring av export-kontraktet."
          status="partial"
        />
      </Section>

      <Section
        title="QA — manuell genomgång"
        description="Köra igenom innan lansering."
        icon={<Users className="h-5 w-5" />}
      >
        <ChecklistItem
          label="Free user-flöde"
          description="Landing → demo → låst export → betalningsgate."
          status="partial"
        />
        <ChecklistItem
          label="Paid user-flöde"
          description="Skapa bolag → import → mappning → statement → noter → validering → preview → export."
          status="partial"
        />
        <ChecklistItem
          label="Mobil-/tabletvy"
          description="Sidofältet kollapsar och tabeller scrollar horisontellt."
          status="ready"
        />
        <ChecklistItem
          label="Språkväxling SV/EN"
          description="Endast UI. Annual report-output är alltid svensk."
          status="partial"
        />
      </Section>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-base">Kända begränsningar (MVP)</CardTitle>
          </div>
          <CardDescription>
            Dokumenteras tydligt mot användarna. Ej blockerande för lansering.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5 marker:text-amber-600">
            <li>Annual report-output stöds endast på svenska.</li>
            <li>Endast K2 / K3 (BFNAR). RFR 2 och IFRS ingår inte i MVP.</li>
            <li>
              Inga direktintegrationer mot Fortnox eller Visma — import sker via
              SIE-filer.
            </li>
            <li>
              Automatisk hämtning av tidigare årsredovisningar från Bolagsverket
              ingår inte.
            </li>
            <li>
              Avancerade godkännandeflöden (multi-step approval) ingår inte.
            </li>
            <li>Komplex versionsförgrening ingår inte — endast snapshots.</li>
            <li>
              Full mall-/templatehantering ingår inte. En standardmall används.
            </li>
            <li>
              Validering är en complianceassistent — inte en juridisk garanti.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export default LaunchChecklist;
