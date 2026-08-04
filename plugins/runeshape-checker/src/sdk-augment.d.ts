// Forward-declares host context capabilities that Scalpel already provides but
// which the published @scalpelpoe/plugin-sdk types (0.7.0) do not yet carry.
export {}

declare module '@scalpelpoe/plugin-sdk' {
  interface PriceEntry {
    name: string
    category: string
    chaosValue: number
    divineValue?: number
    graph?: (number | null)[]
  }
  interface PricesApi {
    getPrices(opts?: { category?: string }): Promise<{ prices: PriceEntry[]; updatedAt: number | null }>
    refresh(): Promise<void>
    onChange(handler: () => void): () => void
  }
  interface ScalpelPluginContext {
    setInteractiveRegion(rect: { x: number; y: number; width: number; height: number } | null): void
    readonly prices: PricesApi
  }
}
