export interface Label {
  y: number
  text: string
  top: boolean
}

export interface Diag {
  loading: boolean
  note: string | null
  phase?: string
  updatedAt?: number | null
  debug?: string | null
}

export interface Fire {
  token: string
  open: boolean
  items: Label[]
  diag: Diag
}

export type ScanOutcome = 'busy' | 'toggled-off' | 'no-focus' | 'done'
