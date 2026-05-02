import { useLanguage } from "@/hooks/useLanguage";
import { CheckCircle2, Clock, AlertTriangle, XCircle, FileEdit } from "lucide-react";

type Status = "draft" | "done" | "warning" | "error" | "in_progress";

const configs: Record<Status, { icon: typeof CheckCircle2; bg: string; text: string; border: string }> = {
  draft: { icon: FileEdit, bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200" },
  done: { icon: CheckCircle2, bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  warning: { icon: AlertTriangle, bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  error: { icon: XCircle, bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  in_progress: { icon: Clock, bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
};

export function StatusBadge({ status }: { status: Status }) {
  const { t } = useLanguage();
  const { icon: Icon, bg, text, border } = configs[status];
  const labelKey = `status.${status}` as Parameters<typeof t>[0];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${bg} ${text} ${border}`}>
      <Icon className="size-3" />
      {t(labelKey)}
    </span>
  );
}
