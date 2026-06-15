const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { chromium } = require(
  "/Users/kensuke_kawamura/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);

const root = path.resolve(__dirname, "..");
const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, "visual-qa.config.json"), "utf8"),
);
const outputDir = "/tmp/finance-model-qa";

const clamp = (value, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));
const round = (value) => Math.round(value * 100) / 100;

async function normalizedPixels(file, { scale = 1, blur = 0 } = {}) {
  let pipeline = sharp(file)
    .resize(
      Math.round(config.viewport.width * config.viewport.deviceScaleFactor * scale),
      Math.round(config.viewport.height * config.viewport.deviceScaleFactor * scale),
      { fit: "fill" },
    );
  if (blur > 0) pipeline = pipeline.blur(blur);
  const { data, info } = await pipeline.removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, info };
}

function pixelSimilarity(target, capture) {
  let difference = 0;
  for (let index = 0; index < target.length; index += 1) {
    difference += Math.abs(target[index] - capture[index]);
  }
  return clamp(100 * (1 - difference / (target.length * 255)));
}

function grayscale(data) {
  const result = new Uint8Array(data.length / 3);
  for (let source = 0, target = 0; source < data.length; source += 3, target += 1) {
    result[target] =
      data[source] * 0.299 + data[source + 1] * 0.587 + data[source + 2] * 0.114;
  }
  return result;
}

function edgeMap(gray, width, height) {
  const edges = new Uint8Array(gray.length);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const gx =
        -gray[index - width - 1] + gray[index - width + 1] -
        2 * gray[index - 1] + 2 * gray[index + 1] -
        gray[index + width - 1] + gray[index + width + 1];
      const gy =
        -gray[index - width - 1] - 2 * gray[index - width] -
        gray[index - width + 1] + gray[index + width - 1] +
        2 * gray[index + width] + gray[index + width + 1];
      edges[index] = Math.min(255, Math.hypot(gx, gy));
    }
  }
  return edges;
}

function cosineSimilarity(first, second) {
  let dot = 0;
  let firstLength = 0;
  let secondLength = 0;
  for (let index = 0; index < first.length; index += 1) {
    dot += first[index] * second[index];
    firstLength += first[index] ** 2;
    secondLength += second[index] ** 2;
  }
  if (!firstLength || !secondLength) return 0;
  return clamp(100 * dot / Math.sqrt(firstLength * secondLength));
}

function histogram(data) {
  const bins = new Float64Array(12 * 3);
  for (let index = 0; index < data.length; index += 3) {
    bins[Math.min(11, Math.floor(data[index] / 22))] += 1;
    bins[12 + Math.min(11, Math.floor(data[index + 1] / 22))] += 1;
    bins[24 + Math.min(11, Math.floor(data[index + 2] / 22))] += 1;
  }
  const total = data.length / 3;
  return bins.map((value) => value / total);
}

function histogramIntersection(first, second) {
  let intersection = 0;
  for (let index = 0; index < first.length; index += 1) {
    intersection += Math.min(first[index], second[index]);
  }
  return clamp(100 * intersection / 3);
}

function geometryScore(regions) {
  if (!regions.length) return 0;
  const scored = regions.map((region) => {
    if (!region.actual) return { ...region, score: 0, maxError: 999 };
    const errors = region.target
      .map((value, index) =>
        value === null ? null : Math.abs(value - region.actual[index]),
      )
      .filter((value) => value !== null);
    const meanError = errors.reduce((sum, value) => sum + value, 0) / errors.length;
    const maxError = Math.max(...errors);
    return {
      ...region,
      meanError: round(meanError),
      maxError: round(maxError),
      score: round(clamp(100 - meanError * 8 - Math.max(0, maxError - 6) * 3)),
    };
  });
  return {
    score: round(scored.reduce((sum, region) => sum + region.score, 0) / scored.length),
    regions: scored,
  };
}

async function inspectScreen(page, screen) {
  return page.evaluate((regions) => {
    const body = document.documentElement;
    const brokenImages = [...document.images]
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => image.src);
    const clipped = [...document.querySelectorAll("b,strong,.asset-product-value,.composition-total-row")]
      .filter((element) => {
        const style = getComputedStyle(element);
        return (
          element.scrollWidth > element.clientWidth + 1 &&
          style.overflow !== "visible"
        );
      })
      .map((element) => element.textContent?.trim())
      .filter(Boolean);
    const overlaps = [...document.querySelectorAll("button,input,select")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          element.classList.contains("visually-hidden")
        ) {
          return false;
        }
        return rect.width < 28 || rect.height < 28;
      })
      .map((element) => element.textContent?.trim() || element.getAttribute("aria-label") || element.tagName);
    const measuredRegions = regions.map((region) => {
      const element = document.querySelector(region.selector);
      if (!element) return { ...region, actual: null };
      const rect = element.getBoundingClientRect();
      return {
        ...region,
        actual: [rect.x, rect.y, rect.width, rect.height].map((value) =>
          Math.round(value * 100) / 100,
        ),
      };
    });
    return {
      horizontalOverflow: Math.max(0, body.scrollWidth - window.innerWidth),
      brokenImages,
      clipped,
      undersizedControls: overlaps,
      regions: measuredRegions,
    };
  }, screen.regions);
}

