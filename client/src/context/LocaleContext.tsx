import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { translations, type Locale } from '../data/locales'

interface LocaleContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem('scamshield-lang')
    return (saved === 'bm' ? 'bm' : 'en') as Locale
  })

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    localStorage.setItem('scamshield-lang', l)
  }, [])

  const t = useCallback((key: string): string => {
    return translations[locale][key] ?? translations.en[key] ?? key
  }, [locale])

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}
