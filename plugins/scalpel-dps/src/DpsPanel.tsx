import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { PoeItem, ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { computeHit, formatDps, formatPctDelta } from './calc'
import {
  blankWeapon,
  importSummary,
  isBlankSlot,
  isLikelyWeapon,
  rarityClass,
  readClipboardText,
  readWeaponFromOsClipboard,
  refreshParsedStats,
  weaponFromClipboardText,
  weaponFromItem,
  weaponKey,
} from './itemImport'
import { DPS_CSS } from './styles'
import { DEFAULT_GLOBALS, type CalcMode, type GlobalMods, type HitBreakdown, type WeaponStats } from './types'

type Slot = 'A' | 'B'

type Persisted = {
  weaponA: WeaponStats
  weaponB: WeaponStats
  globals: GlobalMods
}

function num(v: string, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function migrateWeapon(raw: Partial<WeaponStats> | undefined, slot: Slot): WeaponStats {
  return refreshParsedStats({
    ...blankWeapon(slot),
    ...raw,
    implicits: Array.isArray(raw?.implicits) ? raw!.implicits! : [],
    explicits: Array.isArray(raw?.explicits) ? raw!.explicits! : [],
    enchants: Array.isArray(raw?.enchants) ? raw!.enchants! : [],
    mode: raw?.mode === 'spell' ? 'spell' : 'attack',
  })
}

function Field(props: {
  label: string
  value: number
  onChange: (v: string) => void
  step?: string
}): ReactElement {
  return (
    <div className="sd-field">
      <label>{props.label}</label>
      <input
        type="number"
        step={props.step ?? 'any'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  )
}

function deltaRow(
  label: string,
  a: number,
  b: number,
  format: (n: number) => string,
): { label: string; text: string; cls: string } {
  const d = b - a
  const pct = a !== 0 ? (d / Math.abs(a)) * 100 : 0
  if (Math.abs(d) < 0.0005) return { label, text: '0', cls: 'flat' }
  const sign = d > 0 ? '+' : ''
  const pctSign = pct > 0 ? '+' : ''
  return {
    label,
    text: `${sign}${format(d)} (${pctSign}${pct.toFixed(1)}%)`,
    cls: d > 0 ? 'up' : 'down',
  }
}

function ModeToggle(props: {
  mode: CalcMode
  onChange: (mode: CalcMode) => void
}): ReactElement {
  return (
    <div className="sd-mode">
      <button
        type="button"
        className={props.mode === 'attack' ? 'active' : ''}
        onClick={() => props.onChange('attack')}
      >
        Attack
      </button>
      <button
        type="button"
        className={props.mode === 'spell' ? 'active' : ''}
        onClick={() => props.onChange('spell')}
      >
        Spell
      </button>
    </div>
  )
}

function ItemTooltip(props: {
  slot: Slot
  weapon: WeaponStats
  hit: HitBreakdown
  clipPreview: string
  onLoad: () => void
  onClear: () => void
  onChange: (next: WeaponStats) => void
}): ReactElement {
  const { weapon, hit } = props
  const empty = !weapon.label || weapon.label.startsWith('Weapon ')
  const rc = rarityClass(weapon.rarity)

  return (
    <div className="sd-tip">
      <div className="sd-tip-toolbar">
        <span className="sd-tip-slot">Weapon {props.slot}</span>
        <div className="sd-actions">
          <ModeToggle
            mode={weapon.mode}
            onChange={(mode) => props.onChange({ ...weapon, mode })}
          />
          <button type="button" className="sd-btn sd-btn-primary" onClick={props.onLoad}>
            Load captured
          </button>
          <button type="button" className="sd-btn sd-btn-ghost" onClick={props.onClear}>
            Clear
          </button>
        </div>
      </div>

      <div className={`sd-tooltip rarity-${rc}`}>
        {empty ? (
          <div className="sd-tip-empty">
            <p>Hover in PoE → Ctrl+C → Load {props.slot}. Game must be focused when you copy.</p>
            <p className="sd-tip-ready">{props.clipPreview}</p>
          </div>
        ) : (
          <>
            <div className={`sd-tip-name rarity-${rc}`}>{weapon.label}</div>
            <div className="sd-tip-base">{weapon.baseType || weapon.itemClass || 'Weapon'}</div>
            <div className="sd-tip-rule" />
            {weapon.enchants.map((line) => (
              <div key={`en-${line}`} className="sd-tip-mod enchant">
                {line}
                {weapon.enchantAttackSpeed > 0 ? `  → +${weapon.enchantAttackSpeed}% AS @ ${weapon.quality}% quality` : ''}
              </div>
            ))}
            {weapon.enchants.length > 0 ? <div className="sd-tip-rule" /> : null}
            {weapon.implicits.map((line) => (
              <div key={`i-${line}`} className="sd-tip-mod implicit">
                {line}
              </div>
            ))}
            {weapon.implicits.length > 0 && weapon.explicits.length > 0 ? (
              <div className="sd-tip-rule" />
            ) : null}
            {weapon.explicits.map((line) => (
              <div key={`e-${line}`} className="sd-tip-mod">
                {line}
              </div>
            ))}
            {weapon.implicits.length === 0 && weapon.explicits.length === 0 ? (
              <div className="sd-tip-mod faint">No mod lines stored — stats still calculated.</div>
            ) : null}
            <div className="sd-tip-rule" />
            <div className="sd-tip-stats">
              <div>
                <span>Hit</span>
                <strong>{formatDps(hit.avgHit)}</strong>
              </div>
              <div>
                <span>{hit.mode === 'spell' ? 'Cast/s' : 'APS'}</span>
                <strong>{hit.aps.toFixed(2)}</strong>
              </div>
              <div>
                <span>Crit</span>
                <strong>{hit.critChance.toFixed(1)}%</strong>
              </div>
              <div>
                <span>DPS</span>
                <strong className="dps">{formatDps(hit.totalDps)}</strong>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ComparePanel(props: {
  nameA: string
  nameB: string
  hitA: HitBreakdown
  hitB: HitBreakdown
  weaponA: WeaponStats
  weaponB: WeaponStats
  poe: 1 | 2
}): ReactElement {
  const encA = props.weaponA.enchants.join(' / ') || '(none)'
  const encB = props.weaponB.enchants.join(' / ') || '(none)'
  const encSame = encA === encB

  const rows = [
    deltaRow('Average Hit', props.hitA.avgHit, props.hitB.avgHit, formatDps),
    deltaRow(
      props.hitA.mode === 'spell' || props.hitB.mode === 'spell' ? 'Cast Rate' : 'Attack Rate',
      props.hitA.aps,
      props.hitB.aps,
      (n) => n.toFixed(2),
    ),
    deltaRow('Crit Chance', props.hitA.critChance, props.hitB.critChance, (n) => `${n.toFixed(2)}%`),
    deltaRow('Hit DPS', props.hitA.totalDps, props.hitB.totalDps, formatDps),
    deltaRow('Spell damage %', props.weaponA.incSpellDamage, props.weaponB.incSpellDamage, (n) =>
      n.toFixed(0),
    ),
    deltaRow('Crit multi (item)', props.weaponA.extraCritMulti, props.weaponB.extraCritMulti, (n) =>
      `${n.toFixed(0)}%`,
    ),
    deltaRow(
      'Attack speed (as cast)',
      props.weaponA.incAttackSpeed + props.weaponA.enchantAttackSpeed,
      props.weaponB.incAttackSpeed + props.weaponB.enchantAttackSpeed,
      (n) => `${n.toFixed(0)}%`,
    ),
  ]

  return (
    <section className="sd-compare">
      <h3>
        Equipping <em>{props.nameB || 'Weapon B'}</em> instead of{' '}
        <em>{props.nameA || 'Weapon A'}</em> will give you:
      </h3>
      <ul>
        <li>
          <span className="lab">Enchant</span>
          <span className={`val ${encSame ? 'flat' : 'up'}`}>{encSame ? 'same' : `${encA} → ${encB}`}</span>
        </li>
        {rows.map((r) => (
          <li key={r.label}>
            <span className="lab">{r.label}</span>
            <span className={`val ${r.cls}`}>{r.text}</span>
          </li>
        ))}
      </ul>
      <div className="sd-compare-foot">
        {props.poe === 1
          ? 'PoE1 spell mode: local attack speed + quality AS enchant count as cast speed. '
          : 'PoE2 spell mode: only increased Cast Speed affects cast rate. '}
        Global crit multi and per-int spell damage apply. Local attack adds/pen are Attack mode.
        B vs A total DPS:{' '}
        <strong className={props.hitB.totalDps >= props.hitA.totalDps ? 'up' : 'down'}>
          {formatPctDelta(props.hitA.totalDps, props.hitB.totalDps)}
        </strong>
      </div>
    </section>
  )
}

export function DpsPanel({ ctx }: { ctx: ScalpelPluginContext }): ReactElement {
  const poe = ctx.getPoeVersion()
  const [weaponA, setWeaponA] = useState<WeaponStats>(() => blankWeapon('A'))
  const [weaponB, setWeaponB] = useState<WeaponStats>(() => blankWeapon('B'))
  const [globals, setGlobals] = useState<GlobalMods>(DEFAULT_GLOBALS)
  const [status, setStatus] = useState(
    'In PoE: hover weapon → Ctrl+C → Load A. Then hover the other → Ctrl+C → Load B.',
  )
  const [statusErr, setStatusErr] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [clipPreview, setClipPreview] = useState<string>('Clipboard: (empty)')
  const [showBaseline, setShowBaseline] = useState(true)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteSlot, setPasteSlot] = useState<Slot>('B')
  const lastCaptureRef = useRef<{ key: string; weapon: WeaponStats } | null>(null)
  const usedKeysRef = useRef<Set<string>>(new Set())
  const weaponARef = useRef(weaponA)
  const weaponBRef = useRef(weaponB)
  weaponARef.current = weaponA
  weaponBRef.current = weaponB

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const saved = await ctx.storage.get<Persisted>('state')
      if (cancelled || !saved) {
        setHydrated(true)
        return
      }
      if (saved.weaponA) setWeaponA(migrateWeapon(saved.weaponA, 'A'))
      if (saved.weaponB) setWeaponB(migrateWeapon(saved.weaponB, 'B'))
      if (saved.globals) setGlobals({ ...DEFAULT_GLOBALS, ...saved.globals })
      setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [ctx])

  useEffect(() => {
    if (!hydrated) return
    void ctx.storage.set('state', { weaponA, weaponB, globals } satisfies Persisted)
  }, [ctx, hydrated, weaponA, weaponB, globals])

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      const text = await readClipboardText()
      if (cancelled) return
      const w = weaponFromClipboardText(text)
      setClipPreview(w ? `Clipboard: ${w.label}` : text.trim() ? 'Clipboard: not a weapon' : 'Clipboard: (empty)')
    }
    void tick()
    const id = window.setInterval(() => void tick(), 800)
    const onFocus = () => void tick()
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  useEffect(() => {
    return ctx.onCurrentItem((item: PoeItem) => {
      if (!isLikelyWeapon(item)) return
      const w = weaponFromItem(item)
      lastCaptureRef.current = { key: weaponKey(w), weapon: w }
      setClipPreview(`Scalpel capture: ${w.label}`)
      setStatus(`New capture: ${w.label} — Load A or B (used once, then you must copy the other item)`)
      setStatusErr(false)
    })
  }, [ctx])

  const applyWeapon = (slot: Slot, w: WeaponStats) => {
    usedKeysRef.current.add(weaponKey(w))
    if (slot === 'A') setWeaponA(w)
    else setWeaponB(w)
    setStatus(`Loaded → ${slot}: ${w.label} (${importSummary(w)})`)
    setStatusErr(false)
    setPasteOpen(false)
    setPasteText('')
  }

  const rejectSame = (slot: Slot, w: WeaponStats): boolean => {
    const other = slot === 'A' ? weaponBRef.current : weaponARef.current
    if (isBlankSlot(other)) return false
    if (weaponKey(other) !== weaponKey(w)) return false
    setStatus(
      `Still "${w.label}" — that's already Weapon ${slot === 'A' ? 'B' : 'A'}. Hover the OTHER item in PoE, Ctrl+C, then Load ${slot}.`,
    )
    setStatusErr(true)
    return true
  }

  const loadTo = async (slot: Slot) => {
    setPasteSlot(slot)
    const clip = await readWeaponFromOsClipboard()
    if (clip.ok) {
      if (rejectSame(slot, clip.weapon)) return
      applyWeapon(slot, clip.weapon)
      lastCaptureRef.current = null
      return
    }

    const cap = lastCaptureRef.current
    if (cap && !usedKeysRef.current.has(cap.key)) {
      if (rejectSame(slot, cap.weapon)) return
      lastCaptureRef.current = null
      applyWeapon(slot, cap.weapon)
      return
    }

    setStatus(
      `${clip.reason} Copy a NEW item in-game (Ctrl+C with PoE focused), then Load ${slot}. ${clipPreview}`,
    )
    setStatusErr(true)
    setPasteOpen(true)
  }

  const importPaste = () => {
    const w = weaponFromClipboardText(pasteText)
    if (!w) {
      setStatus('Paste full PoE item text (needs Item Class + --------).')
      setStatusErr(true)
      return
    }
    if (rejectSame(pasteSlot, w)) return
    applyWeapon(pasteSlot, w)
  }

  const setGlobal = (key: keyof GlobalMods, raw: string) => {
    setGlobals((g) => ({ ...g, [key]: num(raw) }))
  }

  const parsedA = refreshParsedStats(weaponA)
  const parsedB = refreshParsedStats(weaponB)
  const hitA = computeHit(parsedA, globals, poe)
  const hitB = computeHit(parsedB, globals, poe)
  const anySpell = weaponA.mode === 'spell' || weaponB.mode === 'spell'

  return (
    <div className="sd-root">
      <style>{DPS_CSS}</style>
      <header className="sd-header">
        <div className="sd-title-row">
          <div>
            <h1 className="sd-title">
              Scalpel DPS <span className="sd-ver">PoE{poe}</span>
            </h1>
            <p className="sd-sub">
              Hover in PoE → Ctrl+C → Load A. Then hover the other weapon → Ctrl+C → Load B.
            </p>
          </div>
          <div className="sd-actions">
            <button type="button" className="sd-btn sd-btn-primary" onClick={() => void loadTo('A')}>
              Load → A
            </button>
            <button type="button" className="sd-btn sd-btn-primary" onClick={() => void loadTo('B')}>
              Load → B
            </button>
            <button
              type="button"
              className="sd-btn sd-btn-ghost"
              onClick={() => setPasteOpen((v) => !v)}
            >
              Paste…
            </button>
            <button
              type="button"
              className="sd-btn sd-btn-ghost"
              onClick={() => {
                setWeaponA(blankWeapon('A'))
                setWeaponB(blankWeapon('B'))
                setGlobals(DEFAULT_GLOBALS)
                usedKeysRef.current.clear()
                lastCaptureRef.current = null
                setStatus('Reset.')
                setStatusErr(false)
              }}
            >
              Reset
            </button>
          </div>
        </div>
        <div className={`sd-status${statusErr ? ' sd-status-err' : ''}`}>{status}</div>
        <div className="sd-clip">{clipPreview}</div>
      </header>

      <div className="sd-body">
        {pasteOpen && (
          <section className="sd-paste">
            <div className="sd-card-head">
              <h3 className="sd-card-title">Paste item → {pasteSlot}</h3>
              <div className="sd-actions">
                <button type="button" className="sd-btn" onClick={() => setPasteSlot('A')}>
                  A
                </button>
                <button type="button" className="sd-btn" onClick={() => setPasteSlot('B')}>
                  B
                </button>
                <button type="button" className="sd-btn sd-btn-primary" onClick={importPaste}>
                  Parse
                </button>
              </div>
            </div>
            <textarea
              className="sd-paste-area"
              rows={6}
              placeholder="Only if Ctrl+D is unavailable — paste full Ctrl+C item text"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
          </section>
        )}

        <div className="sd-tips">
          <ItemTooltip
            slot="A"
            weapon={parsedA}
            hit={hitA}
            clipPreview={clipPreview}
            onLoad={() => void loadTo('A')}
            onClear={() => setWeaponA(blankWeapon('A'))}
            onChange={setWeaponA}
          />
          <ItemTooltip
            slot="B"
            weapon={parsedB}
            hit={hitB}
            clipPreview={clipPreview}
            onLoad={() => void loadTo('B')}
            onClear={() => setWeaponB(blankWeapon('B'))}
            onChange={setWeaponB}
          />
        </div>

        <ComparePanel
          nameA={parsedA.label}
          nameB={parsedB.label}
          hitA={hitA}
          hitB={hitB}
          weaponA={parsedA}
          weaponB={parsedB}
          poe={poe}
        />

        <section className="sd-baseline">
          <button
            type="button"
            className="sd-baseline-toggle"
            onClick={() => setShowBaseline((v) => !v)}
          >
            {showBaseline ? '▾' : '▸'} Character / skill baseline
          </button>
          {showBaseline && (
            <div className="sd-globals-grid">
              {anySpell ? (
                <>
                  <Field
                    label="Character INT"
                    value={globals.characterInt}
                    onChange={(v) => setGlobal('characterInt', v)}
                  />
                  <Field
                    label="Skill hit avg"
                    value={globals.skillHitAvg}
                    onChange={(v) => setGlobal('skillHitAvg', v)}
                  />
                  <Field
                    label="Casts / sec"
                    value={globals.skillCastsPerSec}
                    onChange={(v) => setGlobal('skillCastsPerSec', v)}
                    step="0.01"
                  />
                  <Field
                    label="Skill crit %"
                    value={globals.skillCritChance}
                    onChange={(v) => setGlobal('skillCritChance', v)}
                    step="0.1"
                  />
                  <Field
                    label="Inc. spell % (char)"
                    value={globals.increasedSpell}
                    onChange={(v) => setGlobal('increasedSpell', v)}
                  />
                  <Field
                    label="Inc. cast % (char)"
                    value={globals.increasedCastSpeed}
                    onChange={(v) => setGlobal('increasedCastSpeed', v)}
                  />
                  <Field
                    label="More spell %"
                    value={globals.moreSpell}
                    onChange={(v) => setGlobal('moreSpell', v)}
                  />
                  <Field
                    label="≈% more / +1 gem lv"
                    value={globals.approxMorePerSpellLevel}
                    onChange={(v) => setGlobal('approxMorePerSpellLevel', v)}
                  />
                </>
              ) : null}
              <Field
                label="Inc. phys %"
                value={globals.increasedPhys}
                onChange={(v) => setGlobal('increasedPhys', v)}
              />
              <Field
                label="Inc. ele %"
                value={globals.increasedEle}
                onChange={(v) => setGlobal('increasedEle', v)}
              />
              <Field
                label="Inc. attack speed %"
                value={globals.increasedAttackSpeed}
                onChange={(v) => setGlobal('increasedAttackSpeed', v)}
              />
              <Field
                label="Crit multi %"
                value={globals.critMulti}
                onChange={(v) => setGlobal('critMulti', v)}
              />
              <Field
                label="More damage %"
                value={globals.moreDamage}
                onChange={(v) => setGlobal('moreDamage', v)}
              />
              <Field
                label="Enemy resist %"
                value={globals.enemyResist}
                onChange={(v) => setGlobal('enemyResist', v)}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
