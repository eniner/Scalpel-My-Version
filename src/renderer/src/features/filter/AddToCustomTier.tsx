import { useEffect, useState } from 'react'
import type { CustomTier, PoeItem } from '@shared/types'

interface Props {
  item: PoeItem
}

export function AddToCustomTier({ item }: Props): JSX.Element {
  const [tiers, setTiers] = useState<CustomTier[]>([])
  const [selected, setSelected] = useState('keep')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void window.api.getCustomTiers().then((r) => {
      setTiers(r.tiers)
      if (r.tiers.length > 0 && !r.tiers.some((t) => t.id === selected)) setSelected(r.tiers[0].id)
    })
  }, [item.baseType])

  const add = async (): Promise<void> => {
    setBusy(true)
    setMessage(null)
    const id = tiers.length === 0 ? 'keep' : selected
    if (tiers.length === 0) {
      await window.api.saveCustomTier({
        id: 'keep',
        typePath: 'scalpel-custom',
        visibility: 'Show',
        baseTypes: [],
      })
    }
    const result = await window.api.addCustomTierItem(id, item.baseType, JSON.stringify(item))
    setBusy(false)
    if (!result.ok) {
      setMessage(result.error ?? 'Failed')
      return
    }
    setTiers(result.tiers ?? [])
    setMessage(`Added to ${id}`)
  }

  return (
    <div className="bg-bg-card rounded border border-accent/40">
      <div className="px-3 pt-3 pb-2 flex items-center gap-2">
        <span className="section-title text-accent">Pin to custom tier</span>
      </div>
      <div className="px-3 pb-3 flex flex-col gap-1.5">
        <p className="text-[10px] text-text-dim m-0">
          One click pins <strong className="text-text">{item.baseType}</strong> into your own tier (above Currency
          S/A/B). Survives FilterBlade online updates.
        </p>
        <div className="flex gap-1.5">
          {tiers.length > 0 && (
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="flex-1 text-[11px] px-2 py-1.5 rounded bg-black/25 border border-border text-text"
            >
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id}
                </option>
              ))}
            </select>
          )}
          <button className="primary px-3 py-1.5 text-[11px] font-semibold" disabled={busy} onClick={() => void add()}>
            {tiers.length === 0 ? `Create keep + pin` : `Pin to ${selected}`}
          </button>
        </div>
        {message && <p className="text-[10px] text-accent m-0">{message}</p>}
      </div>
    </div>
  )
}
