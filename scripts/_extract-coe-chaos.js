const fs = require('fs')
const p =
  'C:/Users/E9ine/Desktop/profusion site/Craftofecile/www.craftofexile.com/packages/packagebe5a.js'
const s = fs.readFileSync(p, 'utf8')
const needle = "case 'chaos':if(aconsts.game==\"poe2\")"
const i = s.indexOf(needle)
console.log('idx', i)
console.log(s.slice(i, i + 3000))

const needle2 = 'function poec_simRemoveAffix'
const j = s.indexOf(needle2)
console.log('\n\n--- remove affix ---\n', s.slice(j, j + 2000))

const needle3 = 'function poec_simAddAffix'
const k = s.indexOf(needle3)
console.log('\n\n--- add affix ---\n', s.slice(k, k + 2500))
