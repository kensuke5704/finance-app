# FX UI Design QA

- Source visual truth: `/Users/kensuke_kawamura/Downloads/スクリーンショット 2026-06-21 14.55.34.png`
- Implementation screenshots:
  - `/tmp/finance-fx-ui-final-v2-tablet.png`
  - `/tmp/finance-fx-ui-final-v20.png`
- Combined comparison evidence: `/tmp/finance-fx-ui-comparison-v2.png`
- Viewports: `603 × 844` and `390 × 844`
- State: Investment → FX, populated position data and daily charts

## Findings

- No actionable P0/P1/P2 findings remain.
- At 603px, all eight position controls measure `272.5 × 40px`; their field cells measure `272.5 × 60px`. No control overlaps the next row.
- At 390px, all eight controls measure `162 × 40px`; no horizontal page or field overflow is present.
- FX charts now use the Home chart’s responsive dimensions:
  - 603px viewport: `583 × 412px`, 310px plot area.
  - 390px viewport: `362 × 326px`, 250px plot area.
- Chart line width is `3px`, matching Home.
- Daily horizontal-axis labels render the first available trading date of each month.
- The rendered SVG and its 250px mobile viewport now have the same height; date labels are visibly inside the chart instead of merely existing below the clipped viewport.
- Both USD/JPY legend entries fit on one visible row, and every legend color matches its plotted line.
- Tap detail remains visible after release. Labels and values occupy separate lines; measured text rectangles do not overlap.
- PWA cache version was advanced to v20 so updated CSS and JavaScript replace stale installed-app assets.

## Required Fidelity Surfaces

- Fonts and typography: Existing Home chart typography and weights are inherited without FX-specific popup overrides.
- Spacing and layout rhythm: Input rows are explicitly bounded; chart header, body, plot, and legend heights match Home at both breakpoints.
- Colors and visual tokens: Existing Home chart colors are preserved, with red retained for the maintenance-rate reference series.
- Image quality and asset fidelity: Existing app icon assets are unchanged.
- Copy and content: Japanese field labels, values, legends, and date labels remain accurate.

## Patches Made

- Locked form field and native input heights at all viewport sizes.
- Removed the FX fit-to-width behavior and adopted Home’s zoom, pan, and initial visible-point settings.
- Added daily date-axis rendering.
- Made tap popups persistent after release while retaining long-press panning.
- Matched chart dimensions to Home at phone and tablet/desktop breakpoints.
- Removed the legacy forced 310px SVG height that clipped mobile date labels.
- Bumped Service Worker and registration cache versions to v20.

## Validation

- `npm run pages:build`: passed.
- TypeScript compilation: passed.
- 603px and 390px browser geometry checks: passed.
- Horizontal overflow: `0px`.
- Tooltip overlap check: passed.

## Follow-up Polish

- None required for this request.

final result: passed
