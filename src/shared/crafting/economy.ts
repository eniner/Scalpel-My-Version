import { DESECRATION_BONES } from './desecration'
import type { CraftDataset } from './types'

/** Fallback relative chaos costs when CoE/ninja prices are missing. */
const DEFAULT_CHAOS: Record<string, number> = {
  'Orb of Transmutation': 0.05,
  'Greater Orb of Transmutation': 0.2,
  'Perfect Orb of Transmutation': 1,
  'Orb of Augmentation': 0.05,
  'Greater Orb of Augmentation': 0.2,
  'Perfect Orb of Augmentation': 1,
  'Orb of Alteration': 0.1,
  'Regal Orb': 0.5,
  'Greater Regal Orb': 2,
  'Perfect Regal Orb': 8,
  'Orb of Alchemy': 0.2,
  'Chaos Orb': 1,
  'Greater Chaos Orb': 4,
  'Perfect Chaos Orb': 15,
  'Exalted Orb': 8,
  'Greater Exalted Orb': 25,
  'Perfect Exalted Orb': 80,
  'Orb of Annulment': 3,
  'Orb of Scouring': 0.15,
  'Divine Orb': 20,
  'Fracturing Orb': 40,
  'Vaal Orb': 0.5,
  "Artificer's Orb": 0.3,
}

const BONE_NAME_BY_ID = Object.fromEntries(DESECRATION_BONES.map((b) => [b.id, b.name]))

export function currencyNameFromActionId(actionId: string, data?: CraftDataset): string {
  if (actionId.startsWith('currency:')) return actionId.slice('currency:'.length)
  if (actionId.startsWith('essence:')) return actionId.slice('essence:'.length)
  if (actionId.startsWith('desecration:')) {
    const id = actionId.slice('desecration:'.length)
    if (id === 'reveal') return 'Desecration Reveal'
    return BONE_NAME_BY_ID[id] ?? id.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }
  if (actionId.startsWith('socketable:')) {
    const id = actionId.slice('socketable:'.length)
    return data?.socketables?.find((s) => s.id === id)?.name ?? id
  }
  return actionId
}

/** Merge baked CoE prices + optional live overrides + defaults. */
export function resolveChaosPriceTable(
  data?: CraftDataset,
  overrides?: Record<string, number>,
): Record<string, number> {
  return {
    ...DEFAULT_CHAOS,
    ...(data?.chaosPrices ?? {}),
    ...(overrides ?? {}),
  }
}

export function chaosCostForAction(
  actionId: string,
  overrides?: Record<string, number>,
  data?: CraftDataset,
): number {
  const name = currencyNameFromActionId(actionId, data)
  const table = resolveChaosPriceTable(data, overrides)
  if (table[name] != null) return table[name]
  if (name.toLowerCase().includes('essence')) return table['Essence'] ?? 2
  if (actionId.startsWith('desecration:')) return 1.5
  if (actionId.startsWith('socketable:')) return 0.5
  return 0.25
}

export function estimateChaosCost(
  appliesByAction: Record<string, number>,
  overrides?: Record<string, number>,
  data?: CraftDataset,
): {
  totalChaos: number
  lines: Array<{ actionId: string; name: string; applies: number; unitChaos: number; chaos: number }>
} {
  const lines = Object.entries(appliesByAction)
    .filter(([, n]) => n > 0)
    .map(([actionId, applies]) => {
      const unitChaos = chaosCostForAction(actionId, overrides, data)
      return {
        actionId,
        name: currencyNameFromActionId(actionId, data),
        applies,
        unitChaos,
        chaos: applies * unitChaos,
      }
    })
    .sort((a, b) => b.chaos - a.chaos)
  return { totalChaos: lines.reduce((s, l) => s + l.chaos, 0), lines }
}
