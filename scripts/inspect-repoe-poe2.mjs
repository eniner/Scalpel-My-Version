import https from 'node:https'

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Scalpel' } }, (res) => {
        let data = ''
        res.on('data', (c) => {
          data += c
        })
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`${url} HTTP ${res.statusCode}`))
          resolve(JSON.parse(data))
        })
      })
      .on('error', reject)
  })
}

const base = 'https://repoe-fork.github.io/poe2/'
const mods = await get(base + 'mods.json')
const bases = await get(base + 'base_items.json')
const tags = await get(base + 'tags.json')
const augments = await get(base + 'augments.json')

const genTypes = new Set()
for (const m of Object.values(mods).slice(0, 2000)) genTypes.add(m.generation_type)
console.log('generation_type values:', [...genTypes])

const sampleKey = Object.keys(mods).find((k) => {
  const m = mods[k]
  return m.domain === 'item' && m.spawn_weights?.length && m.groups?.length
})
console.log('sample mod:', JSON.stringify(mods[sampleKey], null, 2).slice(0, 1800))

const baseKey =
  Object.keys(bases).find((k) => bases[k].name === 'Vaal Regalia') ??
  Object.keys(bases).find((k) => bases[k].name?.includes('Helmet'))
console.log('sample base:', bases[baseKey]?.name, bases[baseKey]?.tags?.slice(0, 12))

console.log('augments count', Object.keys(augments).length)
const ak = Object.keys(augments)[0]
console.log('augment sample', JSON.stringify(augments[ak], null, 2).slice(0, 1200))
