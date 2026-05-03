import { createContext } from "react";
import type { Language, StringKey } from "@/i18n/strings";

export interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: StringKey) => string;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);
