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

// "altair-bar-chart---shuffled" is examples/svgs-python.qmd's last magic-move
// slide in document order (see waitForSvgMagicMoveReady's comment in
// filmstrip.ts for why the last slide is the right readiness proxy).
const LAST_SLIDE_ID = 'altair-bar-chart---shuffled';

// Companion to svgs.spec.ts, but for Python/Jupyter-rendered SVGs
// (matplotlib, seaborn, plotnine, altair) instead of R/ggplot2/grid ones —
// see examples/svgs-python.qmd. Same filmstrip approach: run each sequence
// forward and back, sampling frames at a fixed schedule.
const SVG_MAX_DIFF_PIXEL_RATIO = 0.08;

async function runSvgSequence(page: Page, testInfo: TestInfo, startId: string, prefix: string, stepCount: number) {
  await gotoSlide(page, '/examples/svgs-python.html', startId);
  await waitForSvgMagicMoveReady(page, LAST_SLIDE_ID);
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

  for (let step = 2; step <= stepCount; step++) {
    await goNext(page);
    await captureFilmstrip(page, page, `${prefix}-step${step}`, `Step ${step}`, frames, testInfo, SVG_MAX_DIFF_PIXEL_RATIO);
  }

  for (let step = stepCount - 1; step >= 1; step--) {
    await goPrev(page);
    await captureFilmstrip(
      page,
      page,
      `${prefix}-back-step${step}`,
      `Back to step ${step}`,
      frames,
      testInfo,
      SVG_MAX_DIFF_PIXEL_RATIO,
    );
  }

  writeManifest(testInfo, frames);
}

// Each sequence below exercises the SVG shape-morph path (animatePath) on a
// different Python plotting library, all of which render their bar/line/
// area marks as plain <path> elements sharing a stable command structure
// between before/after — see the compatibility notes in the final report
// for why marker-based plots (e.g. matplotlib scatter) are deliberately not
// covered here.
test.describe('svgs-python.qmd — SVG magic-move', () => {
  test('Matplotlib bar chart (paths, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'matplotlib-bar-chart---low', 'mpl-bar', 2);
  });

  test('Matplotlib line chart (paths, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'matplotlib-line-chart---wave-1', 'mpl-line', 2);
  });

  test('Matplotlib area chart (paths, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'matplotlib-area-chart---normal', 'mpl-area', 2);
  });

  test('Seaborn bar chart (paths, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'seaborn-bar-chart---low', 'seaborn-bar', 2);
  });

  test('Plotnine bar chart (paths, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'plotnine-bar-chart---low', 'plotnine-bar', 2);
  });

  test('Plotnine line chart (paths, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'plotnine-line-chart---wave-1', 'plotnine-line', 2);
  });

  test('Altair bar chart (paths, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'altair-bar-chart---low', 'altair-bar', 2);
  });
});
