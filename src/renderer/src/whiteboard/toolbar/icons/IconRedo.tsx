import { IconBase, type BaseProps } from './IconBase'

export function IconRedo({ size }: BaseProps = {}): JSX.Element {
  return (
    <IconBase size={size}>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H9a5 5 0 00-5 5v0a5 5 0 005 5h6" />
    </IconBase>
  )
}
