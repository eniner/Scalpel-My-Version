/** poe.ninja economy URL segments / host PriceEntry.category slugs. */
export interface EconomyCategory {
  slug: string
  label: string
}

/** PoE2 — Runes of Aldur (and future leagues that keep the same overview types). */
export const POE2_ECONOMY: EconomyCategory[] = [
  { slug: 'currency', label: 'Currency' },
  { slug: 'fragments', label: 'Fragments' },
  { slug: 'abyssal-bones', label: 'Abyssal Bones' },
  { slug: 'lineage-support-gems', label: 'Lineage Support Gems' },
  { slug: 'essences', label: 'Essences' },
  { slug: 'soul-cores', label: 'Soul Cores' },
  { slug: 'idols', label: 'Idols' },
  { slug: 'runes', label: 'Runes' },
  { slug: 'omens', label: 'Omens' },
  { slug: 'expedition', label: 'Expedition' },
  { slug: 'liquid-emotions', label: 'Liquid Emotions' },
  { slug: 'breach-catalyst', label: 'Breach Catalyst' },
  { slug: 'verisium', label: 'Verisium' },
  { slug: 'unique-weapons', label: 'Unique Weapons' },
  { slug: 'unique-armours', label: 'Unique Armours' },
  { slug: 'unique-accessories', label: 'Unique Accessories' },
  { slug: 'unique-flasks', label: 'Unique Flasks' },
  { slug: 'unique-charms', label: 'Unique Charms' },
  { slug: 'unique-jewels', label: 'Unique Jewels' },
  { slug: 'unique-relics', label: 'Unique Relics' },
  { slug: 'unique-tablets', label: 'Unique Tablets' },
  { slug: 'precursor-tablets', label: 'Precursor Tablets' },
  { slug: 'uncut-gems', label: 'Uncut Gems' },
  { slug: 'unique-maps', label: 'Unique Maps' },
]

/** PoE1 — dense overview categories Scalpel already fetches from poe.ninja. */
export const POE1_ECONOMY: EconomyCategory[] = [
  { slug: 'currency', label: 'Currency' },
  { slug: 'fragments', label: 'Fragments' },
  { slug: 'divination-cards', label: 'Divination Cards' },
  { slug: 'scarabs', label: 'Scarabs' },
  { slug: 'oils', label: 'Oils' },
  { slug: 'essences', label: 'Essences' },
  { slug: 'fossils', label: 'Fossils' },
  { slug: 'resonators', label: 'Resonators' },
  { slug: 'incubators', label: 'Incubators' },
  { slug: 'delirium-orbs', label: 'Delirium Orbs' },
  { slug: 'omens', label: 'Omens' },
  { slug: 'tattoos', label: 'Tattoos' },
  { slug: 'runes', label: 'Runes' },
  { slug: 'artifacts', label: 'Artifacts' },
  { slug: 'allflame-embers', label: 'Allflame Embers' },
  { slug: 'coffins', label: 'Coffins' },
  { slug: 'beasts', label: 'Beasts' },
  { slug: 'skill-gems', label: 'Skill Gems' },
  { slug: 'cluster-jewels', label: 'Cluster Jewels' },
  { slug: 'unique-weapons', label: 'Unique Weapons' },
  { slug: 'unique-armours', label: 'Unique Armours' },
  { slug: 'unique-accessories', label: 'Unique Accessories' },
  { slug: 'unique-flasks', label: 'Unique Flasks' },
  { slug: 'unique-jewels', label: 'Unique Jewels' },
  { slug: 'unique-maps', label: 'Unique Maps' },
  { slug: 'maps', label: 'Maps' },
  { slug: 'invitations', label: 'Invitations' },
  { slug: 'memories', label: 'Memories' },
  { slug: 'vials', label: 'Vials' },
]

/** @deprecated use POE2_ECONOMY — kept for older imports/tests */
export const RUNES_OF_ALDUR_ECONOMY = POE2_ECONOMY

export function economyCategoriesFor(poeVersion: 1 | 2): EconomyCategory[] {
  return poeVersion === 1 ? POE1_ECONOMY : POE2_ECONOMY
}

export function economySlugsFor(poeVersion: 1 | 2): Set<string> {
  return new Set(economyCategoriesFor(poeVersion).map((c) => c.slug))
}

export function categoryLabel(slug: string, poeVersion: 1 | 2 = 2): string {
  return economyCategoriesFor(poeVersion).find((c) => c.slug === slug)?.label ?? slug
}

/** Preferred categories first; append any extra slugs present in live price data. */
export function categoriesWithData(
  poeVersion: 1 | 2,
  presentSlugs: Iterable<string>,
): EconomyCategory[] {
  const preferred = economyCategoriesFor(poeVersion)
  const known = new Set(preferred.map((c) => c.slug))
  const extras: EconomyCategory[] = []
  for (const slug of presentSlugs) {
    if (!slug || known.has(slug)) continue
    known.add(slug)
    extras.push({
      slug,
      label: slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
    })
  }
  return [...preferred, ...extras]
}
