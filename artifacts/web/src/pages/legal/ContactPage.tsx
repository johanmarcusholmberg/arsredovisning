import { useLanguage } from "@/hooks/useLanguage";
import { LegalPageShell } from "./LegalPageShell";

export default function ContactPage() {
  const { t } = useLanguage();
  return (
    <LegalPageShell
      title={t("legal.contact.title")}
      intro={t("legal.contact.intro")}
      sections={[
        { title: t("legal.contact.section1.title"), body: t("legal.contact.section1.body") },
        { title: t("legal.contact.section2.title"), body: t("legal.contact.section2.body") },
        { title: t("legal.contact.section3.title"), body: t("legal.contact.section3.body") },
      ]}
    />
  );
}
