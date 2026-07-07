export type GenKind = 'p' | 's'

export interface CraftMod {
  id: string
  g: string
  /** All bind groups (CoE modgroups); blocks any on item. */
  bg?: string[]
  k: GenKind
  l: number
  n: string
  t: string
  w: Array<[string, number]>
  gw?: Array<[string, number]>
  a?: string[]
  /** CoE mgroup 10 — desecration pool. */
  desecrated?: boolean
  /** CoE rune pool (marksman) — only when marksmanEnabled on item. */
  pool?: 'marksman'
}

export interface CraftBase {
  tags: string[]
  c: string
  coeId?: string
  /** CoE base group id (jewellery, weapons, etc.). */
  bgroup?: string
}

export interface CraftCurrencyEntry {
  name: string
  desc: string
  lvl: number
  cat: string
  /** CoE essence id when cat === essence */
  essenceId?: string
  /** Minimum ilvl for tier pool (Greater/Perfect orbs). */
  tierFloor?: number
}

export interface CraftEssenceForcedMod {
  modId: string
  ilvl: number
  group: string
  kind: GenKind
  text: string
  name: string
  minIlvl: number
}

export interface CraftEssenceEntry {
  id: string
  name: string
  lvl: number
  desc: string
  bases: Record<string, CraftEssenceForcedMod>
}

export interface CraftDataset {
  schemaVersion: number
  /** `coe` = Craft of Exile per-base weightings; `repoe` = RePoE tag weights. */
  source?: 'coe' | 'repoe'
  mods: CraftMod[]
  /** Marksman rune pool (CoE pseudo bases 27/200) — requires marksman belt implicit. */
  marksmanMods?: CraftMod[]
  bases: Record<string, CraftBase>
  /** @deprecated use currencies */
  essences?: CraftEssenceEntry[]
  currencies: CraftCurrencyEntry[]
}

export interface CraftItemMod {
  group: string
  kind: GenKind
  text: string
  name?: string
  bindGroups?: string[]
  desecrated?: boolean
  veiled?: boolean
  fractured?: boolean
  /** Rolled from marksman rune pool (belt/quiver implicit). */
  pool?: 'marksman'
}

export interface DesecrationRevealChoice {
  mods: CraftItemMod[]
  rerollsLeft: number
  veiledKind: GenKind
}

export interface CraftItemState {
  baseType: string
  itemLevel: number
  rarity: 'Normal' | 'Magic' | 'Rare' | 'Unique'
  tags: string[]
  itemClass: string
  corrupted: boolean
  mods: CraftItemMod[]
  /** Inventory omens active until consumed by a craft. */
  activeOmens?: string[]
  /** Pending desecration reveal (veiled slot on item). */
  revealChoices?: DesecrationRevealChoice
  /** Simulate wearing a belt/quiver with "Can roll Marksman modifiers". */
  marksmanEnabled?: boolean
}

export interface CraftApplyOptions {
  omens?: string[]
  /** Pick index when resolving desecration:reveal. */
  pickIndex?: number
  /** Reroll desecration choices instead of picking. */
  rerollReveal?: boolean
}

/** Optional context when resolving PoeItem → craft state (worn belt/quiver marksman). */
export interface CraftResolveOpts {
  marksmanEnabled?: boolean
}

export type CraftActionId = string

export interface CraftAction {
  id: CraftActionId
  label: string
  description: string
  applies: boolean
  reason?: string
  simKey?: string
  category?: string
}

export interface CraftOutcome {
  id?: string
  tierName?: string
  text: string
  group: string
  kind: GenKind
  probability: number
  /** Raw spawn weight before normalization (mod pool / cheat sheet). */
  weight?: number
  /** Sum of tier weights in this mod group. */
  groupWeight?: number
  ilvl?: number
  /** Chance to roll this mod group (group-first model). */
  groupChance?: number
  /** Chance of this tier within its group. */
  tierChance?: number
  /** CoE table this tier came from. */
  pool?: 'craft' | 'marksman' | 'desecrated'
}

export interface CraftApplyResult {
  ok: boolean
  state: CraftItemState
  actionId: string
  label: string
  message: string
  added?: CraftItemMod[]
  removed?: CraftItemMod[]
  error?: string
  /** Desecration choices awaiting player pick. */
  revealChoices?: DesecrationRevealChoice
  /** Omens consumed by this action. */
  consumedOmens?: string[]
}

export interface CraftPathStep {
  actionId: string
  omens?: string[]
  /** Repeat this step until target mod appears (e.g. alt spam). */
  repeatUntilHit?: boolean
}

export interface CraftPathQuery {
  state: CraftItemState
  steps: CraftPathStep[]
  targetQuery: string
  kind?: 'all' | 'p' | 's'
  maxTrials?: number
  samples?: number
}

export interface CraftPathResult {
  targetQuery: string
  hitRate: number
  expectedAttempts: number | null
  attemptsTable: Array<{ attempts: number; probability: number }>
  steps: CraftPathStep[]
  samples: number
  note: string
}

export interface CraftSimulationResult {
  actionId: string
  label: string
  samples: number
  modCountChances?: Array<{ count: number; probability: number }>
  outcomes: CraftOutcome[]
  note?: string
}

export interface CraftEngineOptions {
  maxPrefix?: number
  maxSuffix?: number
  maxMods?: number
  modCountWeights?: Array<[number, number]>
  samples?: number
}
