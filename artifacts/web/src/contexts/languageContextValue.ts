import { createContext } from "react";
import { strings } from "../i18n/strings";

export type Language = "sv" | "en";

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof strings.sv) => string;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);
