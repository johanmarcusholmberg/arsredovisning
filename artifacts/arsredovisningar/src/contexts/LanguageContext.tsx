import { useEffect, useState, type ReactNode } from "react";
import { strings, type Language, type StringKey } from "@/i18n/strings";
import { LanguageContext } from "./languageContextValue";

const STORAGE_KEY = "lang";

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return "sv";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "sv" || stored === "en") return stored;
  } catch {
    /* ignore — private mode, etc. */
  }
  return "sv";
}

/**
 * Mirrors the LanguageProvider in the marketing artifact so the user sees
 * the same language across both apps. The two apps live on the same origin
 * (different paths), so they share localStorage. We also listen for the
 * `storage` event so a switch in one tab is reflected in the other.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  const setLanguage = (lang: Language) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    setLanguageState(lang);
  };

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      const next = e.newValue;
      if (next === "sv" || next === "en") setLanguageState(next);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const t = (key: StringKey): string =>
    strings[language]?.[key] ?? strings.sv[key] ?? key;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
