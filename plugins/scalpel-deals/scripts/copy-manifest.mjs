import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
copyFileSync(join(root, 'manifest.json'), join(root, 'dist', 'manifest.json'))
const icon = join(root, 'icon.svg')
if (existsSync(icon)) copyFileSync(icon, join(root, 'dist', 'icon.svg'))

