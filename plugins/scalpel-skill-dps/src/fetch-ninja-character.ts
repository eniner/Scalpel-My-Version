import type { NinjaProfileRef } from './parse-ninja-url'

const DEFAULT_MODEL_VERSION = 92
const FALLBACK_VERSIONS = [90, 91, 92, 93, 94, 95]

export type NinjaCharacterModelResult = {
  type: string
  charModel: unknown
  modelVersion: number
}

function modelUrl(ref: NinjaProfileRef, version: number): string {
  return `https://poe.ninja/poe2/api/profile/characters/${encodeURIComponent(ref.account)}/${encodeURIComponent(ref.league)}/${encodeURIComponent(ref.name)}/model/${version}`
}

/**
 * Fetch a public poe.ninja PoE2 character model from the plugin renderer.
 * Works on stock Beta (no ctx.ninja) because Electron fetch is not CORS-bound
 * the same way a browser tab is.
 */
export async function fetchNinjaCharacterModelDirect(
  fetchImpl: typeof fetch,
  ref: NinjaProfileRef,
  modelVersion?: number,
): Promise<NinjaCharacterModelResult> {
  const versions =
    modelVersion != null
      ? [modelVersion]
      : [DEFAULT_MODEL_VERSION, ...FALLBACK_VERSIONS.filter((v) => v !== DEFAULT_MODEL_VERSION)]

  let lastStatus = 0
  for (const version of versions) {
    const res = await fetchImpl(modelUrl(ref, version), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Scalpel-SkillDps',
      },
    })
    lastStatus = res.status
    if (res.status === 404) continue
    if (!res.ok) {
      throw new Error(`poe.ninja character model failed (${res.status})`)
    }
    let parsed: { type?: string; charModel?: unknown }
    try {
      parsed = (await res.json()) as { type?: string; charModel?: unknown }
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
