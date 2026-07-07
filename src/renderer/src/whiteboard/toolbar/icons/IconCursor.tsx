import { IconBase, type BaseProps } from './IconBase'

export function IconCursor({ size }: BaseProps = {}): JSX.Element {
  return (
    <IconBase size={size}>
      {/* Shifted +1 in y vs the design path so the cursor's bbox (originally
       *  y=3..19, top-biased in the 24-unit viewBox) sits centered like the
       *  other icons. */}
      <path d="M5 4l5 16 2.5-7L19.5 11z" />
    </IconBase>
  )
}
