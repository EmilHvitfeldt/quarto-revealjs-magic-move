import * as fs from 'node:fs';
import * as path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { type Locator, type Page, type TestInfo } from '@playwright/test';
import { testKey } from './slug';

declare global {
  interface Window {
    Reveal: {
      isReady(): boolean;
      next(): void;
      prev(): void;
      configure(options: Record<string, unknown>): void;
    };
  }
}

// Milliseconds after a step is triggered at which a frame is sampled.
// Covers start, early/mid/late motion, and the settled end state. Real-time
// sampling means an exact frame can drift a few ms between runs, so
// MAX_DIFF_PIXEL_RATIO below absorbs that rather than requiring byte-exact
// frames.
export const SAMPLE_SCHEDULE_MS = [0, 100, 250, 450, 700, 950];

const MAX_DIFF_PIXEL_RATIO = 0.04;
const shouldUpdateBaselines = process.env.UPDATE_SNAPSHOTS === '1' || process.env.UPDATE_SNAPSHOTS === 'true';

// Either a locator scoped to a single container (div-based magic-move: the
// animated clones live within that container's on-screen rectangle) or the
// whole page (slide-based magic-move: the overlay is position: fixed across
// the viewport and "which slide is current" changes every step, so there's
// no single stable element to scope to).
type ScreenshotTarget = Locator | Page;

export interface FilmstripFrame {
  /** Logical snapshot name, e.g. "r-step2-450ms.png" */
  name: string;
  /** Human-readable label for the review gallery, e.g. "Step 2 @ 450ms" */
  label: string;
}

export async function gotoSlide(page: Page, path: string, sectionId: string) {
  await page.goto(`${path}#/${sectionId}`);
  await page.waitForFunction(() => window.Reveal?.isReady());
  // Reveal.js's own slide transition (fade/slide between slides) is separate
  // from magic-move's own animation and just adds noise for slide-based
  // sequences. Harmless no-op for div-based/fragment sequences, which don't
  // use slide transitions at all.
  await page.evaluate(() => window.Reveal.configure({ transition: 'none' }));
}

export async function goNext(page: Page) {
  await page.evaluate(() => window.Reveal.next());
}

// fragmenthidden/slide-back run their own reverse FLIP animation (from/to
// swapped, see magic-move.js) rather than just snapping back, so this is a
// genuinely separate code path worth its own filmstrip coverage.
export async function goPrev(page: Page) {
  await page.evaluate(() => window.Reveal.prev());
}

// Deliberately does NOT use expect(locator).toHaveScreenshot(): that
// assertion (even with `animations: 'allow'`) waits for the page to stop
// visually changing before it ever returns a screenshot, which silently
// fast-forwards past the exact mid-animation frames a filmstrip needs.
// Locator/Page.screenshot() has no such stabilization wait, so it's used
// here with a hand-rolled pixelmatch comparison against the committed
// baseline.
export async function captureFrame(
  page: Page,
  target: ScreenshotTarget,
  name: string,
  label: string,
  frames: FilmstripFrame[],
  testInfo: TestInfo,
) {
  const snapshotDir = `${testInfo.file}-snapshots`;
  fs.mkdirSync(snapshotDir, { recursive: true });
  const baselinePath = path.join(snapshotDir, name);
  const actualPath = testInfo.outputPath(name);

  await target.screenshot({ path: actualPath });

  if (shouldUpdateBaselines || !fs.existsSync(baselinePath)) {
    fs.copyFileSync(actualPath, baselinePath);
  } else {
    const diffRatio = comparePngs(baselinePath, actualPath, testInfo.outputPath(name.replace(/\.png$/, '-diff.png')));
    if (diffRatio > MAX_DIFF_PIXEL_RATIO) {
      await testInfo.attach(`${name} (actual)`, { path: actualPath, contentType: 'image/png' });
      await testInfo.attach(`${name} (diff)`, {
        path: testInfo.outputPath(name.replace(/\.png$/, '-diff.png')),
        contentType: 'image/png',
      });
      throw new Error(
        `Frame "${name}" differs from baseline by ${(diffRatio * 100).toFixed(2)}% of pixels ` +
          `(limit ${(MAX_DIFF_PIXEL_RATIO * 100).toFixed(2)}%). Baseline: ${baselinePath}`,
      );
    }
  }

  frames.push({ name, label });
}

function comparePngs(baselinePath: string, actualPath: string, diffPath: string): number {
  const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
  const actual = PNG.sync.read(fs.readFileSync(actualPath));
  const { width, height } = baseline;

  if (actual.width !== width || actual.height !== height) {
    return 1; // dimension mismatch: treat as a full diff rather than throwing
  }

  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(baseline.data, actual.data, diff.data, width, height, { threshold: 0.1 });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));
  return diffPixels / (width * height);
}

export async function captureFilmstrip(
  page: Page,
  target: ScreenshotTarget,
  namePrefix: string,
  stepLabel: string,
  frames: FilmstripFrame[],
  testInfo: TestInfo,
) {
  let elapsed = 0;
  for (const sampleAt of SAMPLE_SCHEDULE_MS) {
    if (sampleAt > elapsed) {
      await page.waitForTimeout(sampleAt - elapsed);
      elapsed = sampleAt;
    }
    await captureFrame(
      page,
      target,
      `${namePrefix}-${sampleAt}ms.png`,
      `${stepLabel} @ ${sampleAt}ms`,
      frames,
      testInfo,
    );
  }
}

// Records the ordered list of frames captured for a test, so the review
// gallery (tools/visual-review/) can lay them out without having to
// reverse-engineer ordering from filenames.
export function writeManifest(testInfo: TestInfo, frames: FilmstripFrame[]) {
  const snapshotDir = `${testInfo.file}-snapshots`;
  fs.mkdirSync(snapshotDir, { recursive: true });
  const key = testKey(testInfo.titlePath);
  const manifestPath = path.join(snapshotDir, `manifest-${key}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify({ key, title: testInfo.title, frames }, null, 2));
}
