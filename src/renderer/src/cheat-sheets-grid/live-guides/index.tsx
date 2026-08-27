import { BeltonCraftingGuide } from './BeltonCraftingGuide'
import { MirrorRitualGuide } from './MirrorRitualGuide'
import { WaMonkCraftsGuide } from './WaMonkCraftsGuide'

const LIVE: Record<string, () => JSX.Element> = {
  'mirror-ritual': MirrorRitualGuide,
  'belton-wand-craft': BeltonCraftingGuide,
  'wa-monk-crafts': WaMonkCraftsGuide,
}

export function isLiveGuideSlug(slug: string | undefined): boolean {
  return !!slug && slug in LIVE
}

export function LiveGuide({ slug }: { slug: string }): JSX.Element | null {
  const Comp = LIVE[slug]
  return Comp ? <Comp /> : null
}
