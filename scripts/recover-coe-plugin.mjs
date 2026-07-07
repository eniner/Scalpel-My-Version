import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const transcript =
  'C:/Users/E9ine/.cursor/projects/c-Users-E9ine-Downloads-scalpel-main/agent-transcripts/a9820da0-3e81-4718-bfc1-1aa5498c530d/a9820da0-3e81-4718-bfc1-1aa5498c530d.jsonl'
const outRoot = join(process.cwd(), 'plugins', 'scalpel-lab-recover')
const files = new Map()
const misses = []

function keyOf(fp) {
  return fp.replace(/\\/g, '/').toLowerCase()
}

function suffixAfterPlugin(fp) {
  const norm = fp.replace(/\\/g, '/')
  const idx = norm.toLowerCase().indexOf('craft-of-exile/')
  if (idx === -1) return null
  return norm.slice(idx + 'craft-of-exile/'.length)
}

for (const line of readFileSync(transcript, 'utf8').split('\n')) {
  if (!line.trim()) continue
  let o
  try {
    o = JSON.parse(line)
  } catch {
    continue
  }
  if (o.role !== 'assistant') continue
  for (const c of o.message?.content ?? []) {
    if (c.type !== 'tool_use') continue
    const fp = c.input?.path
    if (!fp || !fp.toLowerCase().includes('craft-of-exile')) continue
    const key = keyOf(fp)
    if (c.name === 'Write') {
      files.set(key, c.input.contents)
    } else if (c.name === 'StrReplace') {
      const content = files.get(key)
      if (content == null) continue
      const old = c.input.old_string
      const neu = c.input.new_string
      if (old == null || neu == null) continue
      if (!content.includes(old)) {
        misses.push({ file: fp, snippet: old.slice(0, 60) })
        continue
      }
      files.set(key, c.input.replace_all ? content.split(old).join(neu) : content.replace(old, neu))
    }
  }
}

for (const [k, content] of files) {
  const rel = suffixAfterPlugin(k)
  if (!rel) continue
  const out = join(outRoot, rel)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, content)
}

console.log(`Recovered ${files.size} files -> ${outRoot}`)
console.log(`StrReplace misses: ${misses.length}`)
if (misses.length) {
  console.log(misses.slice(0, 5).map((m) => `${m.file}: ${m.snippet}…`).join('\n'))
}
