import { renderToStaticMarkup } from 'react-dom/server'

export const HARVEST_ICON = renderToStaticMarkup(
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
    <path d="M12 36c8-2 14-10 16-20" strokeLinecap="round" />
    <path d="M28 16c4 2 8 6 10 12" strokeLinecap="round" opacity="0.7" />
    <circle cx="30" cy="14" r="3" />
    <path d="M10 38h28" strokeLinecap="round" opacity="0.45" />
  </svg>,
)
