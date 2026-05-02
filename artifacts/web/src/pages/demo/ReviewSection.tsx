import { LockedFeatureTooltip } from "@/components/badges/LockedFeatureTooltip";
import { useLanguage } from "@/hooks/useLanguage";
import { MessageSquare, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const placeholderReviews = [
  { id: 1, sectionKey: "demo.sidebar.statements", commentKey: "review.comment.1" },
  { id: 2, sectionKey: "demo.sidebar.notes", commentKey: "review.comment.2" },
  { id: 3, sectionKey: "demo.sidebar.validation", commentKey: "review.comment.3" },
];

const reviewCommentsSv: Record<string, string> = {
  "review.comment.1": "Granskning av resultaträkning och balansräkning",
  "review.comment.2": "Verifiera könsfördelning i styrelse och ledning",
  "review.comment.3": "Åtgärda blockerande valideringsfel innan signering",
};

const reviewCommentsEn: Record<string, string> = {
  "review.comment.1": "Review of income statement and balance sheet",
  "review.comment.2": "Verify gender distribution in board and management",
  "review.comment.3": "Resolve blocking validation errors before signing",
};

export function ReviewSection() {
  const { t, language } = useLanguage();
  const comments = language === "sv" ? reviewCommentsSv : reviewCommentsEn;

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-foreground">{t("demo.review.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("demo.review.notice")}</p>

      <div className="space-y-3">
        {placeholderReviews.map((review) => (
          <LockedFeatureTooltip key={review.id}>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <MessageSquare className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t(review.sectionKey as Parameters<typeof t>[0])}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {comments[review.commentKey]}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {t("review.status.waiting")}
                  </span>
                  <span className="text-xs text-muted-foreground">{t("review.reviewer")}</span>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" disabled className="text-xs">
                  {t("demo.review.add_comment")}
                </Button>
                <Button size="sm" variant="outline" disabled className="text-xs">
                  {t("demo.review.approve")}
                </Button>
              </div>
            </div>
          </LockedFeatureTooltip>
        ))}
      </div>
    </div>
  );
}
