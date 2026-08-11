// @vitest-environment jsdom

// PUBLIC PLUGIN CONTRACT LOCK.
//
// Installed third-party plugins are prebuilt against this exact surface. At
// runtime they import these names from `@scalpelpoe/plugin-sdk` (the host
// serves the bundle as scalpel-internal://sdk.js) and they receive a
// ScalpelPluginContext shaped exactly like the keys below.
//
// REMOVING or RENAMING any entry here breaks every already-installed plugin
// that used it. That is a breaking change: it needs a conscious decision, a
// host major-version bump, and a migration note in the release changelog.
// ADDING an entry is additive and safe - just append it to the list.
//
// This test exists so that breakage is LOUD instead of silent. The other SDK
// tests (runtime.test.tsx, types.test.ts) assert behavior and types of
// individual exports; only this file pins the exact *set*, so a rename or
// deletion fails CI and shows up in the diff as an intentional contract edit
// rather than slipping through with a quietly-updated assertion.
//
// Type-only exports (ScalpelPluginContext, PluginActivate, PluginManifest,
// RegisterTabOptions, PluginStorage, RegisterHotkeyOptions) are erased at
// runtime and are not covered here; they are guarded by types.test.ts and the
// generated rolled-up .d.ts.

import { describe, expect, it } from 'vitest'
import { createPluginContext } from '../../renderer/src/plugins/context'
import type { PluginContextFactoryDeps } from '../../renderer/src/plugins/types'
import * as SDK from './index'

// The exact runtime (value) exports of @scalpelpoe/plugin-sdk, sorted.
const EXPECTED_SDK_EXPORTS = [
  'Button',
  'ErrorBanner',
  'ExternalLinkButton',
  'HotkeyField',
  'HotkeyRecorder',
  'InfoChip',
  'ItemChip',
  'Label',
  'LeagueDropdown',
  'Notice',
  'RARITY_COLORS',
  'RemoveButton',
  'SKILL_GEM_CLASSES',
  'ScrubInput',
  'SettingSelectBox',
  'SettingToggleBox',
  'Slider',
  'TREND_DOWN_COLOR',
  'TREND_THRESHOLD_PCT',
  'TREND_UP_COLOR',
  'TextInput',
  'Textarea',
  'Toggle',
  'compareVersions',
  'defaultPoeItem',
  'deriveItemVariant',
  'externalLinkUrl',
  'findRelated',
  'formatDust',
  'formatPrice',
  'getDustInfo',
  'getGameFeatures',
  'getItemIcon',
  'getTrendDirection',
  'isClusterJewel',
  'isSkillGem',
  'isTownOrHideout',
  'keyEventToAccelerator',
  'ninjaLeagueSegment',
  'ninjaLinkUrl',
  'prettyHotkey',
  'useCurrentZone',
  'versionMatches',
].sort()

// The exact keys of the object a plugin receives as its ScalpelPluginContext,
// sorted. This pins the runtime shape produced by createPluginContext, which
// is what a running plugin actually touches (the type side is in types.ts /
// types.test.ts; this catches implementation drift away from that type).
const EXPECTED_CONTEXT_KEYS = [
  'buildPlanner',
  'captureGameWindow',
  'closeOverlay',
  'copyAndEvaluateItem',
  'craft',
  'fetch',
  'filter',
  'gameConfig',
  'getCurrentItem',
  'getCurrentZone',
  'getLeague',
  'getLeagues',
  'getPoeVersion',
  'getRecentLogLines',
  'log',
  'ninja',
  'onCurrentItem',
  'onCurrentZone',
  'onLeagueChange',
  'onLogLine',
  'openExternal',
  'openOverlay',
  'openTab',
  'pluginId',
  'pluginVersion',
  'prices',
  'readClipboardText',
  'registerHotkey',
  'registerOverlay',
  'registerTab',
  'storage',
  'trade',
  'webPanel',
].sort()

