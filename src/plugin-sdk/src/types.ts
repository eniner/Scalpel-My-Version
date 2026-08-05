import type { PoeItem, PriceEntry, Zone } from '../../shared/types'
export type { PriceEntry }

export interface PluginManifest {
  manifestVersion: 1
  id: string
  version: string
  name: string
  description: string
  author: string
  scalpelMinVersion: string
  homepage?: string
  poeVersions?: (1 | 2)[]
  tabIcon?: string
  /** Absolute URL of a small icon shown in the Plugins settings store rows.
   *  PNG or SVG. The same URL the registry entry advertises pre-install. */
  iconUrl?: string
}

/** Optional cleanup returned from activate(); the host calls it when the plugin
 *  is unloaded (uninstall or in-place update) so subscriptions/timers can be
 *  torn down. Mirrors RegisterTabOptions.render's cleanup-fn convention. */
export type PluginTeardown = () => void

export type PluginActivate = (ctx: ScalpelPluginContext) => PluginTeardown | void | Promise<PluginTeardown | void>

export interface RegisterTabOptions {
  /** Shown as the title-bar tooltip and in any "manage plugins" UI. */
  label: string
  /**
   * Inline SVG markup or a data URL. The host clamps the rendered icon to the
   * canonical 16x16 title-bar size and forces `display: flex` on any
   * descendant SVG, so plugin authors don't need to set width / height /
   * `display`. For a Scalpel-matched look, render an iconpark component to a
   * string at activation time (see PLUGINS.md "Tab icons").
   */
  icon: string
  /**
   * Called once when the tab is first shown. Plugin owns the container's
   * contents and may return a cleanup function called on unmount.
   */
  render: (container: HTMLElement) => (() => void) | void
}

export interface RegisterOverlayOptions {
  /** Shown in the overlay window's chrome title bar. */
  title: string
  /**
   * Optional inline SVG markup or data URL for the launch button rendered in
   * the plugin's main-overlay tab header. Same 16x16 clamping as
   * RegisterTabOptions.icon. Only shown if the plugin also registers a tab.
   */
  icon?: string
  /**
   * When set, exposes a dedicated overlay-toggle hotkey slot in Scalpel's
   * app-macro settings, separate from registerHotkey's action hotkey. The user
   * binds the key; this is the label shown in the settings row.
   */
  hotkeyLabel?: string
  /** Initial window size in CSS px. Falls back to a Scalpel default if absent. */
  defaultSize?: { width: number; height: number }
  /**
   * Overlay surface kind. 'window' (default) is the chrome'd, draggable,
   * snap-anchored window. 'annotation' is a borderless, transparent,
   * click-through surface locked to the full game window: `render`'s container
   * is sized to the game window in CSS px and the plugin absolutely-positions
   * its own elements (e.g. value labels next to a menu). In annotation mode
   * `defaultSize` is ignored (the surface always spans the game window).
   */
  mode?: 'window' | 'annotation'
}

export interface PluginStorage {
  get<T = unknown>(key: string): Promise<T | null>
  set<T = unknown>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  keys(): Promise<string[]>
}

export interface RegisterHotkeyOptions {
  /** Shown in the app-macro settings list (e.g. "Quick check"). */
  label: string
}

export interface GameConfigApi {
  /** Read the detected game's config ini. Rejects if the file is missing. */
  read(): Promise<{ content: string; path: string }>
  /**
   * Atomically overwrite the whole config file. On the first write of a session
   * a timestamped `.bak` is created beside it; `backupPath` is that path, or
   * null when no backup was written.
   */
  write(content: string): Promise<{ backupPath: string | null }>
  /**
   * Fire when the file changes on disk underneath you (the game rewriting it on
   * exit, an external editor, ...). Debounced; does not fire for your own
   * `write`. Returns an unsubscribe function.
   */
  onChange(handler: () => void): () => void
}

export interface GameRect {
  x: number
  y: number
  width: number
  height: number
}

