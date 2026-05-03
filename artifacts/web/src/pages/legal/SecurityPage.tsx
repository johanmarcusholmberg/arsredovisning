import { useLanguage } from "@/hooks/useLanguage";
import { LegalPageShell } from "./LegalPageShell";

export default function SecurityPage() {
  const { t } = useLanguage();
  return (
    <LegalPageShell
      title={t("legal.security.title")}
      intro={t("legal.security.intro")}
      sections={[
        { title: t("legal.security.section1.title"), body: t("legal.security.section1.body") },
        { title: t("legal.security.section2.title"), body: t("legal.security.section2.body") },
        { title: t("legal.security.section3.title"), body: t("legal.security.section3.body") },
      ]}
    />
  );
}
