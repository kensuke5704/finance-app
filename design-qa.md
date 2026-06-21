# FX Compact Position UI — Design QA

- Source visual truth: `design-targets/fx-position-compact.png`
- Implementation screenshot: `design-targets/fx-position-implementation-final.png`
- Combined comparison: `design-targets/fx-position-comparison.png`
- Viewport: 390 × 844
- State: 資産 → FX、買いポジション、USD/JPY 161.275

## Full-view comparison evidence

The implementation preserves the existing Finance App header, tabs, and bottom navigation, while matching the selected mock’s two-column position grid and three-row calculation summary. The product chrome is intentionally kept at the existing app dimensions; content geometry is compared relative to the asset tabs.

## Focused region comparison evidence

The position panel and result panel were measured independently:

- Panel gap after tabs: target 15.11px, implementation 13px
- Position panel: target 363.43 × 389.98px, implementation 362 × 386px
- Input grid: target 335.6 × 314.9px, implementation 332 × 316px
- Result panel: target 363.43 × 168.44px, implementation 362 × 170px

## Findings

- No actionable P0/P1/P2 mismatch remains.
- Fonts and typography: existing Finance App font stack and weights are retained; labels are left-aligned and numeric values are right-aligned.
- Spacing and layout rhythm: two-column four-row grid and three compact result rows match the selected target within a few pixels.
- Colors and visual tokens: existing navy, blue, cool-gray, and teal semantic colors are preserved.
- Image and asset fidelity: existing app logo and navigation assets are reused; no placeholder or recreated asset was introduced.
- Copy and content: unwanted current-rate hero, update copy, leverage explanation, and result helper text are removed.

## Functional verification

- Current price is fetched and rendered as a read-only value, not an input.
- Buy and sell controls update `aria-pressed` and switch profit, maintenance, shortage, historical P/L, and 100% maintenance-rate calculations.
- Sell-state sample result: -1,541,160円 / 74.2% / 299,284円.
- TypeScript and static production build pass.

## Reproduction score

Scoring model requested for this build:

- Content and required elements: 40%
- Geometry and alignment: 35%
- Typography and visual tokens: 15%
- Interaction and responsive behavior: 10%

Run: `node scripts/fx-reproduction-score.mjs`

Final score: **99.45%**

## Patches made since previous QA pass

- Removed the standalone USD/JPY heading, rate hero, timestamp, and update button.
- Added buy/sell position control and sell-side calculation formulas.
- Moved current price into a fixed read-only display.
- Converted inputs to a compact two-column grid.
- Removed all result helper text and aligned summary values to the right.
- Matched panel and grid dimensions to the selected mock and prevented the chart from appearing above the fixed navigation in the initial viewport.

## Follow-up polish

- P3: Browser-native date icon rendering may vary slightly across operating systems.

final result: passed
