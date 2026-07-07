export type GearRarity = 'unique' | 'rare' | 'magic' | 'normal' | 'unknown'

export interface GearEntry {
  /** Stable id for checkbox storage */
  id: string
  slot: string
  slotLabel: string
  /** Display title — unique name or base type */
  title: string
  subtitle?: string
  rarity: GearRarity
  notes?: string
  itemClass?: string
  isUnique: boolean
}

export interface BuildPlan {
  name: string
  author?: string
  source: 'build-file' | 'maxroll'
  sourceLabel: string
  /** Profile / variant groups when importing MaxRoll */
  groups: GearGroup[]
}

export interface GearGroup {
  id: string
  label: string
  entries: GearEntry[]
}

export interface CheckedState {
  [entryId: string]: boolean
}

/** Host extension for GGG BuildPlanner folder access (Scalpel 0.8+). */
export interface BuildPlannerFileEntry {
  filename: string
  name: string
}

export interface BuildPlannerApi {
  list(): Promise<{ path: string; files: BuildPlannerFileEntry[] }>
  read(filename: string): Promise<{ path: string; content: string }>
  openFolder(): Promise<{ path: string }>
}
