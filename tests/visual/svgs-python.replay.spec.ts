import { test, type Page } from '@playwright/test';
import { goNext, goPrev, gotoSlide, waitForSvgMagicMoveReady } from './filmstrip';

test.use({ video: 'on' });

const LAST_SLIDE_ID = 'altair-bar-chart---shuffled';

// Companion to svgs-python.spec.ts, purely for producing a clean video
// artifact for the review gallery — see basic.replay.spec.ts for why video
// recording is split into its own screenshot-free test. Test titles below
// must match svgs-python.spec.ts exactly (see testKey() in tests/visual/slug.ts).
async function playSvgSequence(page: Page, startId: string, stepCount: number) {
  await gotoSlide(page, '/examples/svgs-python.html', startId);
  await waitForSvgMagicMoveReady(page, LAST_SLIDE_ID);
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

test.describe('svgs-python.qmd — SVG magic-move', () => {
  test('Matplotlib bar chart (paths, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'matplotlib-bar-chart---low', 2);
  });

  test('Matplotlib line chart (paths, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'matplotlib-line-chart---wave-1', 2);
  });

  test('Matplotlib area chart (paths, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'matplotlib-area-chart---normal', 2);
  });

  test('Seaborn bar chart (paths, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'seaborn-bar-chart---low', 2);
  });

  test('Plotnine bar chart (paths, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'plotnine-bar-chart---low', 2);
  });

  test('Plotnine line chart (paths, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'plotnine-line-chart---wave-1', 2);
  });

  test('Altair bar chart (paths, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'altair-bar-chart---low', 2);
  });
});
