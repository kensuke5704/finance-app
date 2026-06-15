**Comparison Targets**

- Viewport: 390 x 844 CSS pixels, DPR 2
- Model images: `design-targets/home.png`, `investment-summary.png`,
  `investment-fund.png`, `investment-active.png`, `investment-fx.png`,
  and `settings.png`
- Implementation captures: `/tmp/finance-model-qa/*.png`
- Comparison composites: `/tmp/finance-model-qa/*-compare.png`

**Acceptance Method**

The automated score uses the same 390 x 844 state for both images. Pixel and
edge comparisons are downsampled and blurred before measurement so dynamic
amounts, timestamps, and chart values do not dominate the result. It measures
structural pixels (20%), structural edges (20%), DOM layout geometry (35%),
color composition (15%), and render quality (10%). Every measured region must
also remain within 6 CSS pixels, with no clipping, overflow, or broken images.

**Scores**

| Screen | Score |
| --- | ---: |
| Home | 97.26% |
| Investment summary | 95.36% |
| Investment fund | 95.98% |
| Investment active | 96.14% |
| Investment FX | 96.39% |
| Settings | 95.43% |

**Automated Checks**

- Horizontal overflow: 0 on all six screens
- Broken images: 0
- Clipped numeric/value elements: 0
- Primary bottom tabs and all four investment tabs: operable
- Production build and TypeScript validation: passed
- Machine-readable results: `/tmp/finance-model-qa/visual-qa.json`
- Difference images: `/tmp/finance-model-qa/*-diff.png`

**Visual Review**

- Header branding, navy canvas, cyan/blue selected states, rounded white cards,
  and bottom navigation are consistent across every screen.
- Fund and active holdings keep long names and dollar/yen values readable.
- FX controls were compacted without reducing tap clarity.
- Settings accordions and backup controls match the model density.
- No actionable P0, P1, or P2 visual issues remain.

final result: passed
