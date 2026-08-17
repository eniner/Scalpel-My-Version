import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const fseMessages = path.join(root, '..', 'scalpel-fse', 'messages')
const myMessages = path.join(root, 'messages')

for (const lang of ['en', 'de', 'es']) {
  const src = JSON.parse(fs.readFileSync(path.join(fseMessages, `${lang}.json`), 'utf8'))
  const dstPath = path.join(myMessages, `${lang}.json`)
  const dst = JSON.parse(fs.readFileSync(dstPath, 'utf8'))
  const keys = Object.keys(src).filter((k) => k.startsWith('settings_custom_tiers'))
  const next = {}
  for (const [k, v] of Object.entries(dst)) {
    if (k.startsWith('settings_custom_tiers')) continue
    next[k] = v
    if (k === 'settings_reload_on_save') {
      for (const ck of keys) next[ck] = src[ck]
    }
  }
  for (const ck of keys) {
    if (!(ck in next)) next[ck] = src[ck]
  }
  fs.writeFileSync(dstPath, `${JSON.stringify(next, null, 2)}\n`)
  console.log(lang, keys.length, 'keys')
}
