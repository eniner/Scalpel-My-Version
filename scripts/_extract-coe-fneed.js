const fs = require('fs')
const p =
  'C:/Users/E9ine/Desktop/profusion site/Craftofecile/www.craftofexile.com/packages/packagebe5a.js'
const s = fs.readFileSync(p, 'utf8')
for (const needle of ['fneed', 'poec_calcMod', 'function poec_buildMod', 'avgcur', '1/(']) {
  let idx = 0
  let n = 0
  while (n < 3) {
    const i = s.indexOf(needle, idx)
    if (i < 0) break
    console.log('\n====', needle, i, '====')
    console.log(s.slice(Math.max(0, i - 100), i + 400))
    idx = i + needle.length
    n++
  }
}
