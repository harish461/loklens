/**
 * Ad placeholder. Renders nothing until AdSense is added (Phase 7, after launch).
 *
 * Reserved heights when enabled (design-system.md "AdSlot") — the slot must reserve this space before
 * the ad loads so CLS stays < 0.1:
 * - `mobile-banner`: 100 px tall, full width (home / listings, mobile)
 * - `in-article`:    250 px tall (after paragraph 3 of the body)
 * - `sidebar`:       300 × 250 (desktop sidebar)
 * - `leaderboard`:   728 × 90 (desktop, above content)
 */
export const AD_SIZES = {
  'mobile-banner': { width: '100%', height: 100 },
  'in-article': { width: '100%', height: 250 },
  sidebar: { width: 300, height: 250 },
  leaderboard: { width: 728, height: 90 },
} as const

export type AdSize = keyof typeof AD_SIZES

export const ADS_ENABLED = false

export function AdSlot({ size: _size }: { size: AdSize }) {
  if (!ADS_ENABLED) return null
  // Phase 7: render <div style={{ minHeight: AD_SIZES[_size].height }}> with the ad unit.
  return null
}
