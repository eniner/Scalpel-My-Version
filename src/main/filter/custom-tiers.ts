import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { CustomTier } from '@shared/types'
import { injectCustomTiers, sanitizeTierId, sanitizeTypePath } from './custom-tier-inject'

export interface CustomTierLog {
  filterPath: string
  tiers: CustomTier[]
}

function dir(): string {
  const d = join(app.getPath('userData'), 'custom-tiers')
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

function fileFor(filterPath: string): string {
  return join(dir(), `${createHash('md5').update(filterPath).digest('hex')}.json`)
}

export function loadCustomTiers(filterPath: string): CustomTierLog {
  const filePath = fileFor(filterPath)
  if (!existsSync(filePath)) return { filterPath, tiers: [] }
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8')) as CustomTierLog
    return { filterPath, tiers: Array.isArray(data.tiers) ? data.tiers : [] }
  } catch {
    return { filterPath, tiers: [] }
  }
}

export function saveCustomTiers(filterPath: string, tiers: CustomTier[]): CustomTierLog {
  const log: CustomTierLog = { filterPath, tiers }
  writeFileSync(fileFor(filterPath), JSON.stringify(log, null, 2), 'utf-8')
  return log
}

export function clearCustomTiers(filterPath: string): void {
  const filePath = fileFor(filterPath)
  if (existsSync(filePath)) unlinkSync(filePath)
}

export function upsertCustomTier(filterPath: string, input: CustomTier): CustomTierLog {
  const id = sanitizeTierId(input.id)
  const next: CustomTier = {
    id,
    typePath: sanitizeTypePath(input.typePath),
    visibility: input.visibility === 'Hide' ? 'Hide' : 'Show',
    baseTypes: uniqueNames(input.baseTypes),
  }
  const log = loadCustomTiers(filterPath)
  const idx = log.tiers.findIndex((t) => t.id === id)
  if (idx >= 0) log.tiers[idx] = next
  else log.tiers.push(next)
  return saveCustomTiers(filterPath, log.tiers)
}

export function deleteCustomTier(filterPath: string, id: string): CustomTierLog {
  const log = loadCustomTiers(filterPath)
  return saveCustomTiers(
    filterPath,
    log.tiers.filter((t) => t.id !== sanitizeTierId(id)),
  )
}

export function addItemToCustomTier(filterPath: string, id: string, baseType: string): CustomTierLog {
  const log = loadCustomTiers(filterPath)
  const tid = sanitizeTierId(id)
  let tier = log.tiers.find((t) => t.id === tid)
  if (!tier) {
    tier = { id: tid, typePath: 'scalpel-custom', visibility: 'Show', baseTypes: [] }
    log.tiers.push(tier)
  }
  if (!tier.baseTypes.includes(baseType)) tier.baseTypes.push(baseType)
  return saveCustomTiers(filterPath, log.tiers)
}

export function removeItemFromCustomTier(filterPath: string, id: string, baseType: string): CustomTierLog {
  const log = loadCustomTiers(filterPath)
  const tid = sanitizeTierId(id)
  const tier = log.tiers.find((t) => t.id === tid)
  if (!tier) return log
  tier.baseTypes = tier.baseTypes.filter((n) => n !== baseType)
  return saveCustomTiers(filterPath, log.tiers)
}

export function moveItemBetweenCustomTiers(
  filterPath: string,
  baseType: string,
  fromId: string | null,
  toId: string | null,
  toTypePath?: string,
): CustomTierLog {
  const log = loadCustomTiers(filterPath)
  if (fromId) {
    const from = log.tiers.find((t) => t.id === sanitizeTierId(fromId))
    if (from) from.baseTypes = from.baseTypes.filter((n) => n !== baseType)
  }
  if (toId) {
    const tid = sanitizeTierId(toId)
    let to = log.tiers.find((t) => t.id === tid)
    if (!to) {
      to = {
        id: tid,
        typePath: sanitizeTypePath(toTypePath ?? 'scalpel-custom'),
        visibility: 'Show',
        baseTypes: [],
      }
      log.tiers.push(to)
    }
    if (!to.baseTypes.includes(baseType)) to.baseTypes.push(baseType)
  }
  return saveCustomTiers(filterPath, log.tiers)
}

/** Rewrite custom blocks in the .filter from the sidecar. Never writes OnlineFilters. */
export function applyCustomTiersToFile(filterPath: string): void {
  if (!filterPath || !existsSync(filterPath)) return
  const { tiers } = loadCustomTiers(filterPath)
  const original = readFileSync(filterPath, 'utf-8')
  const next = injectCustomTiers(original, tiers)
  if (next !== original) writeFileSync(filterPath, next, 'utf-8')
}

function uniqueNames(names: string[]): string[] {
  const out: string[] = []
  for (const n of names) {
    const t = n.trim()
    if (t && !out.includes(t)) out.push(t)
  }
  return out
}