export interface GameCapture {
  /** RGBA, row-major, length === width * height * 4. Drop into `new ImageData(...)`. */
  pixels: Uint8ClampedArray
  /** Captured-frame dimensions in frame px (downscaled from physical on tall windows). */
  width: number
  height: number
  /** Top-left of the captured frame in game CSS px. {x:0,y:0} for a full-window capture. */
  origin: { x: number; y: number }
  /** Full game window size in CSS px. An annotation overlay spans exactly this. */
  gameSize: { width: number; height: number }
  /** Captured frame px per game CSS px. Place a label: cssX = origin.x + boxFramePx.x / scale. */
  scale: number
}

export interface BuildPlannerFileEntry {
  filename: string
  name: string
}

export interface BuildPlannerApi {
  /** Absolute path to the detected game's BuildPlanner folder. */
  getPath(): Promise<{ path: string }>
  /** List `.build` exports in that folder (empty when missing). */
  list(): Promise<{ path: string; files: BuildPlannerFileEntry[] }>
  /** Read a `.build` file by basename (not a full path). */
  read(filename: string): Promise<{ path: string; content: string }>
  /** Open the BuildPlanner folder in the system file manager. */
  openFolder(): Promise<{ path: string }>
}

export interface PluginTradeSearchItem {
  name: string
  baseType: string
  itemClass?: string
  rarity: string
  /** Raw guide notes with numbered stat priority lines. */
  notes?: string
  statPriority?: string[]
  /** When true, search by slot + stats instead of the guide's exact base type. */
  similarItems?: boolean
}

export interface WebPanelApi {
  /**
   * Open or focus an always-on-top sidecar window loading an external https URL.
   * Currently limited to craftofexile.com hosts.
   */
  open(opts: { url: string; title?: string; width?: number; height?: number }): Promise<void>
  /** Navigate the sidecar if open; otherwise opens it. */
  navigate(url: string): Promise<void>
  close(): Promise<void>
}

export interface CraftActionResult {
  id: string
  label: string
  description: string
  applies: boolean
  reason?: string
  category?: string
  simKey?: string
}

export interface CraftItemModResult {
  group: string
  kind: 'p' | 's'
  text: string
  name?: string
  bindGroups?: string[]
  desecrated?: boolean
  veiled?: boolean
  fractured?: boolean
  pool?: 'marksman'
}

export interface DesecrationRevealChoiceResult {
  mods: CraftItemModResult[]
  rerollsLeft: number
  veiledKind: 'p' | 's'
}

export interface CraftItemStateResult {
  baseType: string
  itemLevel: number
  rarity: 'Normal' | 'Magic' | 'Rare' | 'Unique'
  tags: string[]
  itemClass: string
  corrupted: boolean
  mods: CraftItemModResult[]
  activeOmens?: string[]
  revealChoices?: DesecrationRevealChoiceResult
  /** Simulate wearing a belt/quiver with "Can roll Marksman modifiers". */
  marksmanEnabled?: boolean
}

export interface CraftApplyOptionsResult {
  omens?: string[]
  pickIndex?: number
  rerollReveal?: boolean
}

export interface CraftApplyResult {
  ok: boolean
  state: CraftItemStateResult
  actionId: string
  label: string
  message: string
  added?: CraftItemModResult[]
  removed?: CraftItemModResult[]
  error?: string
  revealChoices?: DesecrationRevealChoiceResult
  consumedOmens?: string[]
}

export interface CraftPathStepResult {
  actionId: string
  omens?: string[]
  repeatUntilHit?: boolean
}

export interface CraftPathResult {
  targetQuery: string
  hitRate: number
  expectedAttempts: number | null
  attemptsTable: Array<{ attempts: number; probability: number }>
  steps: CraftPathStepResult[]
  samples: number
  note: string
}

export interface CraftOutcomeResult {
  id?: string
  tierName?: string
  text: string
  group: string
  kind: 'p' | 's'
  probability: number
  weight?: number
  groupWeight?: number
  ilvl?: number
  groupChance?: number
  tierChance?: number
  pool?: 'craft' | 'marksman' | 'desecrated'
}

