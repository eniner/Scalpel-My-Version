import type { ModPoolReport } from './ModCheatSheet.types'
import type { ModGroupReport, ModPoolSection } from './ModCheatSheet.types'
import { pct } from './craft-utils'

export type { ModPoolReport, ModGroupReport, ModPoolSection }

export const BASE_GROUPS = [
  'Body Armours',
  'Boots',
  'Charms',
  'Flasks',
  'Gloves',
  'Helmets',
  'Jewellery',
  'Jewels',
  'Offhands',
  'One-Handed Weapons',
  'Tablets',
  'Two-Handed Weapons',
  'Waystones',
] as const

const TAG_COLORS: Record<string, string> = {
  life: '#e85d5d',
  mana: '#5d8de8',
  fire: '#e87040',
  cold: '#5dc8e8',
  lightning: '#e8d040',
  chaos: '#b070e8',
  physical: '#c8c8c8',
  attack: '#e8a050',
  caster: '#70b0e8',
  defences: '#70e8a0',
  elemental: '#e8c070',
  attribute: '#a0a0e8',
  speed: '#70e8e8',
  critical: '#e87070',
  damage: '#e89850',
  resistance: '#88c8e8',
  ailment: '#e888c8',
}

export function tagColor(tag: string): string {
  const key = tag.toLowerCase().replace(/^non-/, '')
  return TAG_COLORS[key] ?? '#888898'
}

export function poolLabel(pool?: string): string {
  if (pool === 'marksman') return 'Marksman'
  if (pool === 'desecrated') return 'Desecrated'
  return 'Craft'
}

