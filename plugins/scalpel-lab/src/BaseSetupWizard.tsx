import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type {
  CoeCatalogFamilyResult,
  CoeCatalogItemResult,
  CoeCatalogResult,
  CraftApi,
  CraftItemStateResult,
} from '@scalpelpoe/plugin-sdk'
import { Button, ErrorBanner } from '@scalpelpoe/plugin-sdk'
import { catalogItemCardLines } from './catalog-card'
import { inputStyle, selectStyle } from './craft-utils'
import { ItemIcon } from './ItemIcon'

export interface BaseSetupSelection {
  baseType: string
  itemLevel: number
  quality: number
  item: CoeCatalogItemResult
  groupName: string
  familyName: string
}

interface BaseSetupWizardProps {
  craft: CraftApi
  onProceed: (selection: BaseSetupSelection, state: CraftItemStateResult) => void
}

type Step = 'group' | 'family' | 'bases' | 'configure'

const chipStyle = (active: boolean): CSSProperties => ({
  padding: '8px 12px',
  borderRadius: 4,
  border: active ? '1px solid rgba(180,200,255,0.55)' : '1px solid rgba(255,255,255,0.12)',
  background: active ? 'rgba(120,150,220,0.22)' : 'rgba(0,0,0,0.25)',
  color: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
  textAlign: 'left',
})

const cardStyle = (selected: boolean): CSSProperties => ({
  ...chipStyle(selected),
  minWidth: 160,
  maxWidth: 220,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  lineHeight: 1.35,
})

