import type { CraftItemStateResult } from '@scalpelpoe/plugin-sdk'
import type { PoeItem } from '@scalpelpoe/plugin-sdk'
import {
  type CraftBuildContext,
  EMPTY_BUILD_CONTEXT,
  itemHasMarksmanImplicit,
  resolveMarksmanEnabled,
} from './craft-build-context'

export { itemHasMarksmanImplicit, resolveMarksmanEnabled } from './craft-build-context'

export function craftStateToPoeItem(state: CraftItemStateResult): PoeItem {
  return {
    itemClass: state.itemClass,
    rarity: state.rarity,
    name: state.baseType,
    baseType: state.baseType,
    mapTier: 0,
    itemLevel: state.itemLevel,
    quality: 0,
    sockets: '',
    linkedSockets: 0,
    armour: 0,
    evasion: 0,
    energyShield: 0,
    ward: 0,
    block: 0,
    reqStr: 0,
    reqDex: 0,
    reqInt: 0,
    corrupted: state.corrupted,
    identified: true,
    mirrored: false,
    synthesised: false,
    fractured: false,
    transfigured: false,
    blighted: false,
    zanaMemory: false,
    implicitCount: 0,
    gemLevel: 0,
    stackSize: 1,
    influence: [],
    explicits: state.mods.filter((m) => !m.veiled).map((m) => m.text),
    implicits: [],
    enchants: [],
    imbues: [],
    advancedMods: state.mods
      .filter((m) => !m.veiled)
      .map((m) => ({
        type: m.kind === 'p' ? 'prefix' : 'suffix',
        name: m.name ?? m.group,
        lines: [m.text],
      })),
  } as PoeItem
}

export function poeItemToCraftState(
  item: PoeItem,
  buildContext: CraftBuildContext = EMPTY_BUILD_CONTEXT,
): CraftItemStateResult {
  const mods =
    item.advancedMods
      ?.filter((m) => m.type === 'prefix' || m.type === 'suffix')
      .map((m) => ({
        group: m.name,
        kind: m.type === 'prefix' ? ('p' as const) : ('s' as const),
        text: m.lines[0] ?? '',
        name: m.name,
      })) ?? []
  return {
    baseType: item.baseType,
    itemLevel: item.itemLevel,
    rarity: item.rarity as CraftItemStateResult['rarity'],
    tags: [item.baseType],
    itemClass: item.itemClass,
    corrupted: item.corrupted,
    mods,
    marksmanEnabled: resolveMarksmanEnabled(item, buildContext),
  }
}