function renderQualityScore(inspection) {
  const deductions =
    Math.min(40, inspection.horizontalOverflow * 2) +
    inspection.brokenImages.length * 25 +
    inspection.clipped.length * 8 +
    inspection.undersizedControls.length * 2;
  return clamp(100 - deductions);
}

async function createDifference(targetPath, capturePath, outputPath) {
  const target = await sharp(targetPath)
    .resize(780, 1688, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  const capture = await sharp(capturePath)
    .resize(780, 1688, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  const diff = Buffer.alloc(target.length);
  for (let index = 0; index < target.length; index += 1) {
    diff[index] = Math.min(255, Math.abs(target[index] - capture[index]) * 3);
  }
  await sharp(diff, { raw: { width: 780, height: 1688, channels: 3 } })
    .png()
    .toFile(outputPath);
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const page = await browser.newPage({
    viewport: {
      width: config.viewport.width,
      height: config.viewport.height,
    },
    deviceScaleFactor: config.viewport.deviceScaleFactor,
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
  await page.waitForSelector(".app-header", { timeout: 60000 });

  const navigation = {
    home: async () => {},
    "cumulative-profit": async () => {
      await page
        .locator(".chart-tab-panel > .chart-tabs .chart-tab")
        .nth(1)
        .click();
    },
    "investment-summary": async () => {
      await page.locator(".bottom-tabs .tab").nth(1).click();
      await page.locator(".asset-inner-tabs .chart-tab").nth(0).click();
    },
    "investment-fund": async () => page.locator(".asset-inner-tabs .chart-tab").nth(1).click(),
    "investment-active": async () => page.locator(".asset-inner-tabs .chart-tab").nth(2).click(),
    "investment-fx": async () => page.locator(".asset-inner-tabs .chart-tab").nth(3).click(),
    settings: async () => page.locator(".bottom-tabs .tab").nth(2).click(),
  };

  const results = {};
  for (const [name, screen] of Object.entries(config.screens)) {
    await navigation[name]();
    await page.waitForTimeout(name === "investment-active" ? 3000 : 300);
    await page.screenshot({ path: screen.capture, fullPage: false });
    const inspection = await inspectScreen(page, screen);
    const targetPath = path.resolve(root, screen.target);
    const targetPixels = await normalizedPixels(targetPath, {
      scale: 0.25,
      blur: 6,
    });
    const capturePixels = await normalizedPixels(screen.capture, {
      scale: 0.25,
      blur: 6,
    });
    const pixel = pixelSimilarity(targetPixels.data, capturePixels.data);
    const targetEdgePixels = await normalizedPixels(targetPath, {
      scale: 0.25,
      blur: 16,
    });
    const captureEdgePixels = await normalizedPixels(screen.capture, {
      scale: 0.25,
      blur: 16,
    });
    const targetEdges = edgeMap(
      grayscale(targetEdgePixels.data),
      targetEdgePixels.info.width,
      targetEdgePixels.info.height,
    );
    const captureEdges = edgeMap(
      grayscale(captureEdgePixels.data),
      captureEdgePixels.info.width,
      captureEdgePixels.info.height,
    );
    const edge = cosineSimilarity(targetEdges, captureEdges);
    const color = histogramIntersection(
      histogram(targetPixels.data),
      histogram(capturePixels.data),
    );
    const geometry = geometryScore(inspection.regions);
    const quality = renderQualityScore(inspection);
    const weighted =
      pixel * config.weights.pixelSimilarity / 100 +
      edge * config.weights.edgeSimilarity / 100 +
      geometry.score * config.weights.layoutGeometry / 100 +
      color * config.weights.colorComposition / 100 +
      quality * config.weights.renderQuality / 100;
    const score = round(weighted);
    const result = {
      score,
      passed: score >= config.passingScore &&
        geometry.regions.every((region) => region.maxError <= 6) &&
        quality === 100,
      metrics: {
        pixelSimilarity: round(pixel),
        edgeSimilarity: round(edge),
        layoutGeometry: geometry.score,
        colorComposition: round(color),
        renderQuality: round(quality),
      },
      geometry: geometry.regions,
      inspection,
    };
    results[name] = result;
    await createDifference(
      targetPath,
      screen.capture,
      path.join(outputDir, `${name}-diff.png`),
    );
  }
  await browser.close();

  const report = {
    generatedAt: new Date().toISOString(),
    threshold: config.passingScore,
    allPassed: Object.values(results).every((result) => result.passed),
    results,
  };
  fs.writeFileSync(
    path.join(outputDir, "visual-qa.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    Object.entries(results)
      .map(([name, result]) =>
        `${name.padEnd(20)} ${result.score.toFixed(2)} ${result.passed ? "PASS" : "FAIL"}`,
      )
      .join("\n"),
  );
  if (!report.allPassed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
