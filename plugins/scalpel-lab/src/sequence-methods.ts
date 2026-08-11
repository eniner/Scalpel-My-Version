/** Full CoE-style method palette for Sequence (orbs + bones; essences/catalysts filled at runtime). */
export const BASE_METHODS: Array<{ id: string; label: string; group: string }> = [
  { id: 'currency:Orb of Transmutation', label: 'Orb of Transmutation', group: 'Magic' },
  { id: 'currency:Greater Orb of Transmutation', label: 'Greater Orb of Transmutation', group: 'Magic' },
  { id: 'currency:Perfect Orb of Transmutation', label: 'Perfect Orb of Transmutation', group: 'Magic' },
  { id: 'currency:Orb of Augmentation', label: 'Orb of Augmentation', group: 'Magic' },
  { id: 'currency:Greater Orb of Augmentation', label: 'Greater Orb of Augmentation', group: 'Magic' },
  { id: 'currency:Perfect Orb of Augmentation', label: 'Perfect Orb of Augmentation', group: 'Magic' },
  { id: 'currency:Orb of Alteration', label: 'Orb of Alteration', group: 'Magic' },
  { id: 'currency:Regal Orb', label: 'Regal Orb', group: 'Rare' },
  { id: 'currency:Greater Regal Orb', label: 'Greater Regal Orb', group: 'Rare' },
  { id: 'currency:Perfect Regal Orb', label: 'Perfect Regal Orb', group: 'Rare' },
  { id: 'currency:Orb of Alchemy', label: 'Orb of Alchemy', group: 'Rare' },
  { id: 'currency:Chaos Orb', label: 'Chaos Orb', group: 'Rare' },
  { id: 'currency:Greater Chaos Orb', label: 'Greater Chaos Orb', group: 'Rare' },
  { id: 'currency:Perfect Chaos Orb', label: 'Perfect Chaos Orb', group: 'Rare' },
  { id: 'currency:Exalted Orb', label: 'Exalted Orb', group: 'Rare' },
  { id: 'currency:Greater Exalted Orb', label: 'Greater Exalted Orb', group: 'Rare' },
  { id: 'currency:Perfect Exalted Orb', label: 'Perfect Exalted Orb', group: 'Rare' },
  { id: 'currency:Orb of Annulment', label: 'Orb of Annulment', group: 'Rare' },
  { id: 'currency:Orb of Scouring', label: 'Orb of Scouring', group: 'Utility' },
  { id: 'currency:Divine Orb', label: 'Divine Orb', group: 'Utility' },
  { id: 'currency:Fracturing Orb', label: 'Fracturing Orb', group: 'Utility' },
  { id: 'currency:Vaal Orb', label: 'Vaal Orb', group: 'Utility' },
  { id: "currency:Artificer's Orb", label: "Artificer's Orb", group: 'Utility' },
]

export const BONE_METHODS: Array<{ id: string; label: string; group: string }> = [
  { id: 'desecration:ancient_collarbone', label: 'Ancient Collarbone', group: 'Desecration' },
  { id: 'desecration:ancient_jawbone', label: 'Ancient Jawbone', group: 'Desecration' },
  { id: 'desecration:ancient_ribs', label: 'Ancient Rib', group: 'Desecration' },
  { id: 'desecration:gnawed_collarbone', label: 'Gnawed Collarbone', group: 'Desecration' },
  { id: 'desecration:gnawed_jawbone', label: 'Gnawed Jawbone', group: 'Desecration' },
  { id: 'desecration:gnawed_ribs', label: 'Gnawed Rib', group: 'Desecration' },
  { id: 'desecration:preserved_collarbone', label: 'Preserved Collarbone', group: 'Desecration' },
  { id: 'desecration:preserved_cranium', label: 'Preserved Cranium', group: 'Desecration' },
  { id: 'desecration:preserved_jawbone', label: 'Preserved Jawbone', group: 'Desecration' },
  { id: 'desecration:preserved_ribs', label: 'Preserved Rib', group: 'Desecration' },
]

export function catalystMethods(names: string[]): Array<{ id: string; label: string; group: string }> {
  return names.map((n) => ({ id: `currency:${n}`, label: n, group: 'Catalyst' }))
}

export function essenceMethods(names: string[]): Array<{ id: string; label: string; group: string }> {
  return names
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .map((n) => ({ id: `currency:${n}`, label: n, group: 'Essence' }))
}

export function socketableMethods(
  entries: Array<{ id: string; label: string; stype?: string }>,
): Array<{ id: string; label: string; group: string }> {
  return entries
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((e) => ({
      id: e.id.startsWith('socketable:') ? e.id : `socketable:${e.id}`,
      label: e.label,
      group: e.stype === 'soulcore' ? 'Soul Core' : e.stype === 'talisman' ? 'Talisman' : 'Rune',
    }))
}

export const RECIPE_STORAGE_KEY = 'scalpel-lab:sequence-recipes'

export interface SavedRecipe {
  id: string
  name: string
  savedAt: number
  steps: unknown[]
  catalyst?: string
  omens?: string[]
  targetQuery?: string
}

export function loadRecipes(): SavedRecipe[] {
  try {
    const raw = localStorage.getItem(RECIPE_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedRecipe[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveRecipe(recipe: SavedRecipe): void {
  const all = loadRecipes().filter((r) => r.id !== recipe.id)
  all.unshift(recipe)
  localStorage.setItem(RECIPE_STORAGE_KEY, JSON.stringify(all.slice(0, 40)))
}

export function deleteRecipe(id: string): void {
  localStorage.setItem(RECIPE_STORAGE_KEY, JSON.stringify(loadRecipes().filter((r) => r.id !== id)))
}
