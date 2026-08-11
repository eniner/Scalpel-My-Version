const fs = require('fs')
const p =
  'C:/Users/E9ine/Desktop/profusion site/Craftofecile/www.craftofexile.com/packages/packagebe5a.js'
const s = fs.readFileSync(p, 'utf8')
const needle = 'function poec_simRollAffix('
const i = s.indexOf(needle)
console.log('idx', i)
// print first ~8000 chars of function
console.log(s.slice(i, i + 8000))
