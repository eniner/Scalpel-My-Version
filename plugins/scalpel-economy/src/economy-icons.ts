import type { PriceEntry } from '@scalpelpoe/plugin-sdk'
import { defaultPoeItem, getItemIcon } from '@scalpelpoe/plugin-sdk'

/** Expand Title-Case artifacts ("Scarab Of X") into sheet keys ("Scarab of X"). */
function nameVariants(name: string): string[] {
  if (!name) return []
  const out = [name]
  const soft = name.replace(/(?<=\S\s)(Of|The|And|A|An)\b/g, (m) => m.toLowerCase())
  if (soft !== name) out.push(soft)
  const foulborn = name.replace(/^(Foulborn|Imbued) /, '')
  if (foulborn !== name) out.push(foulborn, ...nameVariants(foulborn).filter((v) => v !== foulborn))
  return [...new Set(out)]
}

/** Resolve a PoE CDN icon for a poe.ninja economy row. Prefer the icon attached
 *  to the price snapshot; fall back to Scalpel's live iconMap / div-card art. */
export function iconForEntry(entry: PriceEntry | string, poeVersion: 1 | 2 = 2): string | null {
  if (typeof entry !== 'string' && entry.icon) return entry.icon

  const name = typeof entry === 'string' ? entry : entry.name
  const category = typeof entry === 'string' ? '' : entry.category || ''
  const isDivCard = category === 'divination-cards'

  for (const n of nameVariants(name)) {
    try {
      const icon = getItemIcon(
        defaultPoeItem(
          {
            name: n,
            baseType: n,
            itemClass: isDivCard ? 'Divination Cards' : undefined,
          },
          poeVersion,
        ),
      )
      if (icon) return icon
    } catch {
      // Host may not expose getItemIcon yet
    }
  }
  return null
}
