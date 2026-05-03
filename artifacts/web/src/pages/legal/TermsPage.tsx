import { useLanguage } from "@/hooks/useLanguage";
import { LegalPageShell } from "./LegalPageShell";

export default function TermsPage() {
  const { t } = useLanguage();
  return (
    <LegalPageShell
      title={t("legal.terms.title")}
      intro={t("legal.terms.intro")}
      sections={[
        { title: t("legal.terms.section1.title"), body: t("legal.terms.section1.body") },
        { title: t("legal.terms.section2.title"), body: t("legal.terms.section2.body") },
        { title: t("legal.terms.section3.title"), body: t("legal.terms.section3.body") },
      ]}
    />
  );
}