export interface ModTierReportResult {
  id: string
  name: string
  text: string
  ilvl: number
  spawnWeight: number
  tierChance: number
  overallChance: number
  pool?: 'craft' | 'marksman' | 'desecrated'
}

export interface ModSearchHitResult {
  baseType: string
  itemClass: string
  modId: string
  group: string
  kind: 'p' | 's'
  tierName: string
  text: string
  ilvl: number
  spawnWeight: number
  pool: 'craft' | 'marksman' | 'desecrated'
}

export interface ModGroupReportResult {
  group: string
  kind: 'p' | 's'
  displayName: string
  tags: string[]
  groupWeight: number
  groupChance: number
  tierCount: number
  bestTierText: string
  bestTierIlvl: number
  tiers: ModTierReportResult[]
}

export interface ModPoolSectionResult {
  kind: 'p' | 's'
  label: string
  groupCount: number
  modCount: number
  totalWeight: number
  groups: ModGroupReportResult[]
}

export interface ModPoolReportResult {
  baseType: string
  itemLevel: number
  kind: 'all' | 'p' | 's'
  context: 'fresh' | 'item'
  poolSource?: 'craft' | 'marksman' | 'desecrated' | 'all'
  modCount: number
  groupCount: number
  totalWeight: number
  outcomes: CraftOutcomeResult[]
  groups: ModGroupReportResult[]
  sections: ModPoolSectionResult[]
  note: string
}

export interface TargetCraftResult {
  actionId: string
  label: string
  targetQuery: string
  hitPerAttempt: number
  expectedAttempts: number | null
  attemptsTable: Array<{ attempts: number; probability: number }>
  matchingOutcomes: CraftOutcomeResult[]
  samples: number
  note: string
}

export interface CraftSimulationResult {
  actionId: string
  label: string
  samples: number
  modCountChances?: Array<{ count: number; probability: number }>
  outcomes: CraftOutcomeResult[]
  note?: string
}

export interface CraftResolveOptsResult {
  marksmanEnabled?: boolean
}

export interface CraftApi {
  /** List currencies/methods that apply to this item (PoE 2). */
  listActions(item: PoeItem, opts?: CraftResolveOptsResult): Promise<CraftActionResult[]>
  /** Monte-Carlo or exact odds for one action on this item. */
  simulate(item: PoeItem, actionId: string, opts?: CraftResolveOptsResult): Promise<CraftSimulationResult>
  /** Apply one crafting action to virtual item state (emulator). */
  apply(
    state: CraftItemStateResult,
    actionId: string,
    seed?: number,
    opts?: CraftApplyOptionsResult,
  ): Promise<CraftApplyResult>
  /** Fresh normal item on a base for emulator start. */
  freshState(baseType: string, itemLevel: number, opts?: CraftResolveOptsResult): Promise<CraftItemStateResult>
  /** Chance to hit a target mod per craft attempt + cumulative odds. */
  targetHit(opts: {
    state: CraftItemStateResult
    actionId: string
    targetQuery: string
    kind?: 'all' | 'p' | 's'
    samples?: number
    omens?: string[]
  }): Promise<TargetCraftResult>
  /** Multi-step craft path odds (alt until hit, etc.). */
  craftPath(opts: {
    state: CraftItemStateResult
    steps: CraftPathStepResult[]
    targetQuery: string
    kind?: 'all' | 'p' | 's'
    maxTrials?: number
    samples?: number
  }): Promise<CraftPathResult>
  /** Full weighted mod pool for a base (cheat sheet lookup). */
  modPool(opts: {
    baseType: string
    itemLevel: number
    kind?: 'all' | 'p' | 's'
    item?: PoeItem | null
    context?: 'fresh' | 'item'
    poolSource?: 'craft' | 'marksman' | 'desecrated' | 'all'
    marksmanEnabled?: boolean
  }): Promise<ModPoolReportResult>
  /** Autocomplete base types from CoE data. */
  searchBases(query: string, limit?: number, itemClass?: string): Promise<string[]>
  /** List item classes present in the crafting base catalog. */
  listItemClasses(): Promise<string[]>
  /** Search mod tiers across all bases (global cheat sheet lookup). */
  searchMods(opts: {
    query: string
    itemLevel?: number
    poolSource?: 'craft' | 'marksman' | 'desecrated' | 'all'
    itemClass?: string
    kind?: 'all' | 'p' | 's'
    limit?: number
  }): Promise<ModSearchHitResult[]>
}

