import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { listBuildPlannerFiles, readBuildPlannerFile, resolveBuildPlannerPath } from './build-planner'

describe('build-planner', () => {
  it('resolves PoE2 BuildPlanner path under Documents', () => {
    expect(resolveBuildPlannerPath(2, '/docs')).toBe(join('/docs', 'My Games', 'Path of Exile 2', 'BuildPlanner'))
  })

  it('rejects path traversal in read', () => {
    expect(() => readBuildPlannerFile('/tmp', '../evil.build')).toThrow('invalid build filename')
  })
})
