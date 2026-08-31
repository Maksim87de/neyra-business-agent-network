import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Locale, Translations } from "./types";
import { ru } from "./ru";

const STORAGE_KEY = "neyra-locale";

function getInitialLocale(): Locale {
  try {
    localStorage.setItem(STORAGE_KEY, "ru");
  } catch {
    // SSR or privacy mode
  }
  return "ru";
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "ru",
  setLocale: () => {},
  t: ru,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((_l: Locale) => {
    setLocaleState("ru");
    try {
      localStorage.setItem(STORAGE_KEY, "ru");
    } catch {
      // ignore
    }
  }, []);

  const value: I18nContextValue = {
    locale,
    setLocale,
    t: ru,
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
