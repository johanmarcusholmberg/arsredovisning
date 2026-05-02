import { demoData } from "@/data/demoData";
import { AlertTriangle, XCircle } from "lucide-react";
import { NoteReferenceBadge } from "@/components/badges/NoteReferenceBadge";
import { useLanguage } from "@/contexts/LanguageContext";

export function ValidationSection() {
  const { t } = useLanguage();
  const { validation } = demoData;
  const warningCount = validation.filter((v) => v.severity === "warning").length;
  const errorCount = validation.filter((v) => v.severity === "error").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{t("demo.validation.title")}</h2>
        <div className="flex gap-2">
          <span className="text-xs rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-amber-700">
            {warningCount} {t("demo.validation.warning")}
          </span>
          <span className="text-xs rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-red-700">
            {errorCount} {t("demo.validation.error")}
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{t("demo.validation.notice")}</p>

      <div className="space-y-3">
        {validation.map((item) => {
          const isError = item.severity === "error";
          return (
            <div
              key={item.code}
              className={`rounded-xl border p-4 ${
                isError ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
              }`}
            >
              <div className="flex items-start gap-3">
                {isError ? (
                  <XCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${isError ? "text-red-800" : "text-amber-800"}`}>
                      {item.message}
                    </span>
                    <span className={`text-xs font-mono rounded px-1.5 py-0.5 ${
                      isError ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                    }`}>
                      {item.code}
                    </span>
                    {item.noteRef && <NoteReferenceBadge noteNumber={item.noteRef} />}
                  </div>
                  <p className={`text-xs mt-1 leading-relaxed ${isError ? "text-red-700" : "text-amber-700"}`}>
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {errorCount > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-800">
            {errorCount} {t("demo.validation.blocking")}
          </p>
        </div>
      )}
    </div>
  );
}
