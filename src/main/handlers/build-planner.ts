import { ipcMain, shell } from 'electron'
import { app } from 'electron'
import { listBuildPlannerFiles, readBuildPlannerFile, resolveBuildPlannerPath } from '../build-planner'
import { getPoeVersion } from '../game-state'

function currentDir(): string {
  return resolveBuildPlannerPath(getPoeVersion(), app.getPath('documents'))
}

export function registerBuildPlannerHandlers(): void {
  ipcMain.handle('plugins:build-planner-path', () => {
    return { path: currentDir() }
  })

  ipcMain.handle('plugins:build-planner-list', () => {
    const path = currentDir()
    return { path, files: listBuildPlannerFiles(path) }
  })

  ipcMain.handle('plugins:build-planner-read', (_evt, filename: string) => {
    if (typeof filename !== 'string') throw new Error('build-planner read expects a filename string')
    const path = currentDir()
    return { path, content: readBuildPlannerFile(path, filename) }
  })

  ipcMain.handle('plugins:build-planner-open-folder', () => {
    const path = currentDir()
    void shell.openPath(path)
    return { path }
  })
}
