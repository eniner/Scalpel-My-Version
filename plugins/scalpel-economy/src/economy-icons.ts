import { defaultPoeItem, getItemIcon } from '@scalpelpoe/plugin-sdk'

/** Resolve a PoE CDN icon for a poe.ninja economy row name. */
export function iconForEntry(name: string): string | null {
  return getItemIcon(defaultPoeItem({ name, baseType: name }, 2))
}
