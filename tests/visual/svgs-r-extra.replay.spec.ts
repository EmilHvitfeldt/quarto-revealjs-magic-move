import { test, type Page } from '@playwright/test';
import { goNext, goPrev, gotoSlide } from './filmstrip';

test.use({ video: 'on' });

// Companion to svgs-r-extra.spec.ts, purely for producing a clean video
// artifact for the review gallery — see basic.replay.spec.ts for why video
// recording is split into its own screenshot-free test. Test titles below
// must match svgs-r-extra.spec.ts exactly (see testKey() in tests/visual/slug.ts).
async function waitForRExtraMagicMoveReady(page: Page) {
  await page.locator('#lattice-barchart---version-2 svg[data-inlined="true"]').waitFor({ state: 'attached' });
}

async function playSvgSequence(page: Page, startId: string, stepCount: number) {
  await gotoSlide(page, '/examples/svgs-r-extra.html', startId);
  await waitForRExtraMagicMoveReady(page);
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

// The ggiraph test below is a deliberate negative result (see the matching
// comment in svgs-r-extra.spec.ts): girafe() widgets never actually
// shape-morph, because each widget instance's clip-path ids get a random
// per-render hash suffix that never matches between two widgets, so
// matchSvgCircles finds zero pairs and the transition falls back to an
// instant slide cut.
test.describe('svgs-r-extra.qmd — SVG magic-move (other R plotting packages)', () => {
  test('Base R histogram (paths, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'base-r-histogram---normal', 2);
  });

  test('Base R scatter + abline (paths, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'base-r-scatter-line---slope-20', 2);
  });

  test('Base R barplot (paths, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'base-r-barplot---version-1', 2);
  });

  test('Lattice scatter (paths, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'lattice-scatter---position-1', 2);
  });

  test('Lattice barchart (paths, 2 slides)', async ({ page }) => {
    await playSvgSequence(page, 'lattice-barchart---version-1', 2);
  });

  test('ggiraph girafe widget (literal circles, does not animate)', async ({ page }) => {
    await playSvgSequence(page, 'ggiraph-points---position-1', 2);
  });
});
