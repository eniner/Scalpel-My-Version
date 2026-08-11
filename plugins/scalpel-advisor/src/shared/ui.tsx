import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import {
  accentBtnStyle,
  btnStyle,
  fonts,
  ghostBtnStyle,
  tableWrapStyle,
  tdStyle,
  theme,
  thStyle,
} from './theme'
import { ToolIcon } from './ToolChrome'

export function Shell({
  children,
  className = '',
  pad = true,
}: {
  children: ReactNode
  className?: string
  pad?: boolean
}): JSX.Element {
  return (
    <div
      className={`sa-shell ${className}`.trim()}
      style={{
        padding: pad ? '14px 16px 16px' : 0,
        gap: 12,
      }}
    >
      {children}
    </div>
  )
}

export function BrandMark({
  subtitle = 'Farming EV · Keepers atlas tools',
}: {
  subtitle?: string
}): JSX.Element {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 34,
          fontWeight: 650,
          lineHeight: 1,
          letterSpacing: '-0.02em',
          color: theme.ink,
          margin: 0,
        }}
      >
        Advisor
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 11,
          color: theme.dim,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontWeight: 500,
        }}
      >
        {subtitle}
      </div>
      <div
        style={{
          marginTop: 10,
          height: 2,
          width: 72,
          background: `linear-gradient(90deg, ${theme.accent}, transparent)`,
        }}
      />
    </div>
  )
}

export function LeagueStamp({
  league,
  divine,
  mirror,
  onRefresh,
}: {
  league: string
  divine: number
  mirror: number
  onRefresh?: () => void
}): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          border: `1px solid ${theme.borderStrong}`,
          borderRadius: 2,
          padding: '8px 12px',
          background: theme.accentSoft,
          textAlign: 'right',
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: theme.accent,
            fontWeight: 700,
          }}
        >
          League
        </div>
        <div style={{ fontFamily: fonts.display, fontSize: 18, color: theme.ink, marginTop: 2 }}>
          {league || '—'}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: theme.dim }}>
        <span className="sa-num">
          Div <strong style={{ color: theme.text }}>{Math.round(divine)}</strong>c
        </span>
        <span style={{ color: theme.muted }}>·</span>
        <span className="sa-num">
          Mirror <strong style={{ color: theme.text }}>{Math.round(mirror)}</strong>d
        </span>
        {onRefresh ? (
          <button type="button" style={accentBtnStyle} onClick={onRefresh}>
            Sync
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function TabStrip({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ id: string; label: string }>
  value: string
  onChange: (id: string) => void
}): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        borderBottom: `1px solid ${theme.border}`,
        marginBottom: 2,
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className="sa-tab"
          data-active={t.id === value}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Stat({
  label,
  value,
  color,
  hint,
}: {
  label: string
  value: string
  color?: string
  hint?: string
}): JSX.Element {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderLeft: `2px solid ${color ?? theme.accent}`,
        background: 'rgba(12, 20, 28, 0.55)',
        minWidth: 0,
      }}
      title={hint}
    >
      <div
        style={{
          fontSize: 9,
          color: theme.muted,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        className="sa-num"
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: color ?? theme.text,
          lineHeight: 1.15,
        }}
      >
        {value}
      </div>
    </div>
  )
}

export function StatRail({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 8,
      }}
    >
      {children}
    </div>
  )
}

export function Blurb({ children }: { children: ReactNode }): JSX.Element {
  return (
    <p
      style={{
        margin: 0,
        color: theme.dim,
        fontSize: 12,
        lineHeight: 1.45,
        maxWidth: 720,
      }}
    >
      {children}
    </p>
  )
}

