import { useLanguage } from "@/hooks/useLanguage";
import { LegalPageShell } from "./LegalPageShell";

export default function SupportPage() {
  const { t } = useLanguage();
  return (
    <LegalPageShell
      title={t("legal.support.title")}
      intro={t("legal.support.intro")}
      sections={[
        { title: t("legal.support.section1.title"), body: t("legal.support.section1.body") },
        { title: t("legal.support.section2.title"), body: t("legal.support.section2.body") },
        { title: t("legal.support.section3.title"), body: t("legal.support.section3.body") },
      ]}
    />
  );
}
