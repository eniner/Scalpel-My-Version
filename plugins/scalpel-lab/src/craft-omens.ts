import { OMEN_ICON_NAMES } from './item-icon'

/** Omens toggles shared by Simulator + Emulator (ids match host craft engine). */
export const LAB_OMENS = [
  { id: 'dextral_exaltation', label: 'Dextral Exalt' },
  { id: 'sinistral_exaltation', label: 'Sinistral Exalt' },
  { id: 'greater_exaltation', label: 'Greater Exalt' },
  { id: 'homogenising_exaltation', label: 'Homogenising Exalt' },
  { id: 'dextral_erasure', label: 'Dextral Erasure' },
  { id: 'sinistral_erasure', label: 'Sinistral Erasure' },
  { id: 'whittling', label: 'Whittling' },
  { id: 'dextral_annulment', label: 'Dextral Annul' },
  { id: 'sinistral_annulment', label: 'Sinistral Annul' },
  { id: 'greater_annulment', label: 'Greater Annul' },
  { id: 'light', label: 'Light' },
  { id: 'dextral_coronation', label: 'Dextral Regal' },
  { id: 'sinistral_coronation', label: 'Sinistral Regal' },
  { id: 'homogenising_coronation', label: 'Homogenising Regal' },
  { id: 'dextral_necromancy', label: 'Dextral Necro' },
  { id: 'sinistral_necromancy', label: 'Sinistral Necro' },
  { id: 'abyssal_echoes', label: 'Abyssal Echoes' },
  { id: 'liege', label: 'Liege (Amanamu)' },
  { id: 'sovereign', label: 'Sovereign (Ulaman)' },
  { id: 'blackblooded', label: 'Blackblooded (Kurgal)' },
  { id: 'dextral_crystallisation', label: 'Dextral Crystal' },
  { id: 'sinistral_crystallisation', label: 'Sinistral Crystal' },
] as const

export function omenIconName(id: string): string {
  return OMEN_ICON_NAMES[id] ?? id
}
