# FX Position Card Design QA

- Source visual truth: `/Users/kensuke_kawamura/Downloads/スクリーンショット 2026-06-21 15.23.03.png`
- Implementation screenshot: `/tmp/finance-fx-overview-card-v22.png`
- Viewport: `390 × 844`
- State: Investment → FX, overview card open

## Findings

- No actionable P0/P1/P2 findings remain.
- Entry date and daily swap controls share the same top coordinate and `40px` height.
- Position settings, risk values, and both charts are contained in one visible card.
- The card is open by default, can be collapsed, and restores its saved closed/open state after reload.
- The gap between risk values and charts is removed; sections use a shared divider.
- FX chart legends use the same centered placement, spacing, and font size as Home.
- The maintenance-rate legend now reads only `維持率100%`.
- The explanatory sentence under `FX確定損益` is removed.
- Both charts fit the complete entry-date-to-latest-market-date range.
- Chart horizontal overflow is hidden; rendered and viewport widths match, so sliding and zooming are unavailable.
- Tap point details remain available without enabling chart navigation.

## Validation

- `npm run pages:build`: passed.
- TypeScript compilation: passed.
- Horizontal page overflow: `0px`.
- Fixed chart navigation: `clientWidth === scrollWidth`.
- Collapsed-state persistence after reload: passed.
- PWA cache version: v22.

final result: passed

# Unified Surface System QA

- Primary cards: one complete `1px` frame, `16px` radius, white background.
- Secondary summary cards: the same frame color with a `12px` radius.
- Card headers: one full-width bottom divider; no independent rounded corners.
- Nested accordions and repeated groups: flat rows with one bottom divider.
- Final nested row: no trailing divider.
- FX position overview: one outer card; risk and chart sections remain unframed
  internally and are separated only by aligned dividers.
- PWA cache version: v23.
