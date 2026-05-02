import React, { createContext, useContext, useState, ReactNode } from "react";
import { strings } from "../i18n/strings";

type Language = "sv" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof strings.sv) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

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

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
