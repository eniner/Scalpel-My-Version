import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GameVariant } from '@shared/types'

export interface BuildPlannerFileEntry {
  /** Filename only (e.g. `My Build.build`). Safe to pass back to readBuildPlannerFile. */
  filename: string
  /** Human label from the JSON `name` field when readable, otherwise the filename stem. */
  name: string
}

/** Resolve the PoE BuildPlanner export folder under Documents. */
export function resolveBuildPlannerPath(version: GameVariant, documentsDir: string): string {
  const gameFolder = version === 2 ? 'Path of Exile 2' : 'Path of Exile'
  return join(documentsDir, 'My Games', gameFolder, 'BuildPlanner')
}

function labelFromFilename(filename: string): string {
  return filename.replace(/\.build$/i, '').trim()
}

function labelFromContent(filename: string, content: string): string {
  try {
    const parsed = JSON.parse(content) as { name?: string }
    const name = parsed.name?.trim()
    if (name) return name
  } catch {
    // ignore — fall back to filename
  }
  return labelFromFilename(filename)
}

/** List `.build` files in the BuildPlanner folder. Missing folder → empty list. */
export function listBuildPlannerFiles(dir: string): BuildPlannerFileEntry[] {
  if (!dir || !existsSync(dir)) return []
  try {
    const files = readdirSync(dir, { withFileTypes: true })
    const entries: BuildPlannerFileEntry[] = []
    for (const f of files) {
      if (!f.isFile() || !f.name.toLowerCase().endsWith('.build')) continue
      const path = join(dir, f.name)
      let name = labelFromFilename(f.name)
      try {
        const content = readFileSync(path, 'utf8')
        name = labelFromContent(f.name, content)
      } catch {
        // keep filename stem
      }
      entries.push({ filename: f.name, name })
    }
    entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    return entries
  } catch {
    return []
  }
}

/** Read a single `.build` file by basename. Rejects paths outside the folder. */
export function readBuildPlannerFile(dir: string, filename: string): string {
  if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    throw new Error('invalid build filename')
  }
  if (!filename.toLowerCase().endsWith('.build')) {
    throw new Error('expected a .build file')
  }
  const path = join(dir, filename)
  if (!existsSync(path)) {
    throw new Error(`build file not found: ${filename}`)
  }
  return readFileSync(path, 'utf8')
}
