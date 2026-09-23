import { test, type Page } from '@playwright/test';
import { goNext, goPrev, gotoSlide } from './filmstrip';

test.use({ video: 'on' });

// Companion to svgs-julia.spec.ts, purely for producing a clean video
// artifact for the review gallery — see basic.replay.spec.ts for why video
// recording is split into its own screenshot-free test. Test titles below
// must match svgs-julia.spec.ts exactly (see testKey() in tests/visual/slug.ts).
async function waitForJuliaSvgReady(page: Page) {
  await page.locator('#gr-plots\\.jl-points---right svg').first().waitFor({ state: 'attached' });
}

async function playSvgSequence(page: Page, startId: string, stepCount: number) {
  await gotoSlide(page, '/examples/svgs-julia.html', startId);
  await waitForJuliaSvgReady(page);
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

test.describe('svgs-julia.qmd — SVG magic-move', () => {
  test('CairoMakie points (path circles, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'cairomakie-points---low', 2);
  });

  test('GR/Plots.jl points (circles, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'gr-plots.jl-points---left', 2);
  });
});
