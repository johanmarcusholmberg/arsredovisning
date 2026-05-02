import { useState, ReactNode } from "react";
import { strings } from "../i18n/strings";
import {
  LanguageContext,
  type Language,
} from "./languageContextValue";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem("lang");
    return stored === "sv" || stored === "en" ? stored : "sv";
  });

  const setLanguage = (lang: Language) => {
    localStorage.setItem("lang", lang);
    setLanguageState(lang);
  };

  const t = (key: keyof typeof strings.sv): string => {
    return strings[language]?.[key] ?? strings.sv[key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
