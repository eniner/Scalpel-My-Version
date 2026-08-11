const fs = require('node:fs')
const path = require('node:path')
const p = path.join(__dirname, '../src/shared/crafting/target-hit.ts')
const s = fs.readFileSync(p, 'utf8')
const start = s.indexOf("  } else if (sim === 'chaos') {")
const endMarker = "  } else if (sim.startsWith('essence:')"
const end = s.indexOf(endMarker, start)
if (start < 0 || end < 0) {
  console.error('markers not found', { start, end })
  process.exit(1)
}
const neu = `  } else if (sim === 'chaos') {
    const chaos = chaosHitProbability(data, query.state, q, kind, tierFloor)
    hitPerAttempt = chaos.hitPerAttempt
    matchingOutcomes = chaos.matchingOutcomes
    note =
      'PoE2 Chaos: remove one mod, add one of that affix kind (pooled over which mod is removed).'
  } else if (sim.startsWith('essence:')`
const out = s.slice(0, start) + neu + s.slice(end + endMarker.length)
const tmp = p + '.tmp'
fs.writeFileSync(tmp, out)
fs.renameSync(tmp, p)
console.log('patched chaos branch ok')
