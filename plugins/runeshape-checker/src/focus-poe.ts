/** Hand OS focus back to the game window (same IPC regex-remote uses). */
export function focusPoE(): void {
  const api = (window as unknown as { api?: { regexRemoteHandFocus?: () => void } }).api
  api?.regexRemoteHandFocus?.()
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Capture needs PoE in the foreground; retry after refocusing when Scalpel has focus. */
export async function captureWithRefocus(
  capture: () => Promise<import('@scalpelpoe/plugin-sdk').GameCapture | null>,
): Promise<import('@scalpelpoe/plugin-sdk').GameCapture | null> {
  let frame = await capture()
  if (frame) return frame
  for (let i = 0; i < 4; i++) {
    focusPoE()
    await sleep(i === 0 ? 80 : 120)
    frame = await capture()
    if (frame) return frame
  }
  return null
}
