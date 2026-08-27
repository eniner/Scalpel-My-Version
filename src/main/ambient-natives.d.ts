/** Ambient stubs for optional Windows natives used only at runtime on win32.
 *  Packages may be absent from node_modules in incomplete local installs;
 *  these declarations keep `tsc -p tsconfig.node.json` green. */

declare module 'koffi' {
  interface KoffiFunction {
    (...args: unknown[]): unknown
  }
  interface KoffiLib {
    func(definition: string): KoffiFunction
  }
  interface Koffi {
    load(name: string): KoffiLib
    proto(definition: string): unknown
    pointer(type: unknown): unknown
    register(fn: (...args: unknown[]) => unknown, type: unknown): unknown
    unregister(cb: unknown): void
  }
  const koffi: Koffi
  export default koffi
}

declare module '@coooookies/windows-smtc-monitor' {
  export interface MediaInfo {
    sourceAppId: string
    lastUpdatedTime: number
    media: {
      title: string
      artist: string
      albumTitle: string
      thumbnail?: Buffer | null
    }
    playback: {
      playbackStatus: number
    }
    timeline: {
      position: number
      duration: number
    }
  }

  export class SMTCMonitor {
    static getCurrentMediaSession(): MediaInfo | null
    on(event: string, listener: (...args: unknown[]) => void): this
    destroy(): void
  }
}
