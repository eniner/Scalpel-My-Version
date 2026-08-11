import { readFileSync, writeFileSync } from 'node:fs'
import type { HistoryEntry } from '@shared/types'

interface Snapshot {
  entry: HistoryEntry
  /** Raw file content before the edit */
  content: string
}

const MAX_HISTORY = 30
let snapshots: Snapshot[] = []
let nextId = 1

/** Capture the current filter file content before an edit */
export function captureSnapshot(
  filterPath: string,
  action: HistoryEntry['action'],
  description: string,
  itemName?: string,
  typePath?: string,
): void {
  try {
    const content = readFileSync(filterPath, 'utf-8')
    snapshots.push({
      entry: {
        id: nextId++,
        timestamp: Date.now(),
        description,
        action,
        itemName,
        typePath,
      },
      content,
    })
    // Trim oldest entries
    if (snapshots.length > MAX_HISTORY) {
      snapshots = snapshots.slice(snapshots.length - MAX_HISTORY)
    }
  } catch {
    // If we can't read the file, skip the snapshot
  }
}

/** Undo the most recent edit — restores the file and returns true if successful */
export function undoLast(filterPath: string): { ok: boolean; error?: string } {
  const snapshot = snapshots.pop()
  if (!snapshot) return { ok: false, error: 'Nothing to undo' }

  try {
    writeFileSync(filterPath, snapshot.content, 'utf-8')
    return { ok: true }
  } catch (err) {
    // Put it back if restore failed
    snapshots.push(snapshot)
    return { ok: false, error: String(err) }
  }
}

/**
 * Undo consecutive newest snapshots that belong to `typePath`.
 * Stops at the first non-matching (or untagged) entry.
 */
export function undoSectionHistory(
  filterPath: string,
  typePath: string,
  max = 20,
): { ok: boolean; undone: number; error?: string } {
  let undone = 0
  while (undone < max && snapshots.length > 0) {
    const top = snapshots[snapshots.length - 1]
    if (!top.entry.typePath || top.entry.typePath !== typePath) break
    const result = undoLast(filterPath)
    if (!result.ok) return { ok: false, undone, error: result.error }
    undone++
  }
  if (undone === 0) return { ok: false, undone: 0, error: 'No undo history for this section' }
  return { ok: true, undone }
}

/** Restore the filter to the state *before* the named history entry (and drop that entry + all newer). */
export function undoToEntry(filterPath: string, entryId: number): { ok: boolean; error?: string } {
  const idx = snapshots.findIndex((s) => s.entry.id === entryId)
  if (idx < 0) return { ok: false, error: 'History entry not found' }
  const snapshot = snapshots[idx]
  try {
    writeFileSync(filterPath, snapshot.content, 'utf-8')
    snapshots = snapshots.slice(0, idx)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

/** Get the history list (newest first) for display */
export function getHistory(): HistoryEntry[] {
  return snapshots.map((s) => s.entry).reverse()
}

/** Clear all history */
export function clearHistory(): void {
  snapshots = []
}
