import { net, ipcMain } from 'electron'

const DEFAULT_MODEL_VERSION = 92
const FALLBACK_VERSIONS = [90, 91, 92, 93, 94, 95]

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._#\- ]*$/

export type NinjaCharacterModelOpts = {
  account: string
  league: string
  name: string
  modelVersion?: number
}

export type NinjaCharacterModelResult = {
  type: string
  charModel: unknown
  modelVersion: number
}

function assertSegment(label: string, value: unknown): string {
  if (typeof value !== 'string' || !value || value.includes('/') || value.includes('\\') || !SAFE_SEGMENT.test(value)) {
    throw new Error(`Invalid ${label}`)
  }
  return value
}

function fetchJson(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = net.request(url)
    request.setHeader('User-Agent', 'Scalpel-NinjaCharacter')
    request.setHeader('Accept', 'application/json')
    let data = ''
    request.on('response', (response) => {
      const status = response.statusCode ?? 0
      response.on('data', (chunk) => {
        data += chunk.toString()
      })
      response.on('end', () => {
        resolve({ status, body: data })
      })
    })
    request.on('error', reject)
    request.end()
  })
}

function modelUrl(account: string, league: string, name: string, version: number): string {
  return `https://poe.ninja/poe2/api/profile/characters/${encodeURIComponent(account)}/${encodeURIComponent(league)}/${encodeURIComponent(name)}/model/${version}`
}

/** Fetch a public poe.ninja PoE2 character model (includes skills[].dps from PoB). */
export async function fetchNinjaCharacterModel(opts: NinjaCharacterModelOpts): Promise<NinjaCharacterModelResult> {
  const account = assertSegment('account', opts.account)
  const league = assertSegment('league', opts.league)
  const name = assertSegment('name', opts.name)

  const versions =
    opts.modelVersion != null
      ? [opts.modelVersion]
      : [DEFAULT_MODEL_VERSION, ...FALLBACK_VERSIONS.filter((v) => v !== DEFAULT_MODEL_VERSION)]

  let lastStatus = 0
  for (const version of versions) {
    const { status, body } = await fetchJson(modelUrl(account, league, name, version))
    lastStatus = status
    if (status === 404) continue
    if (status !== 200) {
      throw new Error(`poe.ninja character model failed (${status})`)
    }
    let parsed: { type?: string; charModel?: unknown }
    try {
      parsed = JSON.parse(body) as { type?: string; charModel?: unknown }
    } catch {
      throw new Error('poe.ninja character model returned invalid JSON')
    }
    if (parsed.type === 'found' && parsed.charModel != null) {
      return { type: parsed.type, charModel: parsed.charModel, modelVersion: version }
    }
    if (parsed.type === 'notFound' || parsed.type === 'private') {
      throw new Error(`Character not available (${parsed.type})`)
    }
  }

  throw new Error(
    lastStatus === 404
      ? 'Character model not found (try a different model version)'
      : 'Character model not found',
  )
}

export function registerNinjaCharacterHandlers(): void {
  ipcMain.handle('plugins:ninja-character-model', async (_evt, opts: NinjaCharacterModelOpts) => {
    return fetchNinjaCharacterModel(opts)
  })
}
