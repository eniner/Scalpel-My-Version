import { describe, expect, it, vi } from 'vitest'
import { fetchNinjaCharacterModelDirect } from './fetch-ninja-character'

describe('fetchNinjaCharacterModelDirect', () => {
  it('returns found model and version', async () => {
    const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Partial<Response>>>(
      async () => ({
        ok: true,
        status: 200,
        json: async () => ({ type: 'found', charModel: { name: 'Aenthan' } }),
      }),
    )

    const result = await fetchNinjaCharacterModelDirect(fetchImpl as unknown as typeof fetch, {
      account: 'Enin9-6394',
      league: 'runesofaldur',
      name: 'Aenthan',
    })

    expect(result.type).toBe('found')
    expect(result.modelVersion).toBe(92)
    expect((result.charModel as { name: string }).name).toBe('Aenthan')
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('/model/92')
  })

  it('tries fallback versions on 404', async () => {
    const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Partial<Response>>>(
      async (url) => {
        if (String(url).endsWith('/model/92')) {
          return { ok: false, status: 404, json: async () => ({}) }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ type: 'found', charModel: { name: 'X' } }),
        }
      },
    )

    const result = await fetchNinjaCharacterModelDirect(fetchImpl as unknown as typeof fetch, {
      account: 'a',
      league: 'b',
      name: 'c',
    })
    expect(result.modelVersion).toBe(90)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