export function ToolTile({
  toolId,
  title,
  actions,
  onAction,
}: {
  toolId: string
  title: string
  actions: string[]
  onAction: (action: string) => void
}): JSX.Element {
  return (
    <div className="sa-tool-btn" style={{ display: 'block' }}>
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '14px 14px 14px 16px',
          alignItems: 'stretch',
          minHeight: 96,
        }}
      >
        <div
          style={{
            width: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: 0.92,
          }}
        >
          <ToolIcon toolId={toolId} size={36} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              fontFamily: fonts.display,
              fontSize: 17,
              fontWeight: 650,
              color: theme.ink,
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto' }}>
            {actions.map((action) => (
              <button
                key={action}
                type="button"
                style={{ ...btnStyle, textTransform: 'none', letterSpacing: '0.02em' }}
                onClick={() => onAction(action)}
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Workbench({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div
      className="sa-shell sa-enter"
      style={{
        padding: '12px 14px 14px',
        gap: 10,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}

export function Toolbar({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
      }}
    >
      {children}
    </div>
  )
}

/** Results-first split: narrow setup rail + main stage (breaks Ledger's vertical stack). */
export function SplitBody({
  rail,
  stage,
  railWidth = 248,
}: {
  rail: ReactNode
  stage: ReactNode
  railWidth?: number
}): JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: `minmax(${railWidth}px, ${railWidth}px) minmax(0, 1fr)`,
        gap: 12,
        overflow: 'hidden',
      }}
    >
      <aside
        style={{
          minHeight: 0,
          overflow: 'auto',
          paddingRight: 4,
          borderRight: `1px solid ${theme.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {rail}
      </aside>
      <section
        style={{
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {stage}
      </section>
    </div>
  )
}

export function SetupGroup({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          ...ghostBtnStyle,
          width: '100%',
          justifyContent: 'space-between',
          display: 'flex',
          padding: '4px 0',
          color: theme.accentHot,
          letterSpacing: '0.1em',
          fontSize: 10,
        }}
      >
        <span>{title}</span>
        <span style={{ color: theme.muted }}>{open ? '−' : '+'}</span>
      </button>
      {open ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 6 }}>{children}</div>
      ) : null}
    </div>
  )
}

export function HeroMetric({
  label,
  value,
  sub,
  tone = 'accent',
}: {
  label: string
  value: string
  sub?: string
  tone?: 'accent' | 'good' | 'warn' | 'ink'
}): JSX.Element {
  const color =
    tone === 'good' ? theme.green : tone === 'warn' ? theme.accentHot : tone === 'ink' ? theme.ink : theme.accent
  return (
    <div
      style={{
        padding: '12px 14px',
        background: 'linear-gradient(135deg, rgba(18, 32, 42, 0.95), rgba(10, 16, 22, 0.8))',
        border: `1px solid ${theme.border}`,
        borderRadius: 2,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: theme.muted,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        className="sa-num"
        style={{
          marginTop: 4,
          fontFamily: fonts.display,
          fontSize: 28,
          fontWeight: 650,
          color,
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>
      {sub ? (
        <div style={{ marginTop: 4, fontSize: 11, color: theme.dim }} className="sa-num">
          {sub}
        </div>
      ) : null}
    </div>
  )
}

export function HeroRow({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 8,
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  )
}

export function FieldLabel({
  label,
  children,
  wide,
}: {
  label: ReactNode
  children: ReactNode
  wide?: boolean
}): JSX.Element {
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        fontSize: 10,
        color: theme.muted,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        width: wide ? '100%' : undefined,
      }}
    >
      {label}
      {children}
    </label>
  )
}

export function ActionChip({
  label,
  active,
  onClick,
  disabled,
  tone = 'accent',
}: {
  label: string
  active?: boolean
  onClick?: () => void
  disabled?: boolean
  tone?: 'accent' | 'good' | 'warn' | 'mute'
}): JSX.Element {
  const activeColor =
    tone === 'good' ? theme.green : tone === 'warn' ? theme.accentHot : tone === 'mute' ? theme.dim : theme.accent
  return (
    <button
      type="button"
      disabled={disabled || !onClick}
      onClick={onClick}
      style={{
        appearance: 'none',
        cursor: disabled || !onClick ? 'default' : 'pointer',
        border: `1px solid ${active ? activeColor : theme.border}`,
        background: active ? `${activeColor}22` : 'transparent',
        color: active ? activeColor : theme.dim,
        borderRadius: 2,
        padding: '3px 8px',
        fontSize: 10,
        fontFamily: fonts.ui,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {label}
    </button>
  )
}

export function ListRow({
  leading,
  trailing,
  muted,
  children,
}: {
  leading?: ReactNode
  trailing?: ReactNode
  muted?: boolean
  children?: ReactNode
}): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderBottom: `1px solid ${theme.border}`,
        opacity: muted ? 0.42 : 1,
        background: 'rgba(8, 14, 20, 0.25)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>{leading ?? children}</div>
      {trailing ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{trailing}</div> : null}
    </div>
  )
}

export { accentBtnStyle, btnStyle, ghostBtnStyle, tableWrapStyle, tdStyle as td, thStyle as th, theme, fonts }
