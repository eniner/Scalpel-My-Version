import { TrendTwo } from '@icon-park/react'
import { renderToStaticMarkup } from 'react-dom/server'

export const DEALS_ICON = renderToStaticMarkup(
  <TrendTwo theme="two-tone" fill={['currentColor', 'rgba(255, 255, 255, 0.2)']} />,
)
