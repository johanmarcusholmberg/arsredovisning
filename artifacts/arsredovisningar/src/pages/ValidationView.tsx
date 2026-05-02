import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  useGetReport,
  getGetReportQueryKey,
  useGetLatestValidationRun,
  getGetLatestValidationRunQueryKey,
  useRunValidation,
  useDismissValidationIssue,
  useListValidationDismissals,
  getListValidationDismissalsQueryKey,
  type ValidationIssue,
  type ValidationDismissal,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  PlayCircle,
  Loader2,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function ValidationView() {
  const [, params] = useRoute("/reports/:reportId/validation");
  const reportId = params?.reportId ?? "";
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dismissTarget, setDismissTarget] = useState<ValidationIssue | null>(null);
  const [dismissComment, setDismissComment] = useState("");

  const { data: report } = useGetReport(reportId, {
    query: { enabled: !!reportId, queryKey: getGetReportQueryKey(reportId) },
  });

  const { data: latest, isLoading } = useGetLatestValidationRun(reportId, {
    query: {
      enabled: !!reportId,
      queryKey: getGetLatestValidationRunQueryKey(reportId),
    },
  });

  const { data: dismissalsData } = useListValidationDismissals(reportId, {
    query: {
      enabled: !!reportId,
      queryKey: getListValidationDismissalsQueryKey(reportId),
    },
  });

  const runMutation = useRunValidation();
  const dismissMutation = useDismissValidationIssue();

  const dismissedKeys = new Set(
    (dismissalsData?.dismissals ?? []).map((d: ValidationDismissal) => d.issueKey),
  );

  const issues: ValidationIssue[] = latest?.issues ?? [];
  const blocking = issues.filter((i) => i.level === "blocking");
  const warnings = issues.filter((i) => i.level === "warning" && !dismissedKeys.has(i.ruleKey));
  const info = issues.filter((i) => i.level === "info" && !dismissedKeys.has(i.ruleKey));
  const dismissedIssues = issues.filter((i) => dismissedKeys.has(i.ruleKey));

  const readiness = latest?.readinessLevel ?? "not_run";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetLatestValidationRunQueryKey(reportId) });
    qc.invalidateQueries({ queryKey: getListValidationDismissalsQueryKey(reportId) });
  };

  const handleRun = () => {
    runMutation.mutate(
      { reportId },
      {
        onSuccess: (r) => {
          toast({
            title: "Validering klar",
            description: `${r.blockingCount} blockerande, ${r.warningCount} varningar, ${r.infoCount} info.`,
          });
          invalidate();
        },
        onError: (e) =>
          toast({
            title: "Validering misslyckades",
            description: String(e),
            variant: "destructive",
          }),
      },
    );
  };

  const openDismissDialog = (issue: ValidationIssue) => {
    setDismissTarget(issue);
    setDismissComment("");
  };

  const handleDismiss = () => {
    if (!dismissTarget) return;
    if (dismissTarget.isHighRisk && !dismissComment.trim()) {
      toast({
        title: "Kommentar krävs",
        description: "Ange en kommentar för att avfärda en högrisk-varning.",
        variant: "destructive",
      });
      return;
    }
    dismissMutation.mutate(
      {
        reportId,
        data: {
          issueKey: dismissTarget.ruleKey,
          comment: dismissComment.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Varning avfärdad" });
          setDismissTarget(null);
          invalidate();
        },
        onError: (e) =>
          toast({
            title: "Kunde inte avfärda",
            description: String(e),
            variant: "destructive",
          }),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Link
          href={`/reports/${reportId}`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" /> Tillbaka till rapport
        </Link>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-primary" />
            Validering
          </h1>
          <p className="text-muted-foreground mt-1">
            Kontrollerar att rapporten uppfyller centrala krav före inlämning.
            Validering upptäcker vanliga fel men ersätter inte din egen granskning.
          </p>
        </div>
        <Button onClick={handleRun} disabled={runMutation.isPending}>
          {runMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <PlayCircle className="mr-2 h-4 w-4" />
          )}
          Kör validering
        </Button>
      </div>

      {/* Readiness summary */}
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryTile
              label="Status"
              value={
                readiness === "ready"
                  ? "Redo att exporteras"
                  : readiness === "blocked"
                  ? "Blockerad"
                  : "Ej körd"
              }
              tone={readiness === "ready" ? "ok" : readiness === "blocked" ? "danger" : "muted"}
              icon={
                readiness === "ready" ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : readiness === "blocked" ? (
                  <AlertCircle className="h-5 w-5" />
                ) : (
                  <Info className="h-5 w-5" />
                )
              }
            />
            <SummaryTile
              label="Blockerande"
              value={String(latest?.blockingCount ?? 0)}
              tone={(latest?.blockingCount ?? 0) > 0 ? "danger" : "ok"}
              icon={<AlertCircle className="h-5 w-5" />}
            />
            <SummaryTile
              label="Varningar"
              value={String(warnings.length)}
              tone={warnings.length > 0 ? "warn" : "ok"}
              icon={<AlertTriangle className="h-5 w-5" />}
            />
            <SummaryTile
              label="Avfärdade"
              value={String(dismissedIssues.length)}
              tone="muted"
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
          </div>
          {latest?.runAt && (
            <p className="text-xs text-muted-foreground mt-4">
              Senast körd: {new Date(latest.runAt).toLocaleString("sv-SE")}
            </p>
          )}
        </CardContent>
      </Card>

      {!latest?.runAt && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Inga valideringskörningar ännu</AlertTitle>
          <AlertDescription>
            Klicka på &quot;Kör validering&quot; för att kontrollera rapporten mot centrala regler.
          </AlertDescription>
        </Alert>
      )}

      {/* Issue lists */}
      {blocking.length > 0 && (
        <IssueList
          title="Blockerande problem"
          subtitle="Måste åtgärdas innan rapporten kan exporteras."
          color="danger"
          icon={<AlertCircle className="h-5 w-5" />}
          issues={blocking}
          onNavigate={(p) => navigate(p)}
        />
      )}

      {warnings.length > 0 && (
        <IssueList
          title="Varningar"
          subtitle="Bör granskas. Du kan avfärda när du har bekräftat."
          color="warn"
          icon={<AlertTriangle className="h-5 w-5" />}
          issues={warnings}
          onNavigate={(p) => navigate(p)}
          onDismiss={openDismissDialog}
        />
      )}

      {info.length > 0 && (
        <IssueList
          title="Information"
          subtitle="Tips och påminnelser."
          color="muted"
          icon={<Info className="h-5 w-5" />}
          issues={info}
          onNavigate={(p) => navigate(p)}
          onDismiss={openDismissDialog}
        />
      )}

      {dismissedIssues.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-muted-foreground">
              Avfärdade varningar ({dismissedIssues.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dismissedIssues.map((i) => {
              const d = (dismissalsData?.dismissals ?? []).find(
                (x: ValidationDismissal) => x.issueKey === i.ruleKey,
              );
              return (
                <div
                  key={i.ruleKey}
                  className="text-sm text-muted-foreground border rounded p-3"
                >
                  <div className="line-through">{i.message}</div>
                  {d?.comment && (
                    <div className="mt-1 italic">Kommentar: {d.comment}</div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {report && latest?.runAt && issues.length === 0 && (
        <Alert className="border-green-500/40 bg-green-500/5">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Inga problem hittades</AlertTitle>
          <AlertDescription>
            Den senaste körningen hittade inga blockerande problem eller varningar.
            Glöm inte att granska innehållet manuellt också.
          </AlertDescription>
        </Alert>
      )}

      {/* Dismiss dialog */}
      <Dialog open={!!dismissTarget} onOpenChange={(o) => !o && setDismissTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avfärda varning</DialogTitle>
            <DialogDescription>
              {dismissTarget?.message}
            </DialogDescription>
          </DialogHeader>
          {dismissTarget?.isHighRisk && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Högriskvarning</AlertTitle>
              <AlertDescription>
                Den här varningen är klassad som högrisk. Förklara varför den kan avfärdas.
              </AlertDescription>
            </Alert>
          )}
          <Textarea
            placeholder={
              dismissTarget?.isHighRisk
                ? "Förklara varför varningen kan avfärdas (obligatoriskt)"
                : "Valfri kommentar"
            }
            value={dismissComment}
            onChange={(e) => setDismissComment(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDismissTarget(null)}>
              Avbryt
            </Button>
            <Button onClick={handleDismiss} disabled={dismissMutation.isPending}>
              {dismissMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Avfärda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "danger" | "muted";
  icon: React.ReactNode;
}) {
  const colorMap: Record<typeof tone, string> = {
    ok: "text-green-600 bg-green-500/10",
    warn: "text-amber-600 bg-amber-500/10",
    danger: "text-red-600 bg-red-500/10",
    muted: "text-muted-foreground bg-muted/40",
  };
  return (
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-md flex items-center justify-center ${colorMap[tone]}`}>
        {icon}
      </div>
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-lg font-semibold">{value}</div>
      </div>
    </div>
  );
}

function IssueList({
  title,
  subtitle,
  color,
  icon,
  issues,
  onNavigate,
  onDismiss,
}: {
  title: string;
  subtitle: string;
  color: "danger" | "warn" | "muted";
  icon: React.ReactNode;
  issues: ValidationIssue[];
  onNavigate: (path: string) => void;
  onDismiss?: (i: ValidationIssue) => void;
}) {
  const ringClass =
    color === "danger"
      ? "border-red-500/30"
      : color === "warn"
      ? "border-amber-500/30"
      : "border-muted";
  return (
    <Card className={`shadow-sm border ${ringClass}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
          <Badge variant="secondary" className="ml-2">
            {issues.length}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {issues.map((i) => (
          <div
            key={i.ruleKey}
            className="border rounded p-3 flex items-start justify-between gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm">{i.message}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                <span className="font-mono">{i.ruleKey}</span>
                {i.isHighRisk && (
                  <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                    Högrisk
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {i.quickLinkPath && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigate(i.quickLinkPath!)}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Gå till
                </Button>
              )}
              {onDismiss && (
                <Button size="sm" variant="ghost" onClick={() => onDismiss(i)}>
                  Avfärda
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
