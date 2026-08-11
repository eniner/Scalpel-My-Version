/** Resolve item/currency/omen icons from Scalpel's published iconMap (+ small fallbacks). */

const FALLBACK_ICONS: Record<string, string> = {
  // Missing from PoE2 ninja export but still used in CoE / Lab crafting.
  'Orb of Alteration':
    'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lSZXJvbGxNYWdpYyIsInNjYWxlIjoxfV0/6308fc8ca2/CurrencyRerollMagic.png',
  'Orb of Scouring':
    'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lDb252ZXJ0VG9Ob3JtYWwiLCJzY2FsZSI6MX1d/a0981d67fe/CurrencyConvertToNormal.png',
}

/** Engine omen id → poe.ninja / iconMap item name. */
export const OMEN_ICON_NAMES: Record<string, string> = {
  dextral_exaltation: 'Omen of Dextral Exaltation',
  sinistral_exaltation: 'Omen of Sinistral Exaltation',
  greater_exaltation: 'Omen of Greater Exaltation',
  homogenising_exaltation: 'Omen of Homogenising Exaltation',
  dextral_erasure: 'Omen of Dextral Erasure',
  sinistral_erasure: 'Omen of Sinistral Erasure',
  whittling: 'Omen of Whittling',
  dextral_annulment: 'Omen of Dextral Annulment',
  sinistral_annulment: 'Omen of Sinistral Annulment',
  greater_annulment: 'Omen of Greater Annulment',
  light: 'Omen of Light',
  dextral_coronation: 'Omen of Dextral Coronation',
  sinistral_coronation: 'Omen of Sinistral Coronation',
  homogenising_coronation: 'Omen of Homogenising Coronation',
  dextral_necromancy: 'Omen of Dextral Necromancy',
  sinistral_necromancy: 'Omen of Sinistral Necromancy',
  abyssal_echoes: 'Omen of Abyssal Echoes',
  liege: 'Omen of the Liege',
  sovereign: 'Omen of the Sovereign',
  blackblooded: 'Omen of the Blackblooded',
  dextral_crystallisation: 'Omen of Dextral Crystallisation',
  sinistral_crystallisation: 'Omen of Sinistral Crystallisation',
}

function hostIconMap(): Record<string, string> {
  const g = (globalThis as unknown as { __scalpel?: { iconMap?: Record<string, string> } }).__scalpel
  return g?.iconMap ?? {}
}

export function lookupItemIcon(name: string | null | undefined): string | null {
  if (!name?.trim()) return null
  const key = name.trim()
  return hostIconMap()[key] ?? FALLBACK_ICONS[key] ?? null
}

export function lookupCurrencyIcon(actionIdOrName: string): string | null {
  const name = actionIdOrName.startsWith('currency:')
    ? actionIdOrName.slice('currency:'.length)
    : actionIdOrName.startsWith('essence:')
      ? actionIdOrName.slice('essence:'.length)
      : actionIdOrName
  return lookupItemIcon(name)
}

export function lookupOmenIcon(omenId: string): string | null {
  return lookupItemIcon(OMEN_ICON_NAMES[omenId] ?? `Omen of ${omenId}`)
}

/** CoE catalog relative path → unused as CDN (SPA); prefer base name lookup. */
export function lookupCatalogIcon(baseName: string, _coeImg?: string): string | null {
  return lookupItemIcon(baseName)
}
