/** Single asymmetric S-curve squiggle used by the tip-size picker.
 *  `thick` toggles between thin and thick strokes. */
export function TipSquiggle({ thick }: { thick: boolean }): JSX.Element {
  const sw = thick ? 3.6 : 1.4
  return (
    <svg width="24" height="14" viewBox="0 0 24 14" fill="none">
      <path
        d="M2 9 C 5 3, 10 3, 13 8 S 19 12, 22 7"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
