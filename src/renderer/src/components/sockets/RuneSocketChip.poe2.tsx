import socketRunePoe2 from '../../assets/sockets/socket-rune-poe2.png'

/**
 * Horizontal pill of PoE2 rune socket orbs used in ItemSummary. PoE2 sockets
 * have no colors or links, so this takes a count and renders one orb per rune
 * inside the shared chip container. Returns null for count <= 0 so callers can
 * render unconditionally.
 */
export function RuneSocketChipPoe2({ count, size = 18 }: { count: number; size?: number }): JSX.Element | null {
  if (count <= 0) return null
  return (
    <div className="inline-flex items-center gap-[4px] rounded-full bg-black/25 px-1.5 py-[3px]">
      {Array.from({ length: count }).map((_, i) => (
        <img key={i} src={socketRunePoe2} alt="rune" style={{ width: size, height: size }} />
      ))}
    </div>
  )
}
