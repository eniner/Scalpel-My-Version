import type { BaseProps } from './IconBase'

/** PoE-style "moving feet" play icon. Source SVG (Figma) is 29x41; we keep the
 *  intrinsic aspect ratio when scaling so the feet stay readable at small sizes
 *  next to button text. Uses currentColor fill so the parent button can drive
 *  it via the text color. */
export function IconPlay({ size = 18 }: BaseProps = {}): JSX.Element {
  const w = (size * 29) / 41
  return (
    <svg width={w} height={size} viewBox="0 0 29 41" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.9283 20.0536C25.6584 10.5396 30.7987 21.1744 28.0221 27.3504C26.2084 30.4048 24.807 31.7129 21.7721 33.2215C14.9066 35.2249 16.0367 35.3499 12.9596 38.7616C6.63576 43.0124 3.69111 35.7225 5.70859 33.703C6.40792 32.5627 6.72074 32.3972 8.0123 31.619C13.3586 28.3979 14.8511 27.6175 15.3482 24.9354C16.7494 21.4071 16.7933 21.1951 17.9283 20.0536ZM7.15879 2.21274C12.3098 -2.1827 23.9583 -0.227317 16.9908 9.85825C16.2129 11.2678 16.0218 11.3693 13.0269 13.703C10.5916 14.9316 10.2612 16.5834 8.6666 22.618C8.28142 24.0757 8.20993 24.4221 7.31113 25.4129C5.93758 27.9153 -1.88558 27.1302 0.423434 19.869C2.83658 15.9593 3.27401 17.0093 3.27402 9.85727C3.87211 6.52127 4.73473 4.80942 7.15879 2.21274Z" />
    </svg>
  )
}
