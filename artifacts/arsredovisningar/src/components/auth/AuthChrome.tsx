import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import type { Language } from "@/i18n/strings";

/** Top-left "back to marketing homepage" anchor. Uses a plain <a>, not a
 *  wouter <Link>, because the homepage lives in a different artifact at "/". */
export function BackToHomepageLink() {
  const { t } = useLanguage();
  return (
    <a
      href="/"
      className="absolute top-4 left-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      {t("common.back_to_homepage")}
    </a>
  );
}

/** Compact language switcher for the top-right of auth pages. Lets users
 *  flip language without going back to the marketing site. The choice is
 *  persisted in the same `lang` localStorage key the marketing app uses,
 *  so the selection follows the user back home. */
export function AuthLanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div className="absolute top-4 right-4">
      <label className="sr-only" htmlFor="auth-language">
        {t("common.language")}
      </label>
      <select
        id="auth-language"
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        className="h-8 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="sv">{t("common.language.sv")}</option>
        <option value="en">{t("common.language.en")}</option>
      </select>
    </div>
  );
}