export function BaseSetupWizard({ craft, onProceed }: BaseSetupWizardProps): JSX.Element {
  const [catalog, setCatalog] = useState<CoeCatalogResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<Step>('group')
  const [groupId, setGroupId] = useState<string | null>(null)
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<CoeCatalogItemResult | null>(null)
  const [itemLevel, setItemLevel] = useState(82)
  const [quality, setQuality] = useState(20)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (!craft.getCatalog) {
          setError('Catalog API missing — relaunch via Launch Scalpel.bat to rebuild.')
          return
        }
        const cat = await craft.getCatalog()
        if (!cancelled) setCatalog(cat)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [craft])

  const groups = useMemo(() => {
    if (!catalog) return []
    return [...catalog.groups].sort((a, b) => {
      if (a.craftable !== b.craftable) return a.craftable ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [catalog])

  const families = useMemo((): CoeCatalogFamilyResult[] => {
    if (!catalog || !groupId) return []
    return catalog.families.filter((f) => f.groupId === groupId).sort((a, b) => a.name.localeCompare(b.name))
  }, [catalog, groupId])

  const bases = useMemo((): CoeCatalogItemResult[] => {
    if (!catalog || !familyId) return []
    let list = catalog.items.filter((i) => i.familyId === familyId)
    const q = filter.trim().toLowerCase()
    if (q) list = list.filter((i) => i.name.toLowerCase().includes(q))
    return list.sort((a, b) => a.dropLevel - b.dropLevel || a.name.localeCompare(b.name))
  }, [catalog, familyId, filter])

  const groupName = groups.find((g) => g.id === groupId)?.name ?? ''
  const familyName = families.find((f) => f.id === familyId)?.name ?? ''

  const pickGroup = useCallback((id: string) => {
    setGroupId(id)
    setFamilyId(null)
    setSelectedItem(null)
    setFilter('')
    setStep('family')
  }, [])

  const pickFamily = useCallback((id: string) => {
    setFamilyId(id)
    setSelectedItem(null)
    setFilter('')
    setStep('bases')
  }, [])

  const pickBase = useCallback((item: CoeCatalogItemResult) => {
    setSelectedItem(item)
    setItemLevel(Math.max(item.dropLevel, 1))
    setStep('configure')
  }, [])

  const proceed = useCallback(async () => {
    if (!selectedItem || busy) return
    setBusy(true)
    setError(null)
    try {
      const state = await craft.freshState(selectedItem.name, itemLevel)
      onProceed(
        {
          baseType: selectedItem.name,
          itemLevel,
          quality,
          item: selectedItem,
          groupName,
          familyName,
        },
        state,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [selectedItem, busy, craft, itemLevel, quality, groupName, familyName, onProceed])

  if (error && !catalog) {
    return <ErrorBanner message={error} tone="warn" inline />
  }

  if (!catalog) {
    return <p style={{ margin: 0, fontSize: 12, opacity: 0.65 }}>Loading Craft of Exile base catalog…</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, flex: 1, overflow: 'auto' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
        <button
          type="button"
          onClick={() => {
            setStep('group')
            setGroupId(null)
            setFamilyId(null)
            setSelectedItem(null)
          }}
          style={chipStyle(step === 'group')}
        >
          1. Base group
        </button>
        <span style={{ opacity: 0.4 }}>→</span>
        <button
          type="button"
          disabled={!groupId}
          onClick={() => groupId && setStep('family')}
          style={chipStyle(step === 'family')}
        >
          2. Attribute / type{groupName ? `: ${groupName}` : ''}
        </button>
        <span style={{ opacity: 0.4 }}>→</span>
        <button
          type="button"
          disabled={!familyId}
          onClick={() => familyId && setStep('bases')}
          style={chipStyle(step === 'bases' || step === 'configure')}
        >
          3. Base{familyName ? `: ${familyName}` : ''}
        </button>
      </div>

      {error ? <ErrorBanner message={error} tone="warn" inline /> : null}

      {step === 'group' ? (
        <section>
          <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>Select Base Group</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {groups.map((g) => (
              <button key={g.id} type="button" onClick={() => pickGroup(g.id)} style={chipStyle(false)} disabled={!g.craftable}>
                {g.name}
                {!g.craftable ? <span style={{ opacity: 0.5 }}> (not craftable)</span> : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 'family' ? (
        <section>
          <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>Select Attribute Family — {groupName}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {families.map((f) => (
              <button key={f.id} type="button" onClick={() => pickFamily(f.id)} style={chipStyle(false)}>
                {f.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 'bases' || step === 'configure' ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, flex: 1 }}>Select Base — {familyName}</h3>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter bases…"
              style={{ ...inputStyle, maxWidth: 220 }}
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {bases.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => pickBase(item)}
                style={cardStyle(selectedItem?.id === item.id)}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <ItemIcon name={item.name} size={40} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <strong style={{ fontSize: 12 }}>{item.name}</strong>
                    <span style={{ fontSize: 11, opacity: 0.7 }}>ilvl drop {item.dropLevel}</span>
                  </div>
                </div>
                {catalogItemCardLines(item, quality)
                  .slice(0, 5)
                  .map((line) => (
                    <span key={line} style={{ fontSize: 11, opacity: 0.8 }}>
                      {line}
                    </span>
                  ))}
              </button>
            ))}
            {!bases.length ? <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>No bases match.</p> : null}
          </div>
        </section>
      ) : null}

      {step === 'configure' && selectedItem ? (
        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: 12,
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' }}>
            <ItemIcon name={selectedItem.name} size={36} />
            Configure — {selectedItem.name}
          </h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
              Item Level
              <input
                type="number"
                min={1}
                max={100}
                value={itemLevel}
                onChange={(e) => setItemLevel(Number(e.target.value) || 1)}
                style={{ ...inputStyle, width: 90 }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
              Quality %
              <input
                type="number"
                min={0}
                max={30}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value) || 0)}
                style={{ ...inputStyle, width: 90 }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
              Start rarity
              <select disabled style={{ ...selectStyle, opacity: 0.7 }} value="Normal">
                <option>Normal</option>
              </select>
            </label>
            <Button onClick={() => void proceed()} disabled={busy}>
              {busy ? 'Creating…' : 'Proceed to Simulation Sequence →'}
            </Button>
          </div>
          <p style={{ margin: 0, fontSize: 11, opacity: 0.55, lineHeight: 1.45 }}>
            Same flow as Craft of Exile: pick the base, set ilvl/quality, then configure the multi-step sequence
            (methods, conditions, success/failure branching).
          </p>
        </section>
      ) : null}
    </div>
  )
}
