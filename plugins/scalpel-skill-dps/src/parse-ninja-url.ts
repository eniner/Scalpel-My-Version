export type NinjaProfileRef = {
  account: string
  league: string
  name: string
}

const PROFILE_RE =
  /poe\.ninja\/poe2\/profile\/([^/?#]+)\/([^/?#]+)\/character\/([^/?#]+)/i

/** Parse a poe.ninja PoE2 character profile URL into path segments. */
export function parseNinjaCharacterUrl(input: string): NinjaProfileRef | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const m = trimmed.match(PROFILE_RE)
  if (!m) return null
  try {
    return {
      account: decodeURIComponent(m[1]),
      league: decodeURIComponent(m[2]),
      name: decodeURIComponent(m[3]),
    }
  } catch {
    return null
  }
}

export function profileUrl(ref: NinjaProfileRef): string {
  return `https://poe.ninja/poe2/profile/${encodeURIComponent(ref.account)}/${encodeURIComponent(ref.league)}/character/${encodeURIComponent(ref.name)}`
}
