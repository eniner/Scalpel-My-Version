import { renderToStaticMarkup } from 'react-dom/server'

export const RUNESHAPE_ICON = renderToStaticMarkup(
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden="true">
    <rect x="6" y="8" width="28" height="34" rx="2" strokeLinecap="round" />
    <path d="M12 16h16M12 24h16M12 32h10" strokeLinecap="round" />
    <path d="M34 14l8 10-8 10" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="38" cy="24" r="3" fill="currentColor" fillOpacity="0.35" stroke="currentColor" />
  </svg>,
)