export interface TradeApi {
  /**
   * Run Scalpel's trade search for a synthetic item. When `notes` or
   * `statPriority` are provided, numbered guide mods are matched and included.
   */
  openSearch(item: PluginTradeSearchItem): Promise<{
    url: string
    queryId: string
    total: number
    matchedStats?: number
  }>
}

export interface PricesApi {
  /**
   * Read the current poe.ninja price snapshot for the detected game + league.
   * Pass `category` to scope the result (e.g. `'currency'`); omit it for every
   * priced item. `category === 'currency'` returns the currency orbs in both
   * PoE1 and PoE2 (guaranteed); other slugs are ninja-derived per game.
   * `updatedAt` is the epoch-ms of the last successful host fetch, or null.
   */
  getPrices(opts?: { category?: string }): Promise<{ prices: PriceEntry[]; updatedAt: number | null }>
  /** Force the host to refetch ninja now, bypassing its cache TTL. */
  refresh(): Promise<void>
  /**
   * Fire after the host price snapshot refreshes (e.g. after `refresh()` or the
   * host's own periodic refetch completes). Does not fire on initial
   * subscription. Returns an unsubscribe function.
   */
  onChange(handler: () => void): () => void
}

export interface ScalpelPluginContext {
  readonly pluginId: string
  readonly pluginVersion: string

  getPoeVersion(): 1 | 2
  getLeague(): string
  /**
   * The league list for a game (defaults to the detected game), read live from
   * the host each call so it is correct on league-launch day. Returns the same
   * list Scalpel's own League setting offers: the host-fetched trade-API list,
   * or the bundled fallback before the host has fetched. Both games' lists are
   * always available regardless of which game is running, so a plugin running
   * PoE1 can still offer PoE2 leagues.
   */
  getLeagues(version?: 1 | 2): Promise<readonly string[]>
  // Snapshot accessors return the latest state at call time. Combine with the
  // matching onCurrent* subscribers for reactive code; use the accessors when
  // you just need a one-shot read (e.g. inside the render function).
  getCurrentItem(): PoeItem | null
  getCurrentZone(): Zone | null

  onCurrentItem(handler: (item: PoeItem) => void): () => void
  onCurrentZone(handler: (zone: Zone) => void): () => void
  onLeagueChange(handler: (league: string) => void): () => void

  /**
   * Subscribe to raw Client.txt lines as they are appended. The handler fires
   * once per new line, in order. Returns an unsubscribe function. Lines are the
   * raw log text (zone changes, level-ups, chat, whispers, trade, ...). Scalpel
   * does not parse these beyond what getCurrentZone already provides.
   */
  onLogLine(handler: (line: string) => void): () => void

  /**
   * The most recent buffered Client.txt lines (default: all buffered, up to
   * Scalpel's 200-line cap). Useful on plugin load to scan recent history
   * before the first onLogLine fires.
   */
  getRecentLogLines(count?: number): Promise<string[]>

  registerTab(opts: RegisterTabOptions): void

  /**
   * Exposes a hotkey slot to Scalpel's app-macro settings. The plugin doesn't
   * pick the key; the user binds it themselves. Exactly one hotkey per plugin
   * in v1; calling registerHotkey a second time throws.
   */
  registerHotkey(opts: RegisterHotkeyOptions, handler: () => void): void