function stubDeps(): PluginContextFactoryDeps {
  const unsubscribe = (): void => {}
  return {
    pluginId: 'surface-test',
    pluginVersion: '0.0.0',
    getPoeVersion: () => 1,
    getLeague: () => '',
    getLeagues: async () => [],
    getCurrentItem: () => null,
    getCurrentZone: () => null,
    subscribeCurrentItem: () => unsubscribe,
    subscribeCurrentZone: () => unsubscribe,
    subscribeLeagueChange: () => unsubscribe,
    onLogLine: () => unsubscribe,
    getRecentLogLines: async () => [],
    openExternal: () => {},
    storage: {
      get: async () => null,
      set: async () => {},
      delete: async () => {},
      keys: async () => [],
    },
    gameConfig: {
      read: async () => ({ content: '', path: '' }),
      write: async () => ({ backupPath: null }),
      onChange: () => () => {},
    },
    buildPlanner: {
      getPath: async () => ({ path: '' }),
      list: async () => ({ path: '', files: [] }),
      read: async () => ({ path: '', content: '' }),
      openFolder: async () => ({ path: '' }),
    },
    prices: {
      getPrices: async () => ({ prices: [], updatedAt: null }),
      refresh: async () => {},
      onChange: () => () => {},
    },
    ninja: {
      getCharacterModel: async () => ({ type: 'found', charModel: {}, modelVersion: 92 }),
    },
    filter: {
      getSections: async () => ({ ok: true, sections: [] }),
      getBlock: async () => ({ ok: false }),
      setTierVisibility: async () => ({ ok: false }),
      saveBlockEdit: async () => ({ ok: false }),
      addBaseTypeToTier: async () => ({ ok: false }),
      removeBaseTypeFromTier: async () => ({ ok: false }),
      moveItemTier: async () => ({ ok: false }),
      batchMoveItemTier: async () => ({ ok: false }),
      previewBaseTypeMove: async () => ({}),
      deleteFilterBlock: async () => ({ ok: false }),
      moveFilterBlock: async () => ({ ok: false }),
      insertSectionRule: async () => ({ ok: false }),
      applySectionDelta: async () => ({}),
      matchItem: async () => ({}),
      parseItemText: async () => ({}),
      getLastEvaluatedItem: async () => ({}),
      getRecentEvaluatedItems: async () => [],
      simulateLootDrops: async () => ({}),
      preflight: async () => ({}),
      findConditions: async () => ({ ok: true, hits: [] }),
      getHistory: async () => [],
      undoEdit: async () => ({ ok: false }),
      undoToEntry: async () => ({ ok: false }),
      undoSectionHistory: async () => ({ ok: false, undone: 0 }),
      listVersions: async () => [],
      createCheckpoint: async () => ({ ok: false }),
      restoreVersion: async () => ({ ok: false }),
      deleteVersion: async () => ({ ok: false }),
      diffFilterFiles: async () => ({}),
      diffFilterVsVersion: async () => ({}),
      previewReapply: async () => ({}),
      applyReapply: async () => ({}),
      exportIntents: async () => ({}),
      importIntents: async () => ({}),
      getChanges: async () => [],
      reload: async () => ({ ok: false }),
      getSearchableItems: async () => [],
      getIconCache: async () => ({}),
      onIconCacheUpdated: () => () => {},
      getSettings: async () => ({}),
      listProfiles: async () => [],
      scanFilterDir: async () => [],
      detectActiveGameFilter: async () => ({}),
      scanSoundFiles: async () => [],
      getSoundDataUrl: async () => null,
      batchLookupPrices: async () => ({}),
      onChanged: () => () => {},
      onZoneChanged: () => () => {},
      filterBladeUrl: async () => null,
    },
    trade: {
      openSearch: async () => ({ url: '', queryId: '', total: 0 }),
      priceCheck: async () => ({
        url: '',
        queryId: '',
        total: 0,
        pricesDivine: [],
        cheapestDivine: null,
        estimateDivine: null,
        pricedCount: 0,
      }),
      scanWarrants: async () => ({
        total: 0,
        fetched: 0,
        queryId: '',
        league: '',
        groups: [],
        listings: [],
        webSearchUrl: '',
      }),
      warrantsCatalog: async () => ({ skills: [], supports: [] }),
      whisperSeller: async () => {},
      visitHideout: async () => {},
      getAuth: async () => ({ loggedIn: false }),
      login: async () => {},
    },
    webPanel: {
      open: async () => {},
      navigate: async () => {},
      close: async () => {},
    },
    readClipboardText: async () => '',
    craft: {
      listActions: async () => [],
      simulate: async () => ({ actionId: '', label: '', samples: 0, outcomes: [] }),
    },
    registerTab: () => {},
    registerHotkey: () => {},
    openTab: () => {},
    copyAndEvaluateItem: async () => null,
    captureGameWindow: async () => null,
    registerOverlay: () => {},
    openOverlay: () => {},
    closeOverlay: () => {},
  }
}

describe('plugin public contract', () => {
  it('SDK exports exactly the locked runtime surface', () => {
    expect(Object.keys(SDK).sort()).toEqual(EXPECTED_SDK_EXPORTS)
  })

  it('every locked SDK export resolves (not a missing-externalization stub)', () => {
    for (const name of EXPECTED_SDK_EXPORTS) {
      expect((SDK as Record<string, unknown>)[name], `SDK.${name} is undefined`).toBeDefined()
    }
  })

  it('ScalpelPluginContext exposes exactly the locked keys', () => {
    const ctx = createPluginContext(stubDeps())
    expect(Object.keys(ctx).sort()).toEqual(EXPECTED_CONTEXT_KEYS)
  })
})
