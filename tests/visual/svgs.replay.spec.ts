import { test, type Page } from '@playwright/test';
import { goNext, goPrev, gotoSlide, waitForSvgMagicMoveReady } from './filmstrip';

test.use({ video: 'on' });

// Companion to svgs.spec.ts, purely for producing a clean video artifact
// for the review gallery — see basic.replay.spec.ts for why video
// recording is split into its own screenshot-free test. Test titles below
// must match svgs.spec.ts exactly (see testKey() in tests/visual/slug.ts).
async function playSvgSequence(page: Page, startId: string, stepCount: number) {
  await gotoSlide(page, '/examples/svgs.html', startId);
  await waitForSvgMagicMoveReady(page);
  await page.waitForTimeout(500);

  for (let step = 2; step <= stepCount; step++) {
    await goNext(page);
    await page.waitForTimeout(700);
  }

  for (let step = stepCount - 1; step >= 1; step--) {
    await goPrev(page);
    await page.waitForTimeout(700);
  }
}

test.describe('svgs.qmd — SVG magic-move', () => {
  test('Slope (points + line, 3 slides)', async ({ page }) => {
    await playSvgSequence(page, 'slope-20', 3);
  });

  test('Histogram (rects, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'histogram---normal', 2);
  });

  test('Line segments (lines, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'line-segments---position-1', 2);
  });

  test('Grid circles (circles, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'circles-grid---small', 2);
  });

  test('Grid polyline (polylines, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'polyline-grid---wave-1', 2);
  });

  test('Grid polygon (polygons, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'polygon-grid---triangle', 2);
  });

  test('Area chart (path, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'area-chart---normal', 2);
  });

  test('Ellipse as polygon (polygons, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'ellipse-polygon---wide', 2);
  });

  test('Grid text (text, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'text-grid---position-1', 2);
  });

  test('ggplot2 text labels (text, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'text-labels-ggplot2---before', 2);
  });

  test('Bar chart to pie chart (rects to paths, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'bar-chart', 2);
  });
});
