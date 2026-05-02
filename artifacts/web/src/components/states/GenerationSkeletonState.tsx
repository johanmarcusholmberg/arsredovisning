import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/hooks/useLanguage";
import { Loader2 } from "lucide-react";

export function GenerationSkeletonState() {
  const { t } = useLanguage();
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-primary">
        <Loader2 className="size-5 animate-spin" />
        <span className="font-medium">{t("state.generation.creating")}</span>
      </div>
      
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-muted/30 p-4 border-b border-border">
          <Skeleton className="h-5 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="p-0">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex justify-between items-center p-4 border-b border-border last:border-0">
              <Skeleton className={`h-4 ${i === 0 || i === 4 ? "w-64 font-bold" : "w-48 ml-4"}`} />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
