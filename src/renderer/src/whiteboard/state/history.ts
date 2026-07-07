/** Linear undo/redo stack over snapshots of type T.
 *
 *  Caller is responsible for snapshotting state. We don't deep-clone here
 *  because the caller knows whether their state is structurally shared
 *  (immutable) or needs a copy.
 *
 *  Usage convention: call `commit(currentState)` each time the state changes.
 *  The undo stack records each committed snapshot. The top of the stack is
 *  always the most recent committed state (the "current" marker).
 *
 *  - `commit(s)` pushes snapshot s. Wipes the redo branch.
 *  - `undo(current)` pops the current marker off the undo stack, parks it on
 *    the redo stack, and returns the new top (the previous state). Returns null
 *    if the stack had only one or zero entries (nothing to go back to).
 *  - `redo(current)` pops the redo stack and pushes it onto the undo stack,
 *    returning the replayed state. Returns null if redo is empty.
 *
 *  Cap: oldest entries are dropped first when over `max`. */
export interface History<T> {
  commit(state: T): void
  undo(currentState: T): T | null
  redo(currentState: T): T | null
  canUndo(): boolean
  canRedo(): boolean
  clear(): void
}

export function createHistory<T>(opts: { max: number }): History<T> {
  const { max } = opts
  let undoStack: T[] = []
  let redoStack: T[] = []

  return {
    commit(state) {
      undoStack.push(state)
      if (undoStack.length > max) undoStack.shift()
      redoStack = []
    },
    undo(_currentState) {
      if (undoStack.length === 0) return null
      const current = undoStack.pop()!
      redoStack.push(current)
      // Return the new top (the previous state), or null if none.
      return undoStack.length > 0 ? undoStack[undoStack.length - 1] : null
    },
    redo(_currentState) {
      const next = redoStack.pop()
      if (next === undefined) return null
      undoStack.push(next)
      if (undoStack.length > max) undoStack.shift()
      return next
    },
    canUndo() {
      return undoStack.length > 1
    },
    canRedo() {
      return redoStack.length > 0
    },
    clear() {
      undoStack = []
      redoStack = []
    },
  }
}
