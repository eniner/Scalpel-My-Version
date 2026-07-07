import { IconBase, type BaseProps } from './IconBase'

export function IconUndo({ size }: BaseProps = {}): JSX.Element {
  return (
    <IconBase size={size}>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h11a5 5 0 015 5v0a5 5 0 01-5 5H9" />
    </IconBase>
  )
}
