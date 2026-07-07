import type { CraftApi } from '@scalpelpoe/plugin-sdk'

export type ModPoolReport = Awaited<ReturnType<CraftApi['modPool']>>
export type ModGroupReport = ModPoolReport['groups'][number]
export type ModPoolSection = ModPoolReport['sections'][number]
