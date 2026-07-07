const SLOT_LABELS: Record<string, string> = {
  Weapon: 'Weapon',
  Weapon1: 'Weapon',
  Weapon2: 'Off-hand weapon',
  Offhand: 'Off-hand',
  Offhand1: 'Off-hand',
  Helm: 'Helmet',
  Helm1: 'Helmet',
  BodyArmour: 'Body armour',
  BodyArmour1: 'Body armour',
  Gloves: 'Gloves',
  Gloves1: 'Gloves',
  Boots: 'Boots',
  Boots1: 'Boots',
  Belt: 'Belt',
  Belt1: 'Belt',
  Amulet: 'Amulet',
  Amulet1: 'Amulet',
  Ring: 'Ring',
  Ring1: 'Ring',
  Ring2: 'Ring 2',
  Charm1: 'Charm',
  Charm2: 'Charm 2',
  Trinket1: 'Charm',
  Trinket2: 'Charm 2',
  Flask1: 'Flask',
  Flask2: 'Flask 2',
}

export function slotLabel(slot: string): string {
  return SLOT_LABELS[slot] ?? slot.replace(/(\d+)$/, ' $1').trim()
}

/** Strip GGG markup tags from .build additional_text */
export function stripBuildMarkup(text: string): string {
  return text
    .replace(/<[^>{}]+>\{([^}]*)\}/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\{([^}]*)\}/g, '$1')
    .trim()
}

/** Sort gear slots in a sensible wear order */
const SLOT_ORDER = [
  'Weapon',
  'Weapon1',
  'Weapon2',
  'Offhand',
  'Offhand1',
  'Helm',
  'Helm1',
  'BodyArmour',
  'BodyArmour1',
  'Gloves',
  'Gloves1',
  'Boots',
  'Boots1',
  'Belt',
  'Belt1',
  'Amulet',
  'Amulet1',
  'Ring',
  'Ring1',
  'Ring2',
  'Charm1',
  'Charm2',
  'Trinket1',
  'Trinket2',
  'Flask1',
  'Flask2',
]

export function compareSlots(a: string, b: string): number {
  const ai = SLOT_ORDER.indexOf(a)
  const bi = SLOT_ORDER.indexOf(b)
  if (ai >= 0 && bi >= 0) return ai - bi
  if (ai >= 0) return -1
  if (bi >= 0) return 1
  return a.localeCompare(b)
}

export function inventoryIdToSlotClass(inventoryId: string): string | undefined {
  const map: Record<string, string> = {
    Helm1: 'Helmets',
    BodyArmour1: 'Body Armours',
    Gloves1: 'Gloves',
    Boots1: 'Boots',
    Belt1: 'Belts',
    Amulet1: 'Amulets',
    Ring1: 'Rings',
    Ring2: 'Rings',
    Offhand1: 'Shields',
    Trinket1: 'Charms',
    Flask1: 'Flasks',
  }
  return map[inventoryId]
}
