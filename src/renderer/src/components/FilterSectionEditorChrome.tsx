import { useEffect } from 'react'
import type { FilterSection } from '@shared/types'
import { sectionTypePresetFor } from './filter-section-editor-helpers'

const btnBase: React.CSSProperties = {
  fontSize: 12,
  minHeight: 32,
  padding: '6px 12px',
  borderRadius: 6,
}

function toolBtn(active: boolean): React.CSSProperties {
  return {
    ...btnBase,
    background: active ? 'rgba(201,162,39,0.35)' : 'rgba(255,255,255,0.06)',
    border: active ? '1px solid #c9a227' : '1px solid rgba(255,255,255,0.14)',
    color: '#f0e6d2',
    cursor: 'pointer',
  }
}

export interface EditorToast {
  id: number
  message: string
  canUndo: boolean
}

/** Persistent toast with optional Undo. */
export function ActionToast({
  toast,
  busy,
  onUndo,
  onDismiss,
}: {
  toast: EditorToast | null
  busy?: boolean
  onUndo: () => void
  onDismiss: () => void
}): JSX.Element | null {
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(onDismiss, 8000)
    return () => window.clearTimeout(t)
  }, [toast, onDismiss])

  if (!toast) return null
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        padding: '10px 12px',
        borderRadius: 8,
        background: 'rgba(201,162,39,0.18)',
        border: '1px solid rgba(201,162,39,0.55)',
        color: '#f0e6d2',
        fontSize: 12,
      }}
    >
      <span style={{ flex: 1, minWidth: 120 }}>{toast.message}</span>
      {toast.canUndo && (
        <button type="button" disabled={busy} onClick={onUndo} style={{ ...btnBase, fontWeight: 700 }}>
          Undo
        </button>
      )}
      <button type="button" onClick={onDismiss} aria-label="Dismiss" style={{ ...btnBase, minWidth: 36 }}>
        ×
      </button>
    </div>
  )
}

/** Diagnose → Fix → Verify workflow. */
export function WorkflowStrip({
  busy,
  showMatch,
  showStrictness,
  showPolicy,
  showSuite,
  showPreflight,
  onDiagnose,
  onFix,
  onVerify,
}: {
  busy?: boolean
  showMatch: boolean
  showStrictness: boolean
  showPolicy: boolean
  showSuite: boolean
  showPreflight: boolean
  onDiagnose: () => void
  onFix: () => void
  onVerify: () => void
}): JSX.Element {
  const diagnoseOn = showMatch
  const fixOn = showStrictness || showPolicy
  const verifyOn = showSuite || showPreflight
  return (
    <div
      role="group"
      aria-label="Section workflow"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
        padding: '8px 10px',
        borderRadius: 8,
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: '#c9a227', marginRight: 4 }}>Workflow</span>
      <button
        type="button"
        disabled={busy}
        onClick={onDiagnose}
        style={toolBtn(diagnoseOn)}
        title="Open What wins? + Filmstrip"
      >
        1 · Diagnose
      </button>
      <span style={{ color: '#6b6b7a', fontSize: 12 }} aria-hidden>
        →
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={onFix}
        style={toolBtn(fixOn)}
        title="Open Strictness + Economy policy"
      >
        2 · Fix
      </button>
      <span style={{ color: '#6b6b7a', fontSize: 12 }} aria-hidden>
        →
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={onVerify}
        style={toolBtn(verifyOn)}
        title="Open loot suite + Preflight"
      >
        3 · Verify
      </button>
      <span style={{ fontSize: 10, color: '#6b6b7a', marginLeft: 4 }}>
        see problem → change filter → re-check drops
      </span>
    </div>
  )
}

export type ToolToggleKey =
  | 'match'
  | 'reapply'
  | 'strictness'
  | 'batch'
  | 'filmstrip'
  | 'preflight'
  | 'nudges'
  | 'templates'
  | 'suite'
  | 'editPack'
  | 'policy'
  | 'continue'
  | 'find'
  | 'checkpoints'
  | 'changes'
  | 'diff'
  | 'compare'
  | 'history'
  | 'lootSim'

const MORE_TOOLS: Array<{ key: ToolToggleKey; label: string }> = [
  { key: 'match', label: 'What wins?' },
  { key: 'filmstrip', label: 'Filmstrip' },
  { key: 'reapply', label: 'Re-apply' },
  { key: 'strictness', label: 'Strictness' },
  { key: 'policy', label: 'Policy' },
  { key: 'batch', label: 'Batch' },
  { key: 'suite', label: 'Suite' },
  { key: 'preflight', label: 'Preflight' },
  { key: 'nudges', label: 'Nudges' },
  { key: 'editPack', label: 'Edit pack' },
  { key: 'templates', label: 'Templates' },
  { key: 'continue', label: 'Continue' },
  { key: 'find', label: 'Find' },
  { key: 'checkpoints', label: 'Checkpoints' },
  { key: 'changes', label: 'My changes' },
  { key: 'diff', label: 'Diff' },
  { key: 'compare', label: 'Compare' },
  { key: 'history', label: 'History' },
  { key: 'lootSim', label: 'Loot sim' },
]

