/** Shared 24x24 SVG wrapper for outline icons. All icons in this folder
 *  render their paths inside an IconBase so the stroke / size / viewBox
 *  stays consistent across the toolbar. */
export interface BaseProps {
  size?: number
}

export function IconBase({ size = 18, children }: { size?: number; children: React.ReactNode }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}
