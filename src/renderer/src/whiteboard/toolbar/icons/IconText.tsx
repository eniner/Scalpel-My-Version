import { IconBase, type BaseProps } from './IconBase'

export function IconText({ size }: BaseProps = {}): JSX.Element {
  return (
    <IconBase size={size}>
      <path d="M5 7V5h14v2" />
      <path d="M12 5v14" />
      <path d="M9 19h6" />
    </IconBase>
  )
}
