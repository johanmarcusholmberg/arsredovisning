import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { LockedFeatureTooltip } from "@/components/badges/LockedFeatureTooltip";
import { useLanguage } from "@/contexts/LanguageContext";

interface CommentReviewCardProps {
  authorName: string;
  comment: string;
  timestamp: string;
  isLocked?: boolean;
}

export function CommentReviewCard({ authorName, comment, timestamp, isLocked = false }: CommentReviewCardProps) {
  const { t } = useLanguage();

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-primary font-medium text-xs">
              {authorName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{authorName}</span>
              <span className="text-xs text-muted-foreground">{timestamp}</span>
            </div>
            <p className="text-sm text-foreground/80">{comment}</p>
            <div className="pt-2 flex gap-2">
              {isLocked ? (
                <LockedFeatureTooltip>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 opacity-50 pointer-events-none">
                      <Check className="size-3" /> {t("card.review.approve")}
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 opacity-50 pointer-events-none">
                      <X className="size-3" /> {t("card.review.reject")}
                    </Button>
                  </div>
                </LockedFeatureTooltip>
              ) : (
                <>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1 hover:bg-green-50 hover:text-green-700 hover:border-green-200">
                    <Check className="size-3" /> {t("card.review.approve")}
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1 hover:bg-red-50 hover:text-red-700 hover:border-red-200">
                    <X className="size-3" /> {t("card.review.reject")}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
