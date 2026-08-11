import type { ReactNode } from 'react'
import { TOOL_ICONS } from './toolIcons'
import { accentBtnStyle, fonts, ghostBtnStyle, theme } from './theme'

export function ToolIcon({
  toolId,
  size = 28,
}: {
  toolId: string
  size?: number
}): JSX.Element | null {
  const src = TOOL_ICONS[toolId]
  if (!src) return null
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
        filter: 'saturate(0.92) contrast(1.05)',
      }}
      draggable={false}
    />
  )
}

export function ToolHeader({
  toolId,
  title,
  onBack,
  status,
  onRefresh,
  refreshLabel = 'Sync prices',
  children,
}: {
  toolId: string
  title: string
  onBack: () => void
  status?: string
  onRefresh?: () => void
  refreshLabel?: string
  children?: ReactNode
}): JSX.Element {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        paddingBottom: 10,
        borderBottom: `1px solid ${theme.border}`,
      }}
    >
      <button type="button" style={ghostBtnStyle} onClick={onBack}>
        ← Atlas
      </button>
      <ToolIcon toolId={toolId} size={28} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 22,
            fontWeight: 650,
            color: theme.ink,
            letterSpacing: '-0.015em',
            lineHeight: 1.1,
          }}
        >
          {title}
        </div>
        {status != null ? (
          <div
            style={{
              marginTop: 3,
              fontSize: 11,
              color: theme.dim,
              letterSpacing: '0.04em',
            }}
          >
            {status}
          </div>
        ) : null}
      </div>
      {children}
      {onRefresh ? (
        <button type="button" style={accentBtnStyle} onClick={onRefresh}>
          {refreshLabel}
        </button>
      ) : null}
    </header>
  )
}
