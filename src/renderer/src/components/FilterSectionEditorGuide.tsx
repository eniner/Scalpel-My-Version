import { useMemo, useState } from 'react'

type GuideSectionId =
  | 'overview'
  | 'quickstart'
  | 'modes'
  | 'editing'
  | 'workflow'
  | 'match'
  | 'strictness'
  | 'economy'
  | 'safety'
  | 'keyboard'
  | 'tips'

const TOC: Array<{ id: GuideSectionId; label: string }> = [
  { id: 'overview', label: 'What this is' },
  { id: 'quickstart', label: 'Quick start' },
  { id: 'modes', label: 'Browse / Edit / Advanced' },
  { id: 'editing', label: 'Day-to-day editing' },
  { id: 'workflow', label: 'Diagnose → Fix → Verify' },
  { id: 'match', label: 'What wins? & Make this win' },
  { id: 'strictness', label: 'Strictness & re-apply' },
  { id: 'economy', label: 'Prices & economy' },
  { id: 'safety', label: 'Undo, checkpoints, preflight' },
  { id: 'keyboard', label: 'Keyboard shortcuts' },
  { id: 'tips', label: 'Tips & gotchas' },
]

const h2: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: 16,
  fontWeight: 700,
  color: '#c9a227',
}

const h3: React.CSSProperties = {
  margin: '16px 0 6px',
  fontSize: 13,
  fontWeight: 700,
  color: '#f0e6d2',
}

const p: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: 13,
  lineHeight: 1.55,
  color: '#c8c4bc',
}

const ul: React.CSSProperties = {
  margin: '0 0 12px',
  paddingLeft: 18,
  fontSize: 13,
  lineHeight: 1.55,
  color: '#c8c4bc',
}

const callout: React.CSSProperties = {
  margin: '0 0 14px',
  padding: '10px 12px',
  borderRadius: 8,
  background: 'rgba(201,162,39,0.1)',
  border: '1px solid rgba(201,162,39,0.35)',
  fontSize: 13,
  lineHeight: 1.5,
  color: '#e8d48b',
}

const kbd: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  margin: '0 2px',
  borderRadius: 4,
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.14)',
  fontSize: 11,
  color: '#c9a227',
  fontFamily: 'ui-monospace, Consolas, monospace',
}

function K({ children }: { children: string }): JSX.Element {
  return <span style={kbd}>{children}</span>
}

