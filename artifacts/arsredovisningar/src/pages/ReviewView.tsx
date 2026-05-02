import { useState } from "react";
import { useRoute, Link } from "wouter";
import {
  useListSectionReviews,
  getListSectionReviewsQueryKey,
  useUpdateSectionReview,
  useListSectionComments,
  getListSectionCommentsQueryKey,
  useCreateSectionComment,
  useUpdateSectionComment,
  useListCollaborators,
  getListCollaboratorsQueryKey,
  useInviteCollaborator,
  useRemoveCollaborator,
  type SectionReview,
  type SectionComment,
  type Collaborator,
  type ReportSection,
  type ReviewStatus,
  type ReportRole,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ClipboardCheck,
  MessageSquare,
  Users,
  CheckCircle2,
  Trash2,
  Loader2,
  Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SECTION_LABELS: Record<ReportSection, string> = {
  import: "Import",
  mapping: "Kontomappning",
  financial_statements: "Finansiella rapporter",
  notes: "Noter",
  validation: "Validering",
  export: "Export",
};

const STATUS_LABELS: Record<ReviewStatus, string> = {
  not_started: "Ej påbörjad",
  in_progress: "Pågår",
  ready_for_review: "Redo för granskning",
  changes_requested: "Ändringar begärda",
  approved: "Godkänd",
};

const STATUS_TONE: Record<ReviewStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/10 text-blue-700",
  ready_for_review: "bg-amber-500/10 text-amber-700",
  changes_requested: "bg-orange-500/10 text-orange-700",
  approved: "bg-green-500/10 text-green-700",
};

const ROLE_LABELS: Record<ReportRole, string> = {
  owner: "Ägare",
  admin: "Administratör",
  accountant: "Redovisare",
  reviewer: "Granskare",
  auditor: "Revisor",
  read_only: "Läsbehörighet",
};

