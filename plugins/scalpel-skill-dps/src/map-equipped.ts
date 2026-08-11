/** Strip PoE2 localization tokens: `[a|b]` → `b`, `[a]` → `a`. */
export function stripNinjaTokens(s: string): string {
  return s.replace(/\[([^\]|]+)\|?([^\]]*)\]/g, (_, a: string, b: string) => b || a)
}

export type EquippedModKind =
  | 'implicit'
  | 'explicit'
  | 'enchant'
  | 'fractured'
  | 'desecrated'
  | 'rune'
  | 'crafted'

export type EquippedMod = {
  /** Stable within an item (kind + index + text). */
  id: string
  text: string
  kind: EquippedModKind
}

export type EquippedItem = {
  /** Stable key for React lists. */
  id: string
  /** Display slot label (Helmet, Ring 1, Jewel, …). */
  slotLabel: string
  /** Sort order (weapons first, then armour, jewellery, jewels, flasks). */
  sortOrder: number
  name: string
  baseType: string
  /** PoE item class hint for trade (Helmets, Rings, …); may be empty. */
  itemClass: string
  rarity: 'Normal' | 'Magic' | 'Rare' | 'Unique'
  iconUrl: string | null
  /** All selectable mods from the ninja model (every source). */
  mods: EquippedMod[]
  corrupted: boolean
  /** Raw ninja inventoryId when present. */
  inventoryId: string | null
}

type RawItemData = {
  name?: string
  typeLine?: string
  baseType?: string
  rarity?: string
  frameType?: number
  inventoryId?: string
  icon?: string
  corrupted?: boolean
  implicitMods?: string[]
  explicitMods?: string[]
  enchantMods?: string[]
  fracturedMods?: string[]
  desecratedMods?: string[]
  runeMods?: string[]
  craftedMods?: string[]
}

type RawSlotItem = {
  itemSlot?: number
  itemData?: RawItemData
}

const INV_META: Record<string, { label: string; order: number; itemClass: string }> = {
  Weapon: { label: 'Weapon', order: 10, itemClass: '' },
  Offhand: { label: 'Offhand', order: 20, itemClass: '' },
  Weapon2: { label: 'Weapon 2', order: 30, itemClass: '' },
  Helm: { label: 'Helmet', order: 40, itemClass: 'Helmets' },
  BodyArmour: { label: 'Body Armour', order: 50, itemClass: 'Body Armours' },
  Gloves: { label: 'Gloves', order: 60, itemClass: 'Gloves' },
  Boots: { label: 'Boots', order: 70, itemClass: 'Boots' },
  Amulet: { label: 'Amulet', order: 80, itemClass: 'Amulets' },
  Ring: { label: 'Ring 1', order: 90, itemClass: 'Rings' },
  Ring2: { label: 'Ring 2', order: 100, itemClass: 'Rings' },
  Belt: { label: 'Belt', order: 110, itemClass: 'Belts' },
  PassiveJewels: { label: 'Jewel', order: 200, itemClass: 'Jewels' },
  EquipmentJewels: { label: 'Socket Jewel', order: 210, itemClass: 'Jewels' },
  Flask: { label: 'Flask / Charm', order: 300, itemClass: 'Flasks' },
}

const MOD_SOURCES: Array<{ key: keyof RawItemData; kind: EquippedModKind }> = [
  { key: 'enchantMods', kind: 'enchant' },
  { key: 'implicitMods', kind: 'implicit' },
  { key: 'fracturedMods', kind: 'fractured' },
  { key: 'desecratedMods', kind: 'desecrated' },
  { key: 'runeMods', kind: 'rune' },
  { key: 'craftedMods', kind: 'crafted' },
  { key: 'explicitMods', kind: 'explicit' },
]

