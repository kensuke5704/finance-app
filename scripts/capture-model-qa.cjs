const { chromium } = require(
  "/Users/kensuke_kawamura/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);

const output = "/tmp/finance-model-qa";

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      "finance-app-authenticated-until",
      String(Date.now() + 60 * 60 * 1000),
    );
  });
  await page.goto("http://127.0.0.1:4173/finance-app/", {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForSelector(".app-header");
  await page.screenshot({
    path: `${output}/home.png`,
    fullPage: false,
  });

  await page.locator(".bottom-tabs .tab").nth(1).click();
  await page.waitForTimeout(500);

  const tabs = page.locator(".asset-inner-tabs .chart-tab");
  const captures = [
    [0, "investment-summary", 500],
    [1, "investment-fund", 800],
    [2, "investment-active", 10000],
    [3, "investment-fx", 800],
  ];

  for (const [index, name, wait] of captures) {
    await tabs.nth(index).click();
    await page.waitForTimeout(wait);
    await page.screenshot({
      path: `${output}/${name}.png`,
      fullPage: false,
    });
  }

  await page.locator(".bottom-tabs .tab").nth(2).click();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `${output}/settings.png`,
    fullPage: false,
  });
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
