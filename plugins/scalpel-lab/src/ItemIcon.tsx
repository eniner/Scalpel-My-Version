import { lookupItemIcon } from './item-icon'

interface ItemIconProps {
  name?: string | null
  url?: string | null
  size?: number
  title?: string
}

export function ItemIcon({ name, url, size = 28, title }: ItemIconProps): JSX.Element | null {
  const src = url ?? (name ? lookupItemIcon(name) : null)
  if (!src) return null
  return (
    <img
      src={src}
      alt=""
      title={title ?? name ?? undefined}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
        imageRendering: 'auto',
      }}
      loading="lazy"
      draggable={false}
    />
  )
}
