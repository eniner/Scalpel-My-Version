import type { CSSProperties } from 'react'

/**
 * Scalpel Advisor — "Atlas Draft" visual language.
 * Distinct from Perandus Ledger (no fire-orange site chrome): ink slate,
 * verdigris accent, Fraunces display + Figtree UI.
 */
export const theme = {
  bg: '#0a1118',
  bgElevated: '#0f1822',
  panel: 'rgba(18, 28, 38, 0.72)',
  text: '#ebe6dc',
  dim: '#8b9aab',
  muted: '#5c6b7a',
  accent: '#3d9b8f',
  accentHot: '#c4a574',
  accentSoft: 'rgba(61, 155, 143, 0.16)',
  border: 'rgba(140, 170, 190, 0.16)',
  borderStrong: 'rgba(140, 170, 190, 0.28)',
  green: '#6fbf8a',
  red: '#d47474',
  blue: '#6aa8c8',
  /** EV / highlight — remapped from old purple to verdigris ink */
  purple: '#5eb8a8',
  ink: '#d8cfc0',
  rule: 'rgba(196, 165, 116, 0.45)',
} as const

export const fonts = {
  display: '"Fraunces", "Iowan Old Style", "Palatino Linotype", serif',
  ui: '"Figtree", "Segoe UI", sans-serif',
  mono: '"IBM Plex Mono", "Consolas", monospace',
} as const

export const inputStyle: CSSProperties = {
  background: 'rgba(8, 14, 20, 0.85)',
  border: `1px solid ${theme.borderStrong}`,
  borderRadius: 2,
  color: theme.text,
  padding: '5px 8px',
  fontSize: 12,
  fontFamily: fonts.ui,
  width: 72,
  outline: 'none',
}

export const btnStyle: CSSProperties = {
  background: 'transparent',
  border: `1px solid ${theme.borderStrong}`,
  borderRadius: 2,
  color: theme.text,
  padding: '6px 12px',
  fontSize: 11,
  fontFamily: fonts.ui,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'border-color 140ms ease, background 140ms ease, color 140ms ease',
}

export const accentBtnStyle: CSSProperties = {
  ...btnStyle,
  background: theme.accent,
  borderColor: theme.accent,
  color: '#071210',
  fontWeight: 700,
}

export const ghostBtnStyle: CSSProperties = {
  ...btnStyle,
  borderColor: 'transparent',
  color: theme.dim,
  padding: '6px 8px',
}

export const thStyle: CSSProperties = {
  padding: '8px 10px',
  fontWeight: 600,
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: theme.muted,
  fontFamily: fonts.ui,
  borderBottom: `1px solid ${theme.border}`,
  position: 'sticky',
  top: 0,
  background: 'rgba(10, 17, 24, 0.94)',
  zIndex: 1,
}

export const tdStyle: CSSProperties = {
  padding: '7px 10px',
  fontSize: 12,
  fontFamily: fonts.ui,
  borderTop: `1px solid ${theme.border}`,
}

export const tableWrapStyle: CSSProperties = {
  flex: 1,
  overflow: 'auto',
  border: `1px solid ${theme.border}`,
  borderRadius: 2,
  background: 'rgba(8, 14, 20, 0.45)',
}

export const ADVISOR_STYLE_ID = 'scalpel-advisor-atlas-draft'

/** Inject fonts + ambient chrome once per overlay mount. */
export function injectAdvisorStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(ADVISOR_STYLE_ID)) return

  const link = document.createElement('link')
  link.id = `${ADVISOR_STYLE_ID}-fonts`
  link.rel = 'stylesheet'
  link.href =
    'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,650;9..144,700&family=IBM+Plex+Mono:wght@400;500&display=swap'
  document.head.appendChild(link)

  const style = document.createElement('style')
  style.id = ADVISOR_STYLE_ID
  style.textContent = `
    .sa-shell {
      box-sizing: border-box;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      color: ${theme.text};
      font-family: ${fonts.ui};
      background:
        radial-gradient(1200px 500px at 12% -10%, rgba(61, 155, 143, 0.14), transparent 55%),
        radial-gradient(900px 420px at 100% 0%, rgba(196, 165, 116, 0.08), transparent 50%),
        linear-gradient(180deg, #0d1620 0%, ${theme.bg} 42%, #080e14 100%);
      position: relative;
    }
    .sa-shell::before {
      content: '';
      pointer-events: none;
      position: absolute;
      inset: 0;
      opacity: 0.35;
      background-image:
        linear-gradient(rgba(140, 170, 190, 0.045) 1px, transparent 1px),
        linear-gradient(90deg, rgba(140, 170, 190, 0.045) 1px, transparent 1px);
      background-size: 28px 28px;
      mask-image: linear-gradient(180deg, rgba(0,0,0,0.55), transparent 70%);
    }
    .sa-shell > * { position: relative; z-index: 1; }
    .sa-enter {
      animation: sa-fade-up 280ms ease-out both;
    }
    @keyframes sa-fade-up {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .sa-tool-btn {
      appearance: none;
      width: 100%;
      text-align: left;
      cursor: pointer;
      border: 1px solid ${theme.border};
      border-radius: 2px;
      background: linear-gradient(135deg, rgba(18, 30, 40, 0.9), rgba(12, 20, 28, 0.75));
      padding: 0;
      color: inherit;
      overflow: hidden;
      transition: border-color 160ms ease, transform 160ms ease, background 160ms ease;
      position: relative;
    }
    .sa-tool-btn::before {
      content: '';
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 3px;
      background: ${theme.accent};
      transform: scaleY(0);
      transform-origin: bottom;
      transition: transform 180ms ease;
    }
    .sa-tool-btn:hover {
      border-color: ${theme.borderStrong};
      transform: translateY(-1px);
      background: linear-gradient(135deg, rgba(24, 40, 52, 0.95), rgba(14, 24, 34, 0.85));
    }
    .sa-tool-btn:hover::before { transform: scaleY(1); }
    .sa-tool-btn:focus-visible {
      outline: 2px solid ${theme.accent};
      outline-offset: 2px;
    }
    .sa-tab {
      appearance: none;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: ${theme.dim};
      font-family: ${fonts.ui};
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 8px 4px 10px;
      margin-right: 18px;
      cursor: pointer;
      transition: color 140ms ease, border-color 140ms ease;
    }
    .sa-tab[data-active="true"] {
      color: ${theme.ink};
      border-bottom-color: ${theme.accent};
    }
    .sa-tab:hover { color: ${theme.text}; }
    .sa-num {
      font-family: ${fonts.mono};
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
    }
    .sa-shell button:hover:not(:disabled) {
      filter: brightness(1.05);
    }
  `
  document.head.appendChild(style)
}
