import { useEffect, useState } from 'react'
import type { CustomTier } from '@shared/types'
import { m } from '@shared/paraglide/messages.js'

interface Props {
  filterPath?: string
}

/** Settings only creates/deletes named tiers. Adding items is done from the
 *  overlay (hover item → Custom tier), not by typing BaseType names here. */
export function CustomTiersPanel({ filterPath }: Props): JSX.Element {
  const [tiers, setTiers] = useState<CustomTier[]>([])
  const [name, setName] = useState('keep')
  const [visibility, setVisibility] = useState<'Show' | 'Hide'>('Show')
  const [error, setError] = useState<string | null>(null)

  const reload = async (): Promise<void> => {
    const r = await window.api.getCustomTiers()
    setTiers(r.tiers)
  }

  useEffect(() => {
    if (!filterPath) {
      setTiers([])
      return
    }
    void reload()
  }, [filterPath])

  if (!filterPath) {
    return (
      <section className="mt-3">
        <div className="settings-section-title mt-3">{m.settings_custom_tiers_heading()}</div>
        <p className="text-[11px] text-text-dim m-0">{m.settings_custom_tiers_need_filter()}</p>
      </section>
    )
  }

  const addTier = async (): Promise<void> => {
    setError(null)
    const result = await window.api.saveCustomTier({
      id: name,
      typePath: 'scalpel-custom',
      visibility,
      baseTypes: [],
    })
    if (!result.ok) {
      setError(result.error ?? 'Failed to save tier')
      return
    }
    setTiers(result.tiers ?? [])
  }

  return (
    <section className="mt-3">
      <div className="settings-section-title mt-3">{m.settings_custom_tiers_heading()}</div>
      <p className="text-[11px] text-text-dim m-0 mb-2">{m.settings_custom_tiers_body()}</p>
      <div className="flex flex-wrap gap-1.5 items-center mb-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="keep"
          className="text-[11px] px-2 py-1 rounded bg-black/30 border border-border text-text w-[140px]"
        />
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as 'Show' | 'Hide')}
          className="text-[11px] px-2 py-1 rounded bg-black/30 border border-border text-text"
        >
          <option value="Show">Show</option>
          <option value="Hide">Hide</option>
        </select>
        <button className="primary px-2 py-1 text-[11px]" onClick={() => void addTier()}>
          {m.settings_custom_tiers_add()}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-400 m-0 mb-2">{error}</p>}
      {tiers.length === 0 && <p className="text-[11px] text-text-dim m-0 mb-2">{m.settings_custom_tiers_empty()}</p>}
      <div className="flex flex-col gap-2">
        {tiers.map((tier) => (
          <div key={tier.id} className="rounded p-2 bg-black/20 border border-border">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[11px] text-text">
                <strong>{tier.id}</strong>{' '}
                <span className="text-text-dim">
                  {tier.visibility} · {tier.baseTypes.length} item{tier.baseTypes.length === 1 ? '' : 's'}
                </span>
              </span>
              <button
                className="px-2 py-0.5 text-[10px]"
                onClick={async () => {
                  const r = await window.api.deleteCustomTier(tier.id)
                  if (r.ok) setTiers(r.tiers ?? [])
                }}
              >
                {m.settings_custom_tiers_delete()}
              </button>
            </div>
            {tier.baseTypes.length === 0 ? (
              <p className="text-[10px] text-text-dim m-0">{m.settings_custom_tiers_awaiting_items()}</p>
            ) : (
              tier.baseTypes.map((bt) => (
                <div key={bt} className="flex items-center justify-between text-[11px] py-0.5">
                  <span>{bt}</span>
                  <button
                    className="text-[10px] text-text-dim"
                    onClick={async () => {
                      const r = await window.api.removeCustomTierItem(tier.id, bt)
                      if (r.ok) setTiers(r.tiers ?? [])
                    }}
                  >
                    {m.settings_custom_tiers_remove_item()}
                  </button>
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
