import { test } from '@playwright/test';
import { advanceFragment, gotoSlide, retreatFragment } from './filmstrip';

test.use({ video: 'on' });

// Companion to basic.spec.ts, purely for producing a clean video artifact
// for the review gallery. basic.spec.ts takes ~13 raw screenshots per test
// while stepping through the animation, and that traffic contends with
// Chromium's screencast pipeline enough to corrupt some recorded video
// frames into solid gray/black flashes. This test does nothing but trigger
// each step (forward, then back down again) and wait, so its video is a
// faithful recording of the real animation in both directions.
//
// The describe/test titles below must match basic.spec.ts exactly: the
// review gallery links a video to its filmstrip by titlePath (see
// testKey() in tests/visual/slug.ts), not by which file produced it.
test.describe('basic.qmd — div-based magic-move', () => {
  test('R code sequence (3 steps)', async ({ page }) => {
    await gotoSlide(page, '/examples/basic.html', 'magic-move-example');
    await page.waitForTimeout(500);

    await advanceFragment(page);
    await page.waitForTimeout(1000);

    await advanceFragment(page);
    await page.waitForTimeout(1000);

    await retreatFragment(page);
    await page.waitForTimeout(1000);

    await retreatFragment(page);
    await page.waitForTimeout(1000);
  });

  test('JavaScript code sequence (2 steps)', async ({ page }) => {
    await gotoSlide(page, '/examples/basic.html', 'another-example');
    await page.waitForTimeout(500);

    await advanceFragment(page);
    await page.waitForTimeout(1000);

    await retreatFragment(page);
    await page.waitForTimeout(1000);
  });
});
