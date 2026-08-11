const fs = require('node:fs')
const path = require('node:path')
const p = path.join(__dirname, '..', 'src', 'shared', 'crafting', 'actions.ts')
let s = fs.readFileSync(p, 'utf8')

s = s.replace(
  `  if (actionId.startsWith('essence:')) return actionId
  return actionId
}

export function labelForActionId(actionId: string, data: CraftDataset): string {`,
  `  if (actionId.startsWith('essence:')) return actionId
  if (actionId.startsWith('socketable:')) return 'socketable'
  if (actionId.startsWith('desecration:')) return 'desecration'
  return actionId
}

export function labelForActionId(actionId: string, data: CraftDataset): string {`,
)

if (!s.includes("actionId.startsWith('socketable:')")) {
  s = s.replace(
    `  if (actionId.startsWith('desecration:')) {
    const bone = DESECRATION_BONES.find((b) => \`desecration:\${b.id}\` === actionId)
    return bone?.name ?? actionId.slice('desecration:'.length)
  }
  return actionId
}`,
    `  if (actionId.startsWith('desecration:')) {
    const bone = DESECRATION_BONES.find((b) => \`desecration:\${b.id}\` === actionId)
    return bone?.name ?? actionId.slice('desecration:'.length)
  }
  if (actionId.startsWith('socketable:')) {
    const id = actionId.slice('socketable:'.length)
    return data.socketables?.find((x) => x.id === id)?.name ?? id
  }
  return actionId
}`,
  )
}

fs.writeFileSync(p, s)
console.log('actions socketable labels patched')
