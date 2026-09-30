import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { dictionaries, LANGUAGES, type Lang } from './dictionaries';

const STORAGE_KEY = 'lang';

function detectInitial(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved && LANGUAGES.some((l) => l.code === saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'en';
  if (nav.startsWith('hi')) return 'hi';
  if (nav.startsWith('mr')) return 'mr';
  return 'en';
}

// Module-level current language so non-component helpers (formatStatus, formatCategory, badges)
// can translate too. The provider remounts its subtree on change, so everything re-renders.
let currentLang: Lang = detectInitial();

export function getLang(): Lang {
  return currentLang;
}

/** Translate a key; falls back to English, then to the key itself. `{name}` placeholders are filled from vars. */
export function tr(key: string, vars?: Record<string, string | number>, lang: Lang = currentLang): string {
  let text = dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.replace(`{${k}}`, String(v));
  return text;
}

/** Translation for an enumerated value (status/priority/category) or null if none exists for this language. */
export function trEnum(kind: 'status' | 'priority' | 'category', value: string): string | null {
  return dictionaries[currentLang][`${kind}.${value}`] ?? null;
}

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(currentLang);

  const setLang = useCallback((l: Lang) => {
    currentLang = l;
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = l;
    setLangState(l);
  }, []);

  const value = useMemo<I18nValue>(() => ({ lang, setLang, t: (key, vars) => tr(key, vars, lang) }), [lang, setLang]);

  React.useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // key={lang} remounts the tree so every component (including those using tr()/formatStatus) re-renders.
  return (
    <I18nContext.Provider value={value}>
      <React.Fragment key={lang}>{children}</React.Fragment>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

/** Compact language picker used in the app bar and on auth pages. */
export function LanguageSwitcher({ className = '', dark = false }: { className?: string; dark?: boolean }) {
  const { lang, setLang, t } = useI18n();
  return (
    <label className={`inline-flex items-center ${className}`}>
      <span className="sr-only">{t('nav.language')}</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label={t('nav.language')}
        className={`rounded-lg border py-1 pl-2 pr-6 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${dark ? 'border-white/30 bg-white/10 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} className="text-slate-900">{l.native}</option>
        ))}
      </select>
    </label>
  );
}
