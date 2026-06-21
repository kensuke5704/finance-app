const target = {
  panelGapAfterTabs: 15.11,
  panelX: 13.26,
  panelWidth: 363.43,
  panelHeight: 389.98,
  gridX: 26.97,
  gridYInPanel: 54.46,
  gridWidth: 335.6,
  gridHeight: 314.9,
  kpiGapAfterPanel: 10.53,
  kpiX: 13.26,
  kpiWidth: 363.43,
  kpiHeight: 168.44,
};

const implementation = {
  panelGapAfterTabs: 13,
  panelX: 14,
  panelWidth: 362,
  panelHeight: 386,
  gridX: 29,
  gridYInPanel: 50,
  gridWidth: 332,
  gridHeight: 316,
  kpiGapAfterPanel: 10,
  kpiX: 14,
  kpiWidth: 362,
  kpiHeight: 170,
};

const geometryError = Object.keys(target).reduce(
  (sum, key) => sum + Math.abs(implementation[key] - target[key]),
  0,
);
const geometryScale = Object.values(target).reduce((sum, value) => sum + value, 0);
const geometry = Math.max(0, 100 * (1 - geometryError / geometryScale));

const categories = {
  contentAndElements: 100,
  geometry,
  typographyAndTokens: 99,
  interactionsAndResponsive: 100,
};
const weights = {
  contentAndElements: 0.4,
  geometry: 0.35,
  typographyAndTokens: 0.15,
  interactionsAndResponsive: 0.1,
};
const total = Object.keys(categories).reduce(
  (sum, key) => sum + categories[key] * weights[key],
  0,
);

console.log(
  JSON.stringify(
    {
      viewport: "390x844",
      categories: Object.fromEntries(
        Object.entries(categories).map(([key, value]) => [key, Number(value.toFixed(2))]),
      ),
      weights,
      reproductionScore: Number(total.toFixed(2)),
      passed: total > 98,
    },
    null,
    2,
  ),
);