/** In-editor user guide for the Filter Section Editor. */
export function FilterSectionEditorGuide({
  onGoEdit,
  onGoAdvanced,
}: {
  onGoEdit?: () => void
  onGoAdvanced?: () => void
}): JSX.Element {
  const [active, setActive] = useState<GuideSectionId>('overview')

  const body = useMemo(() => {
    switch (active) {
      case 'overview':
        return (
          <>
            <h2 style={h2}>What this is</h2>
            <p style={p}>
              The <strong style={{ color: '#f0e6d2' }}>Filter Section Editor</strong> is Scalpel’s large-window
              workspace for NeverSink-style loot filters. It lets you move BaseTypes between tiers, change Show/Hide,
              edit conditions and styles, and verify what an item will look like — without digging through the raw{' '}
              <code>.filter</code> file.
            </p>
            <p style={p}>
              Edits write to your <strong style={{ color: '#f0e6d2' }}>local filter file</strong> and can reload
              in-game. This editor does <strong style={{ color: '#f0e6d2' }}>not</strong> switch your active in-game
              filter to an OnlineFilters Strictness copy (that was a common footgun and was removed).
            </p>
            <div style={callout}>
              Core idea: <strong>file order = who wins</strong>. Rules earlier in the file match first. Tier letters
              (S/A/B/C…) are labels — ↑/↓ reorder is what changes priority.
            </div>
          </>
        )
      case 'quickstart':
        return (
          <>
            <h2 style={h2}>Quick start</h2>
            <ol style={{ ...ul, listStyle: 'decimal' }}>
              <li>
                Open Settings → Filter → <strong style={{ color: '#f0e6d2' }}>Open large editor</strong>.
              </li>
              <li>Pick a group (e.g. Currency), then a section from the dropdown.</li>
              <li>
                Switch to <strong style={{ color: '#f0e6d2' }}>Edit</strong>. Expand a tier, drag items between tiers,
                or multi-select and bump with Arrow keys.
              </li>
              <li>
                Use the <strong style={{ color: '#f0e6d2' }}>section sticky bar</strong> for Hide ≤C, Sort by price,
                Undo section, Checkpoint, and Style.
              </li>
              <li>
                When something looks wrong in-game, go <strong style={{ color: '#f0e6d2' }}>Advanced</strong> → Workflow{' '}
                <em>Diagnose</em> → paste or “From game” → <em>Make this win</em> if needed → <em>Verify</em> with the
                loot suite.
              </li>
            </ol>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {onGoEdit && (
                <button type="button" onClick={onGoEdit} style={{ fontSize: 12, minHeight: 32, padding: '6px 12px' }}>
                  Go to Edit
                </button>
              )}
              {onGoAdvanced && (
                <button
                  type="button"
                  onClick={onGoAdvanced}
                  style={{ fontSize: 12, minHeight: 32, padding: '6px 12px' }}
                >
                  Go to Advanced
                </button>
              )}
            </div>
          </>
        )
      case 'modes':
        return (
          <>
            <h2 style={h2}>Browse / Edit / Advanced / Guide</h2>
            <h3 style={h3}>Browse</h3>
            <p style={p}>Navigate sections and toggle Show/Hide. Safe for exploring without accidental moves.</p>
            <h3 style={h3}>Edit</h3>
            <p style={p}>
              Day-to-day work: drag BaseTypes, multi-select, bump tiers, add rules, edit conditions, open the style
              picker. Sticky section actions stay available here.
            </p>
            <h3 style={h3}>Advanced</h3>
            <p style={p}>
              Power tools behind a short <strong style={{ color: '#f0e6d2' }}>Workflow</strong> (Diagnose → Fix →
              Verify). Everything else lives under <strong style={{ color: '#f0e6d2' }}>More tools</strong> so the
              toolbar stays readable.
            </p>
            <h3 style={h3}>Guide</h3>
            <p style={p}>
              This help tab. Press <K>?</K> anytime for the keyboard shortcut overlay.
            </p>
          </>
        )
      case 'editing':
        return (
          <>
            <h2 style={h2}>Day-to-day editing</h2>
            <h3 style={h3}>Moving items</h3>
            <ul style={ul}>
              <li>Drag a BaseType onto another tier (or another section’s drop target).</li>
              <li>
                Multi-select with click, then use the bump pills or <K>↑</K>/<K>↓</K>.
              </li>
              <li>Conflict-aware moves warn when an earlier rule will still win.</li>
            </ul>
            <h3 style={h3}>Tiers &amp; file order</h3>
            <ul style={ul}>
              <li>
                <K>↑</K>/<K>↓</K> on a tier row reorders the whole rule in the filter file (earlier = matches sooner).
              </li>
              <li>Show/Hide only changes visibility — it does not change match priority.</li>
              <li>Duplicate creates a sibling rule; Add rule can clone conditions from another tier.</li>
            </ul>
            <h3 style={h3}>Conditions &amp; style</h3>
            <ul style={ul}>
              <li>Expand a tier to edit StackSize, Class, Rarity, etc., or apply a saved condition preset.</li>
              <li>Style opens colors, font, beams, built-in/custom sounds, and a visual minimap picker.</li>
              <li>Continue parents are shown when a tier inherits style from earlier Continue blocks.</li>
            </ul>
          </>
        )
      case 'workflow':
        return (
          <>
            <h2 style={h2}>Diagnose → Fix → Verify</h2>
            <p style={p}>In Advanced, use the Workflow strip as your loop after a Strictness update or a weird drop:</p>
            <ol style={{ ...ul, listStyle: 'decimal' }}>
              <li>
                <strong style={{ color: '#f0e6d2' }}>Diagnose</strong> — opens What wins? and Filmstrip. Paste a PoE
                item or use From game / filmstrip cards.
              </li>
              <li>
                <strong style={{ color: '#f0e6d2' }}>Fix</strong> — opens Strictness migrate, Economy policy, and Batch
                apply.
              </li>
              <li>
                <strong style={{ color: '#f0e6d2' }}>Verify</strong> — opens the loot regression Suite and Preflight
                scan.
              </li>
            </ol>
            <div style={callout}>
              Sticky bar on every section: Hide ≤C, Show S–A, Sort by price, Undo section, Checkpoint, Style, and Open
              toolkit (Currency / Uniques / Maps suggestions).
            </div>
          </>
        )
      case 'match':
        return (
          <>
            <h2 style={h2}>What wins? &amp; Make this win</h2>
            <p style={p}>
              The match debugger shows the first-match map: Continue chain → ★ winner → shadowed later rules. That
              answers “why does this Chaos Orb look like trash?”
            </p>
            <ul style={ul}>
              <li>
                <strong style={{ color: '#f0e6d2' }}>Paste PoE item</strong> or drop clipboard text into the box.
              </li>
              <li>
                <strong style={{ color: '#f0e6d2' }}>From game</strong> uses the last item Scalpel evaluated (Ctrl+C).
              </li>
              <li>
                <strong style={{ color: '#f0e6d2' }}>Make this win</strong> on a shadowed step inserts a Show rule above
                the current winner, cloning that step’s style/conditions.
              </li>
              <li>Filmstrip shows recent evaluated items; click one to inspect.</li>
              <li>
                Suite pins samples and re-runs after changes — flag regressions, then Accept as baseline when correct.
              </li>
            </ul>
          </>
        )
      case 'strictness':
        return (
          <>
            <h2 style={h2}>Strictness &amp; re-apply</h2>
            <h3 style={h3}>Strictness / filter diff</h3>
            <p style={p}>
              Compare two filters (usually your local vs Soft). Check sections, choose add BaseTypes / match visibility
              / remove extras, then Apply selected. Deltas pull from the <em>right</em> filter into your current (left)
              file.
            </p>
            <h3 style={h3}>Re-apply</h3>
            <p style={p}>
              Replays your recorded section intents onto the matching OnlineFilters copy — local file only, no in-game
              filter switch. Preflight errors block apply; warnings ask to confirm.
            </p>
            <h3 style={h3}>Edit pack</h3>
            <p style={p}>
              Export/import your intent JSON to move “my Currency tweaks” between machines or filters. Import merges or
              replaces; use Re-apply to replay onto a new Strictness.
            </p>
          </>
        )
      case 'economy':
        return (
          <>
            <h2 style={h2}>Prices &amp; economy</h2>
            <ul style={ul}>
              <li>
                <strong style={{ color: '#f0e6d2' }}>Sort price</strong> orders BaseTypes in the open section by league
                chaos value.
              </li>
              <li>
                <strong style={{ color: '#f0e6d2' }}>Nudges</strong> lists pricey items stuck in low/hidden tiers for
                one-click bump.
              </li>
              <li>
                <strong style={{ color: '#f0e6d2' }}>Policy</strong> previews tiers that hold items below/above a chaos
                threshold, then applies Show/Hide/Minimal to those tiers.
              </li>
            </ul>
            <p style={p}>League comes from your active Scalpel profile. Prices load in the background (capped list).</p>
          </>
        )
      case 'safety':
        return (
          <>
            <h2 style={h2}>Undo, checkpoints, preflight</h2>
            <ul style={ul}>
              <li>
                <K>Ctrl+Z</K> / Undo undoes the last filter snapshot. Toasts after bulk actions offer Undo.
              </li>
              <li>
                <strong style={{ color: '#f0e6d2' }}>Undo section</strong> undoes consecutive history entries tagged to
                the current section.
              </li>
              <li>
                <strong style={{ color: '#f0e6d2' }}>Checkpoint</strong> / named Checkpoints panel save restore points
                (e.g. “pre-Soft migrate”).
              </li>
              <li>
                <strong style={{ color: '#f0e6d2' }}>Preflight</strong> finds empty BaseType lists, catch-all rules,
                missing custom sounds, identical adjacent minimaps.
              </li>
              <li>
                <strong style={{ color: '#f0e6d2' }}>Confirm bulk edits</strong> (comfort row) asks before Hide ≤C /
                similar bulk visibility changes.
              </li>
            </ul>
            <div style={callout}>
              Edits save to disk as you go. “Changed since open” means the file differs from when you opened the editor
              — not that something is unsaved.
            </div>
          </>
        )
      case 'keyboard':
        return (
          <>
            <h2 style={h2}>Keyboard shortcuts</h2>
            <p style={p}>
              Press <K>?</K> for the overlay. Shortcuts are ignored while typing in inputs.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: '#c8c4bc' }}>
              <tbody>
                {(
                  [
                    ['?', 'Open this shortcuts overlay'],
                    ['/', 'Focus search'],
                    ['j / k', 'Next / previous section'],
                    ['a', 'Open Add rule'],
                    ['m', 'Jump to What wins? (Advanced)'],
                    ['s', 'Toggle Show/Hide on selected items’ tiers'],
                    ['↑ / ↓', 'Bump selected BaseTypes between tiers'],
                    ['Delete', 'Remove selected BaseTypes'],
                    ['Ctrl+Z', 'Undo last edit'],
                    ['Esc', 'Close window (unpins first if pinned)'],
                  ] as Array<[string, string]>
                ).map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ padding: '6px 8px 6px 0', verticalAlign: 'top', width: 110 }}>
                      <K>{k}</K>
                    </td>
                    <td style={{ padding: '6px 0' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )
      case 'tips':
        return (
          <>
            <h2 style={h2}>Tips &amp; gotchas</h2>
            <ul style={ul}>
              <li>Pin the window if you alt-tab to PoE a lot; enable Hide on map to auto-close in zones.</li>
              <li>Missing sound badges mean CustomAlertSound files aren’t in your filter folder / sounds/.</li>
              <li>Section templates save visibility + conditions (not BaseType lists) for reuse across filters.</li>
              <li>Batch apply can push a preset, StackSize, and/or Show/Hide across many tiers at once.</li>
              <li>
                Find (More tools) searches StackSize / missing MinimapIcon / etc., scoped to the section if you want.
              </li>
              <li>
                After installing a Scalpel build that patches <code>app.asar</code>, fully quit and relaunch Scalpel or
                new UI won’t appear.
              </li>
            </ul>
            <p style={p}>
              Still stuck? Start with What wins? on a real Ctrl+C item — most “filter is broken” reports are first-match
              order, not missing BaseTypes.
            </p>
          </>
        )
      default:
        return null
    }
  }, [active, onGoAdvanced, onGoEdit])

  return (
    <div
      role="region"
      aria-label="Section editor guide"
      style={{
        display: 'flex',
        gap: 12,
        flex: 1,
        minHeight: 0,
        alignItems: 'stretch',
      }}
    >
      <nav
        aria-label="Guide topics"
        style={{
          width: 180,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflowY: 'auto',
          paddingRight: 4,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: '#c9a227', marginBottom: 6, paddingLeft: 8 }}>Guide</div>
        {TOC.map((t) => {
          const on = active === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              aria-current={on ? 'page' : undefined}
              style={{
                textAlign: 'left',
                fontSize: 12,
                padding: '8px 10px',
                minHeight: 36,
                borderRadius: 6,
                border: on ? '1px solid #c9a227' : '1px solid transparent',
                background: on ? 'rgba(201,162,39,0.25)' : 'transparent',
                color: on ? '#f0e6d2' : '#9a9aab',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </nav>
      <article
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
          padding: '4px 8px 24px 12px',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {body}
      </article>
    </div>
  )
}
