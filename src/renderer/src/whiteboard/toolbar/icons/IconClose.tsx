import { IconBase, type BaseProps } from './IconBase'

export function IconClose({ size = 16 }: BaseProps = {}): JSX.Element {
  return (
    <IconBase size={size}>
      <path d="M6 6l12 12M18 6L6 18" />
    </IconBase>
  )
}
