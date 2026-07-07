export interface DebouncedSaver<T> {
  schedule(payload: T): void
  flushNow(): void
  cancel(): void
}

/** Trailing-debounced single-payload saver.
 *
 *  - `schedule(p)` arms (or rearms) a timer; on fire, calls `sink(p)` once
 *    with the *most recent* payload.
 *  - `flushNow()` if armed, fires immediately with the pending payload.
 *  - Idle = zero invocations of sink. There is no periodic ticking. */
export function createDebouncedSaver<T>(sink: (payload: T) => void, windowMs: number): DebouncedSaver<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: { value: T } | null = null

  function fire(): void {
    if (pending === null) return
    const p = pending.value
    pending = null
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    sink(p)
  }

  return {
    schedule(payload) {
      pending = { value: payload }
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(fire, windowMs)
    },
    flushNow() {
      if (pending !== null) fire()
    },
    cancel() {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      pending = null
    },
  }
}
