/**
 * Live smoke: Mercenary Warrant search + fetch (no Electron).
 * Run: node scripts/smoke-warrants-trade.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'tmp-warrant-smoke')
mkdirSync(outDir, { recursive: true })

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

async function j(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
  })
  const json = await res.json()
  return { status: res.status, json }
}

function fingerprint(skills) {
  return (skills || [])
    .map((s) => {
      const links = (s.supports || []).map((x) => (x.tier != null ? `${x.name}:t${x.tier}` : x.name)).join('+')
      return links ? `${s.name}[${links}]` : s.name
    })
    .join(' | ')
}

async function main() {
  const search = await j('https://www.pathofexile.com/api/trade/search/Allflame', {
    method: 'POST',
    body: JSON.stringify({
      query: {
        status: { option: 'any' },
        type: 'Mercenary Warrant',
        stats: [{ type: 'and', filters: [] }],
        filters: {
          trade_filters: {
            disabled: false,
            filters: { price: { min: 1, max: 50, option: 'divine' } },
          },
        },
      },
      sort: { price: 'asc' },
    }),
  })
  console.log('search', search.status, 'total', search.json.total)
  if (search.status !== 200) throw new Error('search failed')

  const ids = (search.json.result || []).slice(0, 20)
  const qid = search.json.id
  const all = []
  for (let i = 0; i < ids.length; i += 10) {
    if (i) await new Promise((r) => setTimeout(r, 1100))
    const f = await j(
      `https://www.pathofexile.com/api/trade/fetch/${ids.slice(i, i + 10).join(',')}?query=${qid}`,
    )
    all.push(...(f.json.result || []))
  }

  const withSkills = all.filter((r) => Array.isArray(r.item?.mercenarySkills) && r.item.mercenarySkills.length)
  console.log('fetched', all.length, 'with mercenarySkills', withSkills.length)

  const groups = new Map()
  for (const r of withSkills) {
    const fp = fingerprint(r.item.mercenarySkills)
    const price = r.listing?.price
    const row = groups.get(fp) || { fp, n: 0, prices: [], build: null }
    row.n++
    if (price?.amount != null) row.prices.push(`${price.amount} ${price.currency}`)
    if (!row.build) {
      const b = (r.item.properties || []).find((p) => p.name === 'Build')
      row.build = b?.values?.[0]?.[0] ?? '?'
    }
    groups.set(fp, row)
  }

  const ranked = [...groups.values()].sort((a, b) => b.n - a.n)
  writeFileSync(join(outDir, 'ranked.json'), JSON.stringify(ranked.slice(0, 15), null, 2))
  console.log('top packages by count:')
  for (const g of ranked.slice(0, 8)) {
    console.log(`  n=${g.n} ${g.build} :: ${g.fp.slice(0, 80)}…`)
  }
  if (withSkills.length < all.length * 0.8) {
    throw new Error('Too many listings missing mercenarySkills')
  }
  console.log('OK')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