function frameToRarity(frameType: number | undefined, rarity: string | undefined): EquippedItem['rarity'] {
  if (typeof rarity === 'string') {
    const r = rarity.trim().toLowerCase()
    if (r === 'unique') return 'Unique'
    if (r === 'rare') return 'Rare'
    if (r === 'magic') return 'Magic'
    if (r === 'normal') return 'Normal'
  }
  switch (frameType) {
    case 3:
      return 'Unique'
    case 2:
      return 'Rare'
    case 1:
      return 'Magic'
    default:
      return 'Normal'
  }
}

function collectMods(d: RawItemData): EquippedMod[] {
  const out: EquippedMod[] = []
  const seen = new Set<string>()
  for (const { key, kind } of MOD_SOURCES) {
    const list = d[key]
    if (!Array.isArray(list)) continue
    list.forEach((raw, i) => {
      if (typeof raw !== 'string' || !raw.trim()) return
      const text = stripNinjaTokens(raw).trim()
      if (!text) return
      const dedupe = `${kind}:${text.toLowerCase()}`
      if (seen.has(dedupe)) return
      seen.add(dedupe)
      out.push({ id: `${kind}-${i}-${text}`, text, kind })
    })
  }
  return out
}

function slotMeta(inventoryId: string | null, baseType: string): { label: string; order: number; itemClass: string } {
  if (inventoryId && INV_META[inventoryId]) {
    const meta = INV_META[inventoryId]
    if (inventoryId === 'Flask' && /charm/i.test(baseType)) {
      return { ...meta, label: 'Charm', itemClass: 'Charms' }
    }
    return meta
  }
  if (/jewel/i.test(baseType)) return INV_META.PassiveJewels
  return { label: inventoryId || 'Item', order: 500, itemClass: '' }
}

function mapSlotItem(raw: RawSlotItem, index: number, prefix: string): EquippedItem | null {
  const d = raw.itemData
  if (!d || typeof d !== 'object') return null
  const baseType = typeof d.baseType === 'string' && d.baseType ? d.baseType : typeof d.typeLine === 'string' ? d.typeLine : ''
  if (!baseType && !d.name) return null
  const inventoryId = typeof d.inventoryId === 'string' ? d.inventoryId : null
  const meta = slotMeta(inventoryId, baseType)
  const rarity = frameToRarity(d.frameType, d.rarity)
  const name =
    rarity === 'Unique' || rarity === 'Rare' || rarity === 'Magic'
      ? typeof d.name === 'string' && d.name
        ? d.name
        : baseType
      : baseType
  const slotNum = typeof raw.itemSlot === 'number' ? raw.itemSlot : index
  return {
    id: `${prefix}-${slotNum}-${inventoryId ?? 'x'}-${name}-${baseType}`,
    slotLabel: meta.label,
    sortOrder: meta.order + slotNum * 0.01,
    name,
    baseType,
    itemClass: meta.itemClass,
    rarity,
    iconUrl: typeof d.icon === 'string' && d.icon ? d.icon : null,
    mods: collectMods(d),
    corrupted: d.corrupted === true,
    inventoryId,
  }
}

function mapList(list: unknown, prefix: string): EquippedItem[] {
  if (!Array.isArray(list)) return []
  const out: EquippedItem[] = []
  list.forEach((raw, i) => {
    const item = mapSlotItem(raw as RawSlotItem, i, prefix)
    if (item) out.push(item)
  })
  return out
}

/** Map ninja charModel items / jewels / flasks into display + trade-ready rows. */
export function mapEquippedGear(charModel: unknown): EquippedItem[] {
  const cm = (charModel ?? {}) as {
    items?: unknown
    jewels?: unknown
    flasks?: unknown
  }
  const gear = [
    ...mapList(cm.items, 'item'),
    ...mapList(cm.jewels, 'jewel'),
    ...mapList(cm.flasks, 'flask'),
  ]
  gear.sort((a, b) => a.sortOrder - b.sortOrder || a.slotLabel.localeCompare(b.slotLabel))
  return gear
}
