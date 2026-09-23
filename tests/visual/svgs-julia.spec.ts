import { test, type Page, type TestInfo } from '@playwright/test';
import {
  captureFilmstrip,
  captureFrame,
  type FilmstripFrame,
  goNext,
  goPrev,
  gotoSlide,
  writeManifest,
} from './filmstrip';

// Julia-backed analogue of svgs.spec.ts, covering the two Julia charting
// libraries whose SVG output turned out compatible with magic-move.js's
// attribute-based shape parsers (see examples/svgs-julia.qmd's header
// comment for the full compatibility write-up): CairoMakie (point markers
// as filled Bezier <path>s, same pattern as R's ggplot2 geom_point) and
// Plots.jl's GR backend (point markers as literal <circle>s). Gadfly was
// tested and excluded — Compose.jl positions marks via an ancestor
// `<g transform="translate(x,y)">` instead of the element's own geometry
// attributes, which magic-move.js's parsers never read, so nothing
// animates; no spec is added for it.
const SVG_MAX_DIFF_PIXEL_RATIO = 0.08;

// Mirrors runSvgSequence in svgs.spec.ts.
async function runSvgSequence(
  page: Page,
  testInfo: TestInfo,
  startId: string,
  prefix: string,
  stepCount: number,
) {
  await gotoSlide(page, '/examples/svgs-julia.html', startId);
  await waitForJuliaSvgReady(page);
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
    await captureFilmstrip(page, page, `${prefix}-back-step${step}`, `Back to step ${step}`, frames, testInfo, SVG_MAX_DIFF_PIXEL_RATIO);
  }

  writeManifest(testInfo, frames);
}

// waitForSvgMagicMoveReady in filmstrip.ts is hardcoded to #pie-chart from
// svgs.qmd, which doesn't exist on this page — poll the last magic-move
// slide's own inlined-or-present <svg> instead.
async function waitForJuliaSvgReady(page: Page) {
  await page.locator('#gr-plots\\.jl-points---right svg').first().waitFor({ state: 'attached' });
}

test.describe('svgs-julia.qmd — SVG magic-move', () => {
  test('CairoMakie points (path circles, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'cairomakie-points---low', 'makie', 2);
  });

  test('GR/Plots.jl points (circles, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'gr-plots.jl-points---left', 'gr', 2);
  });
});
