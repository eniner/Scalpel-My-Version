import { describe, expect, it, vi } from 'vitest'
import { fetchNinjaCharacterModel } from './ninja-character'

vi.mock('electron', () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  return {
    ipcMain: {
      handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
        handlers.set(channel, fn)
      },
      _handlers: handlers,
    },
    net: {
      request: (url: string) => {
        const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
        const req = {
          setHeader: () => {},
          on: (evt: string, cb: (...args: unknown[]) => void) => {
            ;(listeners[evt] ??= []).push(cb)
            return req
          },
          end: () => {
            const match = String(url).match(/\/model\/(\d+)$/)
            const version = match ? Number(match[1]) : 0
            const status = version === 92 ? 200 : 404
            const body =
              status === 200
                ? JSON.stringify({
                    type: 'found',
                    charModel: { name: 'Aenthan', skills: [] },
                  })
                : ''
            queueMicrotask(() => {
              for (const cb of listeners.response ?? []) {
                const response = {
                  statusCode: status,
                  on: (evt: string, rcb: (...args: unknown[]) => void) => {
                    if (evt === 'data') queueMicrotask(() => rcb(Buffer.from(body)))
                    if (evt === 'end') queueMicrotask(() => rcb())
                    return response
                  },
                }
                cb(response)
              }
            })
          },
        }
        return req
      },
    },
  }
})

describe('fetchNinjaCharacterModel', () => {
  it('fetches model/92 for Aenthan path segments', async () => {
    const result = await fetchNinjaCharacterModel({
      account: 'Enin9-6394',
      league: 'runesofaldur',
      name: 'Aenthan',
    })
    expect(result.type).toBe('found')
    expect(result.modelVersion).toBe(92)
    expect((result.charModel as { name: string }).name).toBe('Aenthan')
  })

  it('rejects unsafe path segments', async () => {
    await expect(
      fetchNinjaCharacterModel({ account: '../x', league: 'runesofaldur', name: 'Aenthan' }),
    ).rejects.toThrow(/Invalid account/)
  })
})
