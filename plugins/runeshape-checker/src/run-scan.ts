import type { GameCapture, ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { setOcrProgress, warmWorkers } from './ocr'
import { captureWithRefocus } from './focus-poe'
import { readRewardRows } from './row-read'
import {
  buildPriceIndex,
  diagnoseCandidates,
  type Candidate,
  type PricedReward,
  priceRewards,
} from './rewards'
import { canonicalRewardCount } from './rewards-catalog'
import type { Diag, Fire, Label, ScanOutcome } from './types'
import type { Line } from './segment'

export const STATUS_LEFT_FRAC = 0.39
export const STATUS_TOP_FRAC = 0.1
export const RS_PRICE_X_FRAC = 0.503
export const EMPTY_DIAG: Diag = { loading: false, note: null }

const formatDebug = (
  method: string,
  rowLines: Line[],
  candidates: Candidate[],
  index: ReturnType<typeof buildPriceIndex>,
  pricedCount: number,
  priceCount: number,
): string => {
  const parts: string[] = []
  parts.push(`reader: ${method}`)
  parts.push(`poe.ninja entries: ${priceCount} (catalog: ${canonicalRewardCount()} names)`)
  parts.push(`Rows read:`)
  for (const l of rowLines) {
    const t = l.text.replace(/\s+/g, ' ').trim()
    if (!t) continue
    parts.push(`  y=${Math.round(l.box.y).toString().padStart(3)} "${t}"`)
  }
  parts.push('')
  parts.push(`Candidates (${candidates.length}) -> badges (${pricedCount}):`)
  for (const d of diagnoseCandidates(candidates, index)) {
    const flag = d.explicit ? 'Nx' : '  '
    parts.push(`  [${flag}] y=${String(d.y).padStart(3)} ${d.qty}x ${d.name}`)
    parts.push(`       ${d.outcome} ${d.badge ?? '—'} | ${d.detail}`)
  }
  return parts.join('\n')
}

const prettyStatus = (status: string, step: string): string => {
  const s = status.toLowerCase()
  if (s.includes('core')) return 'Loading OCR engine'
  if (s.includes('traineddata') || s.includes('language')) return 'Loading language data'
  if (s.includes('initializ')) return 'Initializing OCR'
  return step
}

export const setFire = (ctx: ScalpelPluginContext, open: boolean, items: Label[], diag: Diag): Promise<void> =>
  ctx.storage.set('lastFire', { token: String(Date.now()), open, items, diag } satisfies Fire)

async function scanRuneshape(
  ctx: ScalpelPluginContext,
  frame: GameCapture,
  pushPhase: (text: string) => void,
  setStep: (text: string) => void,
): Promise<void> {
  setStep('Reading rewards')
  pushPhase('Reading reward rows...')

  const { lines: rowLines, candidates, method } = await readRewardRows(frame, (row, total) => {
    pushPhase(`Reading row ${row}/${total}...`)
  })

  setStep('Pricing rewards')
  pushPhase('Pricing rewards...')

  let priced: PricedReward[] = []
  let updatedAt: number | null = null
  let priceIndex = buildPriceIndex([])
  let priceCount = 0
  try {
    const [all, cur, runes, uncut] = await Promise.all([
      ctx.prices.getPrices(),
      ctx.prices.getPrices({ category: 'currency' }),
      ctx.prices.getPrices({ category: 'runes' }),
      ctx.prices.getPrices({ category: 'uncut-gems' }),
    ])
    updatedAt = all.updatedAt ?? cur.updatedAt ?? runes.updatedAt ?? uncut.updatedAt
    const merged = [...all.prices, ...cur.prices, ...runes.prices, ...uncut.prices]
    priceCount = merged.length
    priceIndex = buildPriceIndex(merged)
    priced = priceRewards(candidates, priceIndex)
  } catch (e) {
    ctx.log(`runeshape-checker: price fetch failed (${e instanceof Error ? e.message : String(e)})`)
    priced = priceRewards(candidates, priceIndex)
  }

  const debug = formatDebug(method, rowLines, candidates, priceIndex, priced.length, priceCount)
  ctx.log(`runeshape-checker debug\n${debug}`)

  if (priced.length === 0) {
    const sample = rowLines
      .map((l) => l.text.trim())
      .filter(Boolean)
      .slice(0, 16)
      .join('\n')
    await setFire(ctx, true, [], {
      loading: false,
      note: `No rewards detected.\n\nRows read:\n${sample || '(empty)'}`,
      debug,
      updatedAt,
    })
    return
  }

  const maxVal = priced.reduce((m, p) => (p.value != null && p.value > m ? p.value : m), 0)
  const items: Label[] = priced.map((p) => ({
    y: frame.origin.y + (p.box.y + p.box.h / 2) / frame.scale,
    text: p.text,
    top: maxVal > 0 && p.value === maxVal,
  }))

  await setFire(ctx, true, items, {
    loading: false,
    note: null,
    updatedAt,
    debug,
  })
  ctx.log(`runeshape-checker: ${items.length} prices shown`)
}

export function createRuneshapeScanController(ctx: ScalpelPluginContext): {
  warm: () => void
  runScan: () => Promise<ScanOutcome>
  isBusy: () => boolean
} {
  let busy = false

  return {
    warm: () => warmWorkers(),
    isBusy: () => busy,
    async runScan(): Promise<ScanOutcome> {
      if (busy) return 'busy'

      const cur = await ctx.storage.get<Fire>('lastFire')
      if (cur?.open) {
        await setFire(ctx, false, [], EMPTY_DIAG)
        ctx.closeOverlay()
        return 'toggled-off'
      }

      const frame = await captureWithRefocus(() => ctx.captureGameWindow())
      if (!frame) {
        ctx.log('runeshape-checker: capture failed (PoE not focused or admin mismatch)')
        return 'no-focus'
      }

      busy = true
      let step = 'Scanning screen'
      let lastPhaseWrite = 0
      let lastPhaseText = ''
      const pushPhase = (text: string): void => {
        const now = Date.now()
        if (text === lastPhaseText && now - lastPhaseWrite < 150) return
        lastPhaseText = text
        lastPhaseWrite = now
        void setFire(ctx, true, [], { loading: true, note: null, phase: text })
      }

      setOcrProgress((status, progress) => {
        const label = prettyStatus(status, step)
        const pct = Math.round(progress * 100)
        pushPhase(pct > 0 && pct < 100 ? `${label}... ${pct}%` : `${label}...`)
      })

      try {
        await setFire(ctx, true, [], { loading: true, note: null, phase: 'Scanning screen...' })
        ctx.openOverlay()
        await scanRuneshape(ctx, frame, pushPhase, (text) => {
          step = text
        })
        return 'done'
      } finally {
        setOcrProgress(null)
        busy = false
      }
    },
  }
}
