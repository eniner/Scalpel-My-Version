import { ChartLine } from '@icon-park/react'
import { renderToStaticMarkup } from 'react-dom/server'

export const DPS_ICON = renderToStaticMarkup(
  <ChartLine theme="two-tone" fill={['currentColor', 'rgba(255, 255, 255, 0.2)']} />,
)
