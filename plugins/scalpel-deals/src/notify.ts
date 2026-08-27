export function notifyDesktop(title: string, body: string): void {
  try {
    if (typeof Notification === 'undefined') return
    new Notification(title, { body, silent: false })
  } catch {
    // Overlay renderers may lack permission; the in-app feed still records the alert.
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
