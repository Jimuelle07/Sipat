import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import type { UiLanguage } from '../../engine';
import { useEngine } from '../context/useEngine';

export type Lang = UiLanguage;
export function defineStrings<T extends Record<string, string>>(s: { tl: T; en: { [K in keyof T]: string } }): { tl: T; en: Record<keyof T, string> } {
  return s;
}

interface LangContextValue { lang: Lang; setLang: (lang: Lang) => void }
const LanguageContext = createContext<LangContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }): JSX.Element {
  const engine = useEngine();
  const [lang, setLanguage] = useState<Lang>(() => engine.settings.get().language ?? 'tl');
  useEffect(() => engine.onChange((change) => {
    if (change === 'settings') setLanguage(engine.settings.get().language ?? 'tl');
  }), [engine]);
  const value = useMemo<LangContextValue>(() => ({
    lang,
    setLang: (next) => {
      const result = engine.settings.update({ language: next });
      if (result.ok) setLanguage(next);
    },
  }), [engine, lang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang(): LangContextValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLang must be used inside LanguageProvider');
  return value;
}

export function useT<T extends Record<string, string>>(table: { tl: T; en: Record<keyof T, string> }): Record<keyof T, string> {
  const { lang } = useLang();
  return table[lang];
}