function groupMatchesFilters(
  group: ModGroupReport,
  search: string,
  activeTags: Set<string>,
): boolean {
  if (activeTags.size > 0) {
    const tags = group.tags ?? []
    if (!tags.some((t) => activeTags.has(t))) return false
  }
  if (!search.trim()) return true
  const q = search.trim().toLowerCase()
  const hay = [
    group.displayName,
    group.group,
    group.bestTierText,
    ...(group.tags ?? []),
    ...group.tiers.map((t) => `${t.name} ${t.text}`),
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

function AffixColumn({
  section,
  grandTotal,
  search,
  activeTags,
  expanded,
  onToggle,
  showPool,
}: {
  section: ModPoolSection
  grandTotal: number
  search: string
  activeTags: Set<string>
  expanded: Set<string>
  onToggle: (key: string) => void
  showPool: boolean
}): JSX.Element {
  const isPrefix = section.kind === 'p'
  const headerColor = isPrefix ? '#9b7fd4' : '#5d8de8'
  const affixPct = grandTotal > 0 ? section.totalWeight / grandTotal : 0
  const filtered = section.groups.filter((g) => groupMatchesFilters(g, search, activeTags))

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        style={{
          padding: '8px 10px',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: headerColor,
          borderBottom: `2px solid ${headerColor}`,
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        {section.label.toUpperCase()}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ textAlign: 'left', opacity: 0.65, background: 'rgba(0,0,0,0.2)' }}>
            <th style={{ padding: '5px 6px', width: 20 }} />
            <th style={{ padding: '5px 6px' }}>Base</th>
            <th style={{ padding: '5px 6px', textAlign: 'right' }}>Tiers</th>
            <th style={{ padding: '5px 6px', textAlign: 'right' }}>iLvl</th>
            <th style={{ padding: '5px 6px', textAlign: 'right' }}>Weight</th>
            <th style={{ padding: '5px 6px', textAlign: 'right' }}>{isPrefix ? 'Prefix' : 'Suffix'} %</th>
            <th style={{ padding: '5px 6px', textAlign: 'right' }}>Weight %</th>
          </tr>
          <tr style={{ fontWeight: 600, background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <td />
            <td style={{ padding: '5px 6px' }}>Total</td>
            <td style={{ padding: '5px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{section.modCount}</td>
            <td style={{ padding: '5px 6px' }} />
            <td style={{ padding: '5px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {section.totalWeight.toLocaleString()}
            </td>
            <td style={{ padding: '5px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct(affixPct)}</td>
            <td style={{ padding: '5px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct(affixPct)}</td>
          </tr>
        </thead>
        <tbody>
          {filtered.map((g) => {
            const key = `${g.tiers[0]?.pool ?? 'craft'}:${g.kind}:${g.group}`
            const open = expanded.has(key) || Boolean(search.trim())
            const weightPct = grandTotal > 0 ? g.groupWeight / grandTotal : 0
            return (
              <GroupRows
                key={key}
                group={g}
                open={open}
                weightPct={weightPct}
                showPool={showPool}
                onToggle={() => onToggle(key)}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function GroupRows({
  group,
  open,
  weightPct,
  showPool,
  onToggle,
}: {
  group: ModGroupReport
  open: boolean
  weightPct: number
  showPool: boolean
  onToggle: () => void
}): JSX.Element {
  return (
    <>
      <tr
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}
        onClick={onToggle}
      >
        <td style={{ padding: '5px 6px', opacity: 0.6 }}>{open ? '▾' : '▸'}</td>
        <td style={{ padding: '5px 6px' }}>
          <div>{group.displayName || group.group}</div>
          {(group.tags?.length ?? 0) > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
              {group.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 9,
                    padding: '1px 5px',
                    borderRadius: 2,
                    background: tagColor(tag),
                    color: '#111',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                  }}
                >
                  {tag}
                </span>
              ))}
              {showPool && group.tiers[0]?.pool && group.tiers[0].pool !== 'craft' ? (
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 2, background: '#444', color: '#ddd' }}>
                  {poolLabel(group.tiers[0].pool)}
                </span>
              ) : null}
            </div>
          ) : null}
        </td>
        <td style={{ padding: '5px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{group.tierCount}</td>
        <td style={{ padding: '5px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{group.bestTierIlvl}</td>
        <td style={{ padding: '5px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          {group.groupWeight.toLocaleString()}
        </td>
        <td style={{ padding: '5px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct(group.groupChance)}</td>
        <td style={{ padding: '5px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct(weightPct)}</td>
      </tr>
      {open
        ? group.tiers.map((t) => (
            <tr key={t.id} style={{ background: 'rgba(255,255,255,0.02)', fontSize: 10 }}>
              <td />
              <td style={{ padding: '4px 6px 4px 18px', opacity: 0.85 }} colSpan={2}>
                <span style={{ opacity: 0.55, marginRight: 6 }}>{t.name}</span>
                {t.text}
              </td>
              <td style={{ padding: '4px 6px', textAlign: 'right', opacity: 0.7 }}>{t.ilvl}</td>
              <td style={{ padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.spawnWeight}</td>
              <td style={{ padding: '4px 6px', textAlign: 'right', opacity: 0.65 }}>{pct(t.tierChance)}</td>
              <td style={{ padding: '4px 6px', textAlign: 'right', opacity: 0.65 }}>{pct(t.overallChance)}</td>
            </tr>
          ))
        : null}
    </>
  )
}

export function WeightTableLayout({
  report,
  search,
  activeTags,
  expanded,
  onToggle,
  showPool,
}: {
  report: ModPoolReport
  search: string
  activeTags: Set<string>
  expanded: Set<string>
  onToggle: (key: string) => void
  showPool: boolean
}): JSX.Element {
  const sections = report.sections ?? []
  const grandTotal = sections.reduce((s, sec) => s + sec.totalWeight, 0)
  const prefix = sections.find((s) => s.kind === 'p')
  const suffix = sections.find((s) => s.kind === 's')

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 8, overflow: 'hidden' }}>
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4 }}>
        {prefix ? (
          <AffixColumn
            section={prefix}
            grandTotal={grandTotal}
            search={search}
            activeTags={activeTags}
            expanded={expanded}
            onToggle={onToggle}
            showPool={showPool}
          />
        ) : (
          <p style={{ padding: 10, opacity: 0.5, margin: 0 }}>No prefixes</p>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4 }}>
        {suffix ? (
          <AffixColumn
            section={suffix}
            grandTotal={grandTotal}
            search={search}
            activeTags={activeTags}
            expanded={expanded}
            onToggle={onToggle}
            showPool={showPool}
          />
        ) : (
          <p style={{ padding: 10, opacity: 0.5, margin: 0 }}>No suffixes</p>
        )}
      </div>
    </div>
  )
}

export function collectTagsFromReport(report: ModPoolReport): string[] {
  const tags = new Set<string>()
  for (const g of report.groups) {
    for (const t of g.tags ?? []) tags.add(t)
  }
  return [...tags].sort()
}