/** Collapsible tool toggles — keeps Advanced from becoming a button wall. */
export function MoreToolsDisclosure({
  open,
  onOpenChange,
  active,
  onToggle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  active: Partial<Record<ToolToggleKey, boolean>>
  onToggle: (key: ToolToggleKey) => void
}): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        style={{
          ...btnBase,
          alignSelf: 'flex-start',
          background: open ? 'rgba(255,255,255,0.1)' : 'transparent',
          border: '1px solid rgba(255,255,255,0.14)',
          color: '#c8c4bc',
        }}
      >
        {open ? '▾ More tools' : '▸ More tools'}
      </button>
      {open && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {MORE_TOOLS.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={!!active[t.key]}
              onClick={() => onToggle(t.key)}
              style={toolBtn(!!active[t.key])}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Sticky actions for the current section. */
export function SectionStickyBar({
  section,
  busy,
  historyLen,
  sortByPrice,
  onHideLow,
  onShowSA,
  onToggleSort,
  onUndoSection,
  onCheckpoint,
  onOpenStyle,
  onOpenSuggested,
}: {
  section: FilterSection
  busy?: boolean
  historyLen: number
  sortByPrice: boolean
  onHideLow: () => void
  onShowSA: () => void
  onToggleSort: () => void
  onUndoSection: () => void
  onCheckpoint: () => void
  onOpenStyle: () => void
  onOpenSuggested: () => void
}): JSX.Element {
  const preset = sectionTypePresetFor(section.typePath)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '8px 10px',
        borderRadius: 8,
        background: 'rgba(201,162,39,0.08)',
        border: '1px solid rgba(201,162,39,0.28)',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <strong style={{ fontSize: 12, color: '#f0e6d2' }}>{section.title}</strong>
        {preset && <span style={{ fontSize: 10, color: '#c9a227' }}>{preset.label} toolkit</span>}
        <span style={{ flex: 1 }} />
        <button type="button" disabled={busy} onClick={onHideLow} style={btnBase} aria-label="Hide tiers C and below">
          Hide ≤C
        </button>
        <button type="button" disabled={busy} onClick={onShowSA} style={btnBase} aria-label="Show only S and A tiers">
          Show S–A
        </button>
        <button
          type="button"
          disabled={busy}
          aria-pressed={sortByPrice}
          onClick={onToggleSort}
          style={toolBtn(sortByPrice)}
        >
          Sort price
        </button>
        <button type="button" disabled={busy || historyLen === 0} onClick={onUndoSection} style={btnBase}>
          Undo section
        </button>
        <button type="button" disabled={busy} onClick={onCheckpoint} style={btnBase}>
          Checkpoint
        </button>
        <button type="button" disabled={busy} onClick={onOpenStyle} style={btnBase}>
          Style
        </button>
        {preset && (
          <button type="button" disabled={busy} onClick={onOpenSuggested} style={toolBtn(false)}>
            Open {preset.label} tools
          </button>
        )}
      </div>
      <FileOrderLegend />
    </div>
  )
}

export function FileOrderLegend(): JSX.Element {
  return (
    <div style={{ fontSize: 11, color: '#9a9aab', lineHeight: 1.45 }}>
      <strong style={{ color: '#c8c4bc' }}>File order = who wins.</strong> Tiers higher in the list (↑) match first.
      Show/Hide only changes visibility — not priority. Use ↑/↓ to reorder rules.
    </div>
  )
}

/** Press ? for keyboard help. */
export function KeyboardHelpOverlay({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element | null {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const rows: Array<[string, string]> = [
    ['?', 'This help'],
    ['/', 'Focus search'],
    ['j / k', 'Next / previous section'],
    ['a', 'Add rule'],
    ['m', 'What wins? (Advanced)'],
    ['s', 'Toggle Show/Hide on selection'],
    ['↑ / ↓', 'Bump selected items between tiers'],
    ['Delete', 'Remove selected BaseTypes'],
    ['Ctrl+Z', 'Undo last edit'],
    ['Esc', 'Close window (unpins first)'],
  ]
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#12131a',
          border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: 10,
          padding: 16,
          maxWidth: 420,
          width: '100%',
          color: '#f0e6d2',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <strong style={{ fontSize: 14 }}>Keyboard</strong>
          <button type="button" onClick={onClose} style={btnBase}>
            Close
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 12, fontSize: 12 }}>
              <code
                style={{
                  minWidth: 100,
                  padding: '2px 6px',
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 4,
                  color: '#c9a227',
                }}
              >
                {k}
              </code>
              <span style={{ color: '#c8c4bc' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const CONFIRM_BULK_KEY = 'scalpel.filterSectionEditor.confirmBulk'

export function loadConfirmBulk(): boolean {
  try {
    const v = localStorage.getItem(CONFIRM_BULK_KEY)
    if (v === null) return true
    return v === '1'
  } catch {
    return true
  }
}

export function saveConfirmBulk(on: boolean): void {
  localStorage.setItem(CONFIRM_BULK_KEY, on ? '1' : '0')
}

export function ComfortSettingsRow({
  confirmBulk,
  onConfirmBulk,
  onShowKeys,
}: {
  confirmBulk: boolean
  onConfirmBulk: (on: boolean) => void
  onShowKeys: () => void
}): JSX.Element {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', fontSize: 11, color: '#9a9aab' }}>
      <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
        <input type="checkbox" checked={confirmBulk} onChange={(e) => onConfirmBulk(e.target.checked)} />
        Confirm bulk edits
      </label>
      <button type="button" onClick={onShowKeys} style={{ ...btnBase, fontSize: 11 }} title="Keyboard shortcuts (?)">
        Shortcuts (?)
      </button>
    </div>
  )
}
