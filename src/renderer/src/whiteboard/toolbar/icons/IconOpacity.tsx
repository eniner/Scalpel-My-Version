import { IconBase, type BaseProps } from './IconBase'

export function IconOpacity({ size }: BaseProps = {}): JSX.Element {
  return (
    <IconBase size={size}>
      <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
      <path d="M12 3a9 9 0 010 18z" fill="currentColor" stroke="none" />
    </IconBase>
  )
}
