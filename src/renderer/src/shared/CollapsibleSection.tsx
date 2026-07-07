import { useState, type ReactNode } from 'react'
import { Down, Right } from '@icon-park/react'
import { IP } from './constants'

interface CollapsibleSectionProps {
  /** Fully-styled header label node. The call site owns its typography so
   *  this component imposes none. */
  title: ReactNode
  defaultOpen?: boolean
  /** Extra classes appended to the header row (e.g. padding) so call sites
   *  that need different header spacing keep it. */
  headerClassName?: string
  children: ReactNode
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  headerClassName,
  children,
}: CollapsibleSectionProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <div
        onClick={() => setOpen((v) => !v)}
        className={['flex items-center gap-[6px] cursor-pointer select-none', headerClassName]
          .filter(Boolean)
          .join(' ')}
      >
        <span className="flex -mt-px">{open ? <Down size={12} {...IP} /> : <Right size={12} {...IP} />}</span>
        {title}
      </div>
      {open && children}
    </div>
  )
}
