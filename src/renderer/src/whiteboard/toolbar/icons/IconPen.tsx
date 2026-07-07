import { IconBase, type BaseProps } from './IconBase'

export function IconPen({ size }: BaseProps = {}): JSX.Element {
  return (
    <IconBase size={size}>
      {/* Pencil body angled bottom-left to top-right, with a small triangle tip
       *  at (3, 21) and a flat eraser end at the top-right. The second path is
       *  the cap separator across the body. */}
      <path d="M3 21l1-5L18 2l4 4L8 20z" />
      <path d="M14 6l4 4" />
    </IconBase>
  )
}
