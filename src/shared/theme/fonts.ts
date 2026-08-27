export interface FontPackage {
  id: string
  name: string
  /** One-line hint shown under the name. */
  blurb: string
  /** Body / chrome (`--font-ui`). */
  ui: string
  /** Loot labels and `font-poe` (`--font-poe`). */
  display: string
  /** Code, regex, numbers (`--font-mono`). */
  mono: string
}

const SYSTEM_UI = "'Segoe UI', system-ui, sans-serif"
const FONTIN = "'Fontin SmallCaps', serif"
const CONSOLAS = "'Consolas', 'Cascadia Code', monospace"
const CASCADIA = "'Cascadia Code', 'Cascadia Mono', Consolas, monospace"

export const DEFAULT_FONT_PACKAGE_ID = 'fontin'

export const FONT_PACKAGES: FontPackage[] = [
  {
    id: 'fontin',
    name: 'Path of Exile',
    blurb: 'Segoe UI body, Fontin on loot',
    ui: SYSTEM_UI,
    display: FONTIN,
    mono: CONSOLAS,
  },
  {
    id: 'exile',
    name: 'Fontin',
    blurb: 'Bundled Fontin SmallCaps everywhere',
    ui: FONTIN,
    display: FONTIN,
    mono: CONSOLAS,
  },
  {
    id: 'windows',
    name: 'Windows',
    blurb: 'Segoe UI + Cascadia Code',
    ui: SYSTEM_UI,
    display: SYSTEM_UI,
    mono: CASCADIA,
  },
  {
    id: 'readable',
    name: 'Readable',
    blurb: 'Verdana — wide, overlay-friendly',
    ui: "Verdana, 'Segoe UI', sans-serif",
    display: "Verdana, 'Segoe UI', sans-serif",
    mono: CONSOLAS,
  },
  {
    id: 'compact',
    name: 'Compact',
    blurb: 'Tahoma — tighter rows',
    ui: "Tahoma, 'Segoe UI', sans-serif",
    display: "Tahoma, 'Segoe UI', sans-serif",
    mono: CONSOLAS,
  },
  {
    id: 'book',
    name: 'Book',
    blurb: 'Georgia serif',
    ui: "Georgia, 'Times New Roman', serif",
    display: "Georgia, 'Times New Roman', serif",
    mono: CONSOLAS,
  },
  {
    id: 'terminal',
    name: 'Terminal',
    blurb: 'Cascadia / Consolas for the whole UI',
    ui: CASCADIA,
    display: CASCADIA,
    mono: CASCADIA,
  },
]

export const FONT_PACKAGES_BY_ID: Record<string, FontPackage> = Object.fromEntries(FONT_PACKAGES.map((p) => [p.id, p]))

export function resolveFontPackage(id: string | undefined | null): FontPackage {
  return FONT_PACKAGES_BY_ID[id ?? ''] ?? FONT_PACKAGES_BY_ID[DEFAULT_FONT_PACKAGE_ID]!
}

export function fontPackageCssVars(pack: FontPackage): Record<string, string> {
  return {
    '--font-ui': pack.ui,
    '--font-poe': pack.display,
    '--font-mono': pack.mono,
  }
}
