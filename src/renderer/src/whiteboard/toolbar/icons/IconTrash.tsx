import { IconBase, type BaseProps } from './IconBase'

export function IconTrash({ size }: BaseProps = {}): JSX.Element {
  return (
    <IconBase size={size}>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </IconBase>
  )
}
