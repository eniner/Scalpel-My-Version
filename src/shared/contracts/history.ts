export interface HistoryEntry {
  id: number
  timestamp: number
  description: string
  action: 'block-edit' | 'tier-move' | 'stack-threshold' | 'strand-threshold'
  itemName?: string
  /** NeverSink $type path when the edit was section-scoped */
  typePath?: string
}

export interface FilterChange {
  id: string
  description: string
  itemName?: string
  timestamp: number
  typePath?: string
  tier?: string
  intentType?: string
}

export interface FilterVersion {
  filename: string
  timestamp: number
  isCheckpoint: boolean
  label?: string
  filterName?: string
}
