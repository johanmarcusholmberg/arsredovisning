import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import { track } from "@/lib/track";

interface DemoPdfDownloadProps {
  variant?: "primary" | "outline";
  size?: "sm" | "default" | "lg";
}

// NOTE: The placeholder file lives at artifacts/web/public/arsredovisning-demo.pdf
// and is served from `${BASE_URL}arsredovisning-demo.pdf`. Replace the placeholder
// with the real demo PDF when the export pipeline produces one.
export function DemoPdfDownload({ variant = "primary", size = "default" }: DemoPdfDownloadProps) {
  const { t } = useLanguage();
  const href = `${import.meta.env.BASE_URL}arsredovisning-demo.pdf`;
  return (
    <Button
      asChild
      variant={variant === "outline" ? "outline" : "default"}
      size={size}
      className="gap-2"
      onClick={() => track("demo_open_pdf")}
    >
      <a href={href} download="arsredovisning-demo.pdf">
        <Download className="size-4" />
        {t("publicDemo.cta.downloadPdf")}
      </a>
    </Button>
  );
}
