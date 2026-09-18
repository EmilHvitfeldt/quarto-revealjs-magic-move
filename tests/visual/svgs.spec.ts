import { test, type Page, type TestInfo } from '@playwright/test';
import {
  captureFilmstrip,
  captureFrame,
  type FilmstripFrame,
  goNext,
  goPrev,
  gotoSlide,
  waitForSvgMagicMoveReady,
  writeManifest,
} from './filmstrip';

// Some of these transitions (histogram, bar-to-pie) move a lot of pixels
// very quickly across the whole page, so a few ms of real-time sampling
// drift shifts the diff ratio more than the filmstrip.ts default tolerates
// — verified flaky at the default across repeated runs, stable at this.
const SVG_MAX_DIFF_PIXEL_RATIO = 0.08;

// Runs an SVG magic-move sequence forward through all its steps and back
// down again, capturing a filmstrip for every transition. Shared across
// all sequences below since they're all the same shape: slide-based
// navigation through examples/svgs.qmd (see slide-based.spec.ts for why
// frames are captured full-page rather than via a scoped locator).
//
// captureMidFrames=false skips the mid-animation samples and captures only
// the settled end of each step. "Bar chart to pie chart" needs this: its
// intermediate frames (rects interpolating into pie wedges) are genuinely
// non-deterministic run to run — verified via 8 repeated runs showing
// 8-14% diff ratios on mid-flight samples specifically, while the settled
// start/end states were stable every time. That's very likely because
// these two slides aren't a before/after of the same chart, they're two
// unrelated chart types with no "## Break" between them in
// examples/svgs.qmd, so groupConsecutiveSvgSlides groups them into one
// sequence by accident; the shape-interpolation algorithm apparently
// doesn't produce a stable intermediate shape for a mismatch this large.
// Worth a maintainer's attention independent of this test suite.
async function runSvgSequence(
  page: Page,
  testInfo: TestInfo,
  startId: string,
  prefix: string,
  stepCount: number,
  captureMidFrames = true,
) {
  await gotoSlide(page, '/examples/svgs.html', startId);
  await waitForSvgMagicMoveReady(page);
  const frames: FilmstripFrame[] = [];

  await captureFrame(
    page,
    page,
    `${prefix}-step1-initial.png`,
    'Step 1 (initial)',
    frames,
    testInfo,
    SVG_MAX_DIFF_PIXEL_RATIO,
  );

  const captureStep = async (name: string, label: string) => {
    if (captureMidFrames) {
      await captureFilmstrip(page, page, name, label, frames, testInfo, SVG_MAX_DIFF_PIXEL_RATIO);
    } else {
      await page.waitForTimeout(950);
      await captureFrame(page, page, `${name}-settled.png`, `${label} (settled)`, frames, testInfo, SVG_MAX_DIFF_PIXEL_RATIO);
    }
  };

  for (let step = 2; step <= stepCount; step++) {
    await goNext(page);
    await captureStep(`${prefix}-step${step}`, `Step ${step}`);
  }

  for (let step = stepCount - 1; step >= 1; step--) {
    await goPrev(page);
    await captureStep(`${prefix}-back-step${step}`, `Back to step ${step}`);
  }

  writeManifest(testInfo, frames);
}

// Each sequence below exercises a different SVG shape-morph code path in
// magic-move.js (animateRect/Circle/Line/Polyline/Polygon/Ellipse/Text/Path).
// "Bar chart to pie chart" is a deliberate stress case — see the comment on
// runSvgSequence's captureMidFrames param for why it's settled-frames-only.
test.describe('svgs.qmd — SVG magic-move', () => {
  test('Slope (points + line, 3 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'slope-20', 'slope', 3);
  });

  test('Histogram (rects, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'histogram---normal', 'hist', 2);
  });

  test('Line segments (lines, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'line-segments---position-1', 'segments', 2);
  });

  test('Grid circles (circles, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'circles-grid---small', 'circles', 2);
  });

  test('Grid polyline (polylines, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'polyline-grid---wave-1', 'polyline', 2);
  });

  test('Grid polygon (polygons, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'polygon-grid---triangle', 'polygon', 2);
  });

  test('Area chart (path, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'area-chart---normal', 'area', 2);
  });

  test('Ellipse as polygon (polygons, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'ellipse-polygon---wide', 'ellipse', 2);
  });

  test('Grid text (text, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'text-grid---position-1', 'text-grid', 2);
  });

  test('ggplot2 text labels (text, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'text-labels-ggplot2---before', 'text-ggplot', 2);
  });

  test('Bar chart to pie chart (rects to paths, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'bar-chart', 'barpie', 2, false);
  });
});
