import { ReactNode } from "react";
import { FileQuestion, AlertCircle, Inbox, Database, LayoutDashboard, History, Users, CheckSquare, BarChart, Table, FileText } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

const iconMap = {
  file: FileQuestion,
  alert: AlertCircle,
  inbox: Inbox,
  database: Database,
  dashboard: LayoutDashboard,
  history: History,
  users: Users,
  check: CheckSquare,
  chart: BarChart,
  table: Table,
  note: FileText
};

interface EmptyStateProps {
  icon?: keyof typeof iconMap;
  titleSv: string;
  titleEn: string;
  descSv: string;
  descEn: string;
  action?: ReactNode;
}

export function EmptyState({ icon = "inbox", titleSv, titleEn, descSv, descEn, action }: EmptyStateProps) {
  const { language } = useLanguage();
  const Icon = iconMap[icon];
  
  const title = language === "en" ? titleEn : titleSv;
  const desc = language === "en" ? descEn : descSv;

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-border rounded-lg bg-muted/10 min-h-[200px]">
      <div className="rounded-full bg-muted p-3 mb-4">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">{desc}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
