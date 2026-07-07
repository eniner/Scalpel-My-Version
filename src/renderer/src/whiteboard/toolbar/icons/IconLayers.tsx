import { IconBase, type BaseProps } from './IconBase'

export function IconLayers({ size }: BaseProps = {}): JSX.Element {
  return (
    <IconBase size={size}>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </IconBase>
  )
}