export function ReviewView() {
  const [, params] = useRoute("/reports/:reportId/review");
  const reportId = params?.reportId ?? "";
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeSection, setActiveSection] = useState<ReportSection>("financial_statements");
  const [newComment, setNewComment] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ReportRole>("reviewer");

  const { data: reviewsData, isLoading: reviewsLoading } = useListSectionReviews(reportId, {
    query: {
      enabled: !!reportId,
      queryKey: getListSectionReviewsQueryKey(reportId),
    },
  });

  const { data: commentsData } = useListSectionComments(
    reportId,
    { section: activeSection },
    {
      query: {
        enabled: !!reportId,
        queryKey: getListSectionCommentsQueryKey(reportId, { section: activeSection }),
      },
    },
  );

  const { data: collabData } = useListCollaborators(reportId, {
    query: {
      enabled: !!reportId,
      queryKey: getListCollaboratorsQueryKey(reportId),
    },
  });

  const updateReview = useUpdateSectionReview();
  const createComment = useCreateSectionComment();
  const updateComment = useUpdateSectionComment();
  const invite = useInviteCollaborator();
  const removeCollab = useRemoveCollaborator();

  const reviews: SectionReview[] = reviewsData?.reviews ?? [];
  const comments: SectionComment[] = commentsData?.comments ?? [];
  const collaborators: Collaborator[] = collabData?.collaborators ?? [];

  const invalidateReviews = () =>
    qc.invalidateQueries({ queryKey: getListSectionReviewsQueryKey(reportId) });
  const invalidateComments = () =>
    qc.invalidateQueries({
      queryKey: getListSectionCommentsQueryKey(reportId, { section: activeSection }),
    });
  const invalidateCollabs = () =>
    qc.invalidateQueries({ queryKey: getListCollaboratorsQueryKey(reportId) });

  const handleStatusChange = (section: ReportSection, status: ReviewStatus) => {
    updateReview.mutate(
      { reportId, section, data: { status } },
      {
        onSuccess: () => {
          toast({ title: "Granskningsstatus uppdaterad" });
          invalidateReviews();
        },
        onError: (e) =>
          toast({ title: "Kunde inte uppdatera", description: String(e), variant: "destructive" }),
      },
    );
  };

  const handlePostComment = () => {
    if (!newComment.trim()) return;
    createComment.mutate(
      {
        reportId,
        data: { section: activeSection, body: newComment.trim() },
      },
      {
        onSuccess: () => {
          setNewComment("");
          invalidateComments();
        },
        onError: (e) =>
          toast({ title: "Kunde inte spara", description: String(e), variant: "destructive" }),
      },
    );
  };

  const handleResolveComment = (c: SectionComment) => {
    updateComment.mutate(
      { reportId, commentId: c.id, data: { resolved: !c.resolved } },
      { onSuccess: () => invalidateComments() },
    );
  };

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    invite.mutate(
      { reportId, data: { email: inviteEmail.trim(), role: inviteRole } },
      {
        onSuccess: () => {
          toast({ title: "Inbjudan registrerad" });
          setInviteEmail("");
          invalidateCollabs();
        },
        onError: (e) =>
          toast({ title: "Inbjudan misslyckades", description: String(e), variant: "destructive" }),
      },
    );
  };

  const handleRemove = (profileId: string) => {
    removeCollab.mutate(
      { reportId, profileId },
      { onSuccess: () => invalidateCollabs() },
    );
  };

  if (reviewsLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto">
      <Link
        href={`/reports/${reportId}`}
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <ArrowLeft className="h-3 w-3" /> Tillbaka till rapport
      </Link>

      <div className="border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardCheck className="h-7 w-7 text-primary" />
          Granskning &amp; samarbete
        </h1>
        <p className="text-muted-foreground mt-1">
          Spåra granskningsstatus per avsnitt, kommentera och bjud in samarbetspartners.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sections + comments */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Granskningsstatus per avsnitt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(Object.keys(SECTION_LABELS) as ReportSection[]).map((s) => {
                const r = reviews.find((rv) => rv.section === s);
                const status = (r?.status ?? "not_started") as ReviewStatus;
                const isActive = activeSection === s;
                return (
                  <div
                    key={s}
                    className={`border rounded p-3 flex items-center justify-between gap-3 cursor-pointer ${
                      isActive ? "border-primary bg-primary/5" : ""
                    }`}
                    onClick={() => setActiveSection(s)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-medium">{SECTION_LABELS[s]}</span>
                      <Badge variant="secondary" className={STATUS_TONE[status]}>
                        {STATUS_LABELS[status]}
                      </Badge>
                    </div>
                    <Select
                      value={status}
                      onValueChange={(v) => handleStatusChange(s, v as ReviewStatus)}
                    >
                      <SelectTrigger
                        className="w-48"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABELS) as ReviewStatus[]).map((st) => (
                          <SelectItem key={st} value={st}>
                            {STATUS_LABELS[st]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Kommentarer för &quot;{SECTION_LABELS[activeSection]}&quot;
                <Badge variant="secondary">{comments.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Skriv en kommentar..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                <Button
                  onClick={handlePostComment}
                  disabled={createComment.isPending || !newComment.trim()}
                >
                  {createComment.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Inga kommentarer ännu.
                </p>
              ) : (
                <div className="space-y-2">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className={`border rounded p-3 ${c.resolved ? "opacity-60 bg-muted/30" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-muted-foreground mb-1">
                            {c.createdByName ?? "Okänd användare"} ·{" "}
                            {new Date(c.createdAt).toLocaleString("sv-SE")}
                          </div>
                          <div className={`text-sm whitespace-pre-wrap ${c.resolved ? "line-through" : ""}`}>
                            {c.body}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleResolveComment(c)}
                        >
                          {c.resolved ? "Återöppna" : "Markera som åtgärdad"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Collaborators */}
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Samarbetspartners
                <Badge variant="secondary">{collaborators.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {collaborators.map((c) => (
                <div
                  key={c.profileId}
                  className="border rounded p-3 flex items-start justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm flex items-center gap-2 truncate">
                      {c.displayName ?? c.email}
                      {c.isOwner && (
                        <Badge variant="default" className="text-[10px] h-4 px-1.5">
                          <CheckCircle2 className="h-3 w-3 mr-0.5" /> Ägare
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {ROLE_LABELS[c.role]}
                    </Badge>
                  </div>
                  {!c.isOwner && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemove(c.profileId)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}

              <div className="border-t pt-3 space-y-2">
                <Input
                  type="email"
                  placeholder="namn@exempel.se"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as ReportRole)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABELS) as ReportRole[])
                      .filter((r) => r !== "owner")
                      .map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  onClick={handleInvite}
                  disabled={invite.isPending || !inviteEmail.trim()}
                >
                  {invite.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Bjud in
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Användaren behöver redan ha ett konto. Mejlinbjudningar kommer i ett senare steg.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
