// Public entry for the Scalpel plugin SDK.
// Stable surface - treat additions as additive only.
//
// The triple-slash reference pulls in an ambient declaration of the
// `window.api` subset the SDK depends on, so downstream consumers don't see
// type errors in HotkeyField / HotkeyRecorder / useCurrentZone.
/// <reference path="./globals.d.ts" />

export * from './runtime'
export type {
  CoeCatalogFamilyResult,
  CoeCatalogGroupResult,
  CoeCatalogItemResult,
  CoeCatalogResult,
  CraftApi,
  CraftItemStateResult,
  CraftSequenceConfigResult,
  CraftSequenceConditionResult,
  CraftSequenceRunResult,
  CraftSequenceStepResult,
  ModGroupReportResult,
  ModPoolReportResult,
  ModTierReportResult,
  FilterApi,
  NinjaApi,
  NinjaCharacterModelRequest,
  NinjaCharacterModelResult,
  PluginActivate,
  PluginManifest,
  PluginStorage,
  PluginTradeSearchItem,
  PriceEntry,
  PricesApi,
  RegisterHotkeyOptions,
  RegisterOverlayOptions,
  RegisterTabOptions,
  ScalpelPluginContext,
  SeqOnFailureResult,
  SeqOnSuccessResult,
  SupportLinkOrder,
  SupportPresenceMode,
  TradeApi,
  WantSupportFilter,
  WarrantCatalog,
  WarrantScanOptions,
  WarrantScanResult,
} from './types'
