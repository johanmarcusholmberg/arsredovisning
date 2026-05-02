import { demoData } from "@/data/demoData";
import { ConfidenceBadge } from "@/components/badges/ConfidenceBadge";
import { ShowSourceAccounts } from "@/components/badges/ShowSourceAccounts";
import { useLanguage } from "@/hooks/useLanguage";

type Confidence = "high" | "medium" | "low";

export function MappingSection() {
  const { t } = useLanguage();
  const { mappedAccounts } = demoData;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{t("demo.mapping.title")}</h2>
        <span className="text-xs text-muted-foreground">
          {mappedAccounts.length} {t("demo.mapping.count")}
        </span>
      </div>

      <p className="text-sm text-muted-foreground">{t("demo.mapping.description")}</p>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">
                {t("demo.mapping.col.account")}
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">
                {t("demo.mapping.col.position")}
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">
                {t("demo.mapping.col.confidence")}
              </th>
            </tr>
          </thead>
          <tbody>
            {mappedAccounts.map((acc, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-mono text-xs text-foreground">{acc.account}</p>
                  <ShowSourceAccounts accounts={[acc.source]} />
                </td>
                <td className="px-4 py-3 text-xs text-foreground">{acc.position}</td>
                <td className="px-4 py-3">
                  <ConfidenceBadge confidence={acc.confidence as Confidence} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
