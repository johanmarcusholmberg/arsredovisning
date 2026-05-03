import { useLanguage } from "@/hooks/useLanguage";
import { LegalPageShell } from "./LegalPageShell";

export default function PrivacyPage() {
  const { t } = useLanguage();
  return (
    <LegalPageShell
      title={t("legal.privacy.title")}
      intro={t("legal.privacy.intro")}
      sections={[
        { title: t("legal.privacy.section1.title"), body: t("legal.privacy.section1.body") },
        { title: t("legal.privacy.section2.title"), body: t("legal.privacy.section2.body") },
        { title: t("legal.privacy.section3.title"), body: t("legal.privacy.section3.body") },
      ]}
    />
  );
}
