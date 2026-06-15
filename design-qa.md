**Comparison Targets**

- Viewport: 390 x 844 CSS pixels, DPR 2
- Model images: `design-targets/home.png`, `cumulative-profit.png`, `investment-summary.png`,
  `investment-fund.png`, `investment-active.png`, `investment-fx.png`,
  and `settings.png`
- Implementation captures: `/tmp/finance-model-qa/*.png`
- Comparison composites: `/tmp/finance-model-qa/*-compare.png`

**Acceptance Method**

The acceptance threshold is 98%. The automated score uses the same 390 x 844 state for both images. Pixel and
edge comparisons are downsampled and blurred before measurement so dynamic
amounts, timestamps, and chart values do not dominate the result. It measures
structural pixels (20%), structural edges (20%), DOM layout geometry (35%),
color composition (15%), and render quality (10%). Every measured region must
also remain within 6 CSS pixels, with no clipping, overflow, or broken images.

**Scores**

| Screen | Score |
| --- | ---: |
| Home | 99.94% |
| Cumulative profit | 99.99% |
| Investment summary | 100.00% |
| Investment fund | 99.99% |
| Investment active | 99.97% |
| Investment FX | 99.99% |
| Settings | 99.90% |

**Automated Checks**

- Horizontal overflow: 0 on all seven screens
- Broken images: 0
- Clipped numeric/value elements: 0
- Primary bottom tabs and all four investment tabs: operable
- Home graphs support pinch/Control-wheel zoom and long-press horizontal panning
- The continuous graph covers 2024 through 2061 with no period preset controls
- Full-range pinch QA: chart width reduced to 250px for a 248px viewport
- Long-press QA: chart `scrollLeft` moved from 248 to 372 after zoom
- Production build and TypeScript validation: passed
- Machine-readable results: `/tmp/finance-model-qa/visual-qa.json`
- Difference images: `/tmp/finance-model-qa/*-diff.png`

**Visual Review**

- Header branding, white canvas, cyan/blue selected states, 14px rounded
  primary cards, 44px section headers, and 68px bottom navigation are
  consistent across every screen.
- Fund and active holdings keep long names and dollar/yen values readable.
- FX controls were compacted without reducing tap clarity.
- Settings accordions and backup controls match the model density.
- No actionable P0, P1, or P2 visual issues remain.

final result: passed
