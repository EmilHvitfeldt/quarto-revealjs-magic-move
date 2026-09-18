import { test } from '@playwright/test';
import { goNext, goPrev, gotoSlide } from './filmstrip';

test.use({ video: 'on' });

// Companion to mathjax.spec.ts, purely for producing a clean video artifact
// for the review gallery — see basic.replay.spec.ts for why video recording
// is split into its own screenshot-free test.
test.describe('mathjax.qmd — div-based magic-move (math)', () => {
  test('Isolating x (4 steps)', async ({ page }) => {
    await gotoSlide(page, '/examples/mathjax.html', 'isolating-x');
    await page.locator('#isolating-x .magic-move .magic-move-step').first().waitFor({ state: 'attached' });
    await page.waitForTimeout(500);

    await goNext(page);
    await page.waitForTimeout(700);

    await goNext(page);
    await page.waitForTimeout(700);

    await goNext(page);
    await page.waitForTimeout(700);

    await goPrev(page);
    await page.waitForTimeout(700);

    await goPrev(page);
    await page.waitForTimeout(700);

    await goPrev(page);
    await page.waitForTimeout(700);
  });
});