  /**
   * Give this plugin a real Scalpel overlay window (chrome'd, draggable,
   * snap-anchored to the game) hosting `render`. Independent of registerTab: a
   * plugin may register a tab, an overlay, or both. Exactly one overlay per
   * plugin; a second call throws. `render` runs inside the overlay window's own
   * process and may return a cleanup function called on window teardown.
   */
  registerOverlay(opts: RegisterOverlayOptions, render: (container: HTMLElement) => (() => void) | void): void

  /** Open (show) this plugin's overlay window. No-op if no overlay registered. */
  openOverlay(): void

  /** Close (hide) this plugin's overlay window. No-op if not open / none registered. */
  closeOverlay(): void

  /**
   * Trigger the same flow Scalpel's main hotkey runs: send Ctrl+C to PoE,
   * read the clipboard, parse the item, fire onCurrentItem for everyone
   * (other plugins + Scalpel's filter/price-check views), and resolve to
   * the parsed item. Returns null when the clipboard doesn't contain a
   * recognisable PoE item.
   *
   * `opts.showOverlay` defaults to true, opening Scalpel's main overlay after
   * a successful capture. A plugin with its own overlay will usually want
   * `false` here, otherwise Scalpel's main overlay opens on top of it.
   *
   * `opts.dispatch` defaults to true. Set it to `false` for a private read: the
   * parsed item is returned to the caller alone, Scalpel's filter and
   * price-check views do not update, other plugins' `onCurrentItem` does not
   * fire, and no filter needs to be loaded (a plugin-only read doesn't require
   * one). Use this when your plugin wants the hovered item without touching
   * anyone else's view.
   */
  copyAndEvaluateItem(opts?: { showOverlay?: boolean; dispatch?: boolean }): Promise<PoeItem | null>

  /**
   * Capture the focused game window as raw RGBA pixels for the plugin to OCR or
   * pixel-inspect itself. Resolves to null when PoE is not focused (the capture
   * is scoped to the game window and never grabs the rest of the desktop). Pass
   * `region` (game CSS px) to capture and return only a sub-rectangle; omit it
   * for the whole window. One-shot - call it when you need a frame (e.g. from
   * your registered hotkey while the target menu is open).
   */
  captureGameWindow(region?: GameRect): Promise<GameCapture | null>

  /**
   * The cursor's position in game CSS px, measured from the game window's
   * top-left - the same coordinate space as setInteractiveRegion and
   * GameCapture.origin, so an annotation overlay can position against it
   * directly. Resolves to null when PoE is not focused or the cursor is
   * outside the game window. One-shot: call it from your hotkey handler.
   */
  getCursorPosition(): Promise<{ x: number; y: number } | null>

  /**
   * Switch the overlay to this plugin's tab. No-op if the tab isn't
   * registered yet.
   */
  openTab(): void

  fetch: typeof fetch
  storage: PluginStorage
  /**
   * Read / write / watch the running game's `_Config.ini`. The host resolves the
   * path from the detected PoE version; plugins cannot name a path. This is the
   * only file a plugin can touch on disk.
   */
  readonly gameConfig: GameConfigApi
  /**
   * List and read GGG BuildPlanner `.build` exports from the standard
   * Documents folder. Plugins cannot name arbitrary paths; only basenames from
   * `list()` are accepted by `read()`.
   */
  readonly buildPlanner: BuildPlannerApi
  /**
   * Trade search helpers. Uses the same main-process search as Price Check;
   * plugins cannot call the trade API directly from the renderer.
   */
  readonly trade: TradeApi
  readonly craft: CraftApi
  /**
   * Read the poe.ninja price data Scalpel already maintains (the same source
   * powering Price Check). Read-only; the host owns fetching, so plugins never
   * hit ninja directly (a renderer fetch would be CORS-blocked).
   */
  readonly prices: PricesApi
  readonly webPanel: WebPanelApi
  /**
   * Read the OS clipboard as plain text. Useful after copyAndEvaluateItem()
   * to pass PoE item text to external tools (e.g. Craft of Exile eimport).
   */
  readClipboardText(): Promise<string>
  openExternal(url: string): void
  log(...args: unknown[]): void
}
