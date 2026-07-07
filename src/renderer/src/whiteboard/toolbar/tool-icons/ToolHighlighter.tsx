import { useId } from 'react'
import { shade } from './shade'

interface ToolIconProps {
  size?: number
  color?: string
}

/** Wide chisel-tip highlighter. ViewBox is 40x96. */
export function ToolHighlighter({ size = 64, color = '#ffd24d' }: ToolIconProps = {}): JSX.Element {
  const dark = shade(color, -0.35)
  const mid = shade(color, -0.1)
  const outerStroke = shade(color, -0.4)
  const tipStroke = shade(color, -0.25)
  const uid = useId().replace(/[:]/g, '')
  const gBody = `hi-body-${uid}`
  const gShine = `hi-shine-${uid}`
  return (
    <svg width={size * (40 / 96)} height={size} viewBox="0 0 40 96" fill="none">
      <defs>
        <linearGradient id={gBody} x1="5.88281" y1="27.1924" x2="34.1181" y2="27.1924" gradientUnits="userSpaceOnUse">
          <stop stopColor={mid} />
          <stop offset="0.5" stopColor={color} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={gShine} x1="8.2832" y1="33.8828" x2="8.2832" y2="84.7063" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.85" />
          <stop offset="0.8" stopColor="white" stopOpacity="0.25" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* body - edit `color` prop to change highlighter hue */}
      <path
        d="M29.8828 27.1924H10.1181C7.77902 27.1924 5.88281 29.1204 5.88281 31.4988V86.0466C5.88281 88.425 7.77902 90.353 10.1181 90.353H29.8828C32.2219 90.353 34.1181 88.425 34.1181 86.0466V31.4988C34.1181 29.1204 32.2219 27.1924 29.8828 27.1924Z"
        fill={`url(#${gBody})`}
        stroke={outerStroke}
        strokeWidth="0.847059"
      />
      {/* concave white taper from body shoulders up to a narrow neck */}
      <path
        d="M5.88281 28.2355C12.471 26.3532 15.7652 22.5885 15.7652 16.9414H24.2358C24.2358 22.5885 27.5299 26.3532 34.1181 28.2355V31.1178H5.88281V28.2355Z"
        fill="white"
        stroke="#BCBCC4"
        strokeWidth="0.705882"
        strokeLinejoin="round"
      />
      {/* narrow neck section above the taper */}
      <path
        d="M24.2362 14.1172H15.7656V18.3525H24.2362V14.1172Z"
        fill="white"
        stroke="#BCBCC4"
        strokeWidth="0.705882"
      />
      {/* angled chisel tip */}
      <path
        d="M15.7656 14.1182H24.2362V5.85254L15.7656 7.91043V14.1182Z"
        fill={color}
        stroke={tipStroke}
        strokeWidth="0.705882"
        strokeLinejoin="round"
      />
      {/* tapered shine */}
      <path
        d="M8.70673 33.8828C8.14203 50.824 8.14203 67.7652 8.70673 84.7063C10.1185 84.7063 11.0597 82.824 11.5303 79.0593C11.9067 60.2358 11.7185 45.6475 10.9656 35.2946C10.4009 34.3534 9.64791 33.8828 8.70673 33.8828Z"
        fill={`url(#${gShine})`}
      />
      {/* base shadow */}
      <path d="M34.1181 84.7061H5.88281V90.3531H34.1181V84.7061Z" fill="black" fillOpacity="0.12" />
    </svg>
  )
}
