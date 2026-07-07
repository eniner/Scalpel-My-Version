import { createContext, useContext, type ReactNode } from 'react'

/** React context for the "show currency names instead of icons" setting.
 *  Default is `false` so any subtree without a provider renders icons
 *  (preserves today's behavior if a caller forgets the provider). */
const CurrencyLabelsContext = createContext<boolean>(false)

export function CurrencyLabelsProvider({ value, children }: { value: boolean; children: ReactNode }): JSX.Element {
  return <CurrencyLabelsContext.Provider value={value}>{children}</CurrencyLabelsContext.Provider>
}

export function useCurrencyLabelsAsText(): boolean {
  return useContext(CurrencyLabelsContext)
}
