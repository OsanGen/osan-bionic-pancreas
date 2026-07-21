import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const projectRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const outputDirectory = join(projectRoot, "visual-qa");
const baseUrl = "http://127.0.0.1:4173";

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"]
]);

const viewports = [
  { name: "desktop", width: 1440, height: 900, scenes: ["problem", "product"] },
  { name: "short-desktop", width: 1280, height: 720, scenes: ["problem", "equation", "landscape", "product", "roadmap"] },
  { name: "tablet", width: 768, height: 1024, scenes: ["product"] },
  { name: "mobile", width: 390, height: 844, scenes: ["problem", "product"] }
];

function startStaticServer() {
  const server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, baseUrl).pathname);
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = resolve(projectRoot, relativePath);
    const insideProject = filePath === projectRoot || filePath.startsWith(`${projectRoot}${sep}`);

    if (!insideProject) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    try {
      const body = await readFile(filePath);
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": contentTypes.get(extname(filePath)) ?? "application/octet-stream"
      });
      response.end(body);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });

  return new Promise((resolveStart, rejectStart) => {
    server.once("error", rejectStart);
    server.listen(4173, "127.0.0.1", () => resolveStart(server));
  });
}

function inspectLayout() {
  const rectangle = (selector) => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const { top, right, bottom, left, width, height } = element.getBoundingClientRect();
    return { top, right, bottom, left, width, height };
  };

  const copy = rectangle(".copy-column");
  const visual = rectangle(".visual-frame");
  const caption = rectangle(".visual-caption");
  const story = rectangle(".story-layout");
  const activeScene = document.querySelector(".scene-art.is-active");
  const frame = document.querySelector(".visual-frame")?.getBoundingClientRect();
  const activeText = activeScene ? [...activeScene.querySelectorAll("text")] : [];
  const textBoxes = activeText.map((element) => ({
    box: element.getBoundingClientRect(),
    text: element.textContent.trim()
  })).filter(({ box, text }) => text && box.width > 0 && box.height > 0);
  const clippedLabels = frame
    ? textBoxes.filter(({ box }) => {
        return box.left < frame.left - 1 || box.right > frame.right + 1 || box.top < frame.top - 1 || box.bottom > frame.bottom + 1;
      }).map(({ text }) => text)
    : [];
  const overlappingLabels = [];
  for (let index = 0; index < textBoxes.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < textBoxes.length; compareIndex += 1) {
      const first = textBoxes[index];
      const second = textBoxes[compareIndex];
      const horizontalIntersection = Math.min(first.box.right, second.box.right) - Math.max(first.box.left, second.box.left);
      const verticalIntersection = Math.min(first.box.bottom, second.box.bottom) - Math.max(first.box.top, second.box.top);

      if (horizontalIntersection > 1 && verticalIntersection > 1) {
        overlappingLabels.push(`${first.text} ↔ ${second.text}`);
      }
    }
  }
  const renderedLabelHeights = textBoxes.map(({ box }) => box.height);
  const columnsOverlap = window.innerWidth > 900 && copy && visual
    ? copy.right > visual.left
    : false;
  const primaryBottom = Math.max(copy?.bottom ?? 0, caption?.bottom ?? visual?.bottom ?? 0);

  return {
    activeScenes: document.querySelectorAll(".scene-art.is-active").length,
    clippedLabels,
    columnsOverlap,
    firstViewportFits: primaryBottom <= window.innerHeight + 1,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    minimumRenderedLabelHeight: renderedLabelHeights.length ? Math.min(...renderedLabelHeights) : null,
    overlappingLabels,
    primaryBottom,
    selectedStages: document.querySelectorAll(".stage-button[aria-selected='true']").length,
    story,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    visual
  };
}

await mkdir(outputDirectory, { recursive: true });

const server = await startStaticServer();
const browser = await chromium.launch();
const report = [];
const failures = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      deviceScaleFactor: 1,
      viewport: { width: viewport.width, height: viewport.height }
    });
    const page = await context.newPage();
    const browserSignals = [];

    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        browserSignals.push({ type: message.type(), text: message.text() });
      }
    });
    page.on("pageerror", (error) => browserSignals.push({ type: "pageerror", text: error.message }));
    page.on("requestfailed", (request) => browserSignals.push({
      type: "requestfailed",
      text: `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? "unknown"}`
    }));

    for (const scene of viewport.scenes) {
      await page.goto(`${baseUrl}/#${scene}`, { waitUntil: "networkidle" });
      await page.evaluate(async () => { await document.fonts.ready; });
      await page.waitForTimeout(350);

      const metrics = await page.evaluate(inspectLayout);
      const screenshot = `${viewport.name}--${scene}.jpg`;
      await page.screenshot({
        animations: "disabled",
        fullPage: false,
        path: join(outputDirectory, screenshot),
        quality: 90,
        type: "jpeg"
      });

      const sceneFailures = [];
      if (metrics.activeScenes !== 1) sceneFailures.push(`active scenes: ${metrics.activeScenes}`);
      if (metrics.selectedStages !== 1) sceneFailures.push(`selected stages: ${metrics.selectedStages}`);
      if (metrics.horizontalOverflow) sceneFailures.push("horizontal overflow");
      if (metrics.columnsOverlap) sceneFailures.push("desktop columns overlap");
      if (!metrics.firstViewportFits) sceneFailures.push(`primary story ends at ${metrics.primaryBottom.toFixed(1)}px`);
      if (metrics.clippedLabels.length) sceneFailures.push(`clipped SVG labels: ${metrics.clippedLabels.join(", ")}`);
      if (metrics.overlappingLabels.length) sceneFailures.push(`overlapping SVG labels: ${metrics.overlappingLabels.join(", ")}`);
      if (metrics.minimumRenderedLabelHeight !== null && metrics.minimumRenderedLabelHeight < 5.5) {
        sceneFailures.push(`smallest rendered SVG label is ${metrics.minimumRenderedLabelHeight.toFixed(1)}px high`);
      }

      if (sceneFailures.length) {
        failures.push(`${viewport.name}/${scene}: ${sceneFailures.join("; ")}`);
      }

      report.push({
        browserSignals: [...browserSignals],
        metrics,
        scene,
        screenshot,
        viewport: { width: viewport.width, height: viewport.height }
      });
    }

    if (browserSignals.length) {
      failures.push(`${viewport.name}: browser signals: ${JSON.stringify(browserSignals)}`);
    }

    await context.close();
  }

  const socialContext = await browser.newContext({ viewport: { width: 1200, height: 630 } });
  const socialPage = await socialContext.newPage();
  await socialPage.goto(`${baseUrl}/#product`, { waitUntil: "networkidle" });
  await socialPage.evaluate(async () => { await document.fonts.ready; });
  await socialPage.waitForTimeout(350);
  await socialPage.screenshot({
    animations: "disabled",
    fullPage: false,
    path: join(outputDirectory, "social-preview.jpg"),
    quality: 90,
    type: "jpeg"
  });
  await socialContext.close();
} finally {
  await browser.close();
  await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
}

await writeFile(join(outputDirectory, "report.json"), `${JSON.stringify({ failures, report }, null, 2)}\n`);

if (failures.length) {
  throw new Error(`Visual QA failed:\n- ${failures.join("\n- ")}`);
}

console.log(`Visual QA passed with ${report.length} responsive scene captures.`);
