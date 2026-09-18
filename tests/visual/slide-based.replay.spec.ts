import { test } from '@playwright/test';
import { goNext, goPrev, gotoSlide } from './filmstrip';

test.use({ video: 'on' });

// Companion to slide-based.spec.ts, purely for producing a clean video
// artifact for the review gallery — see basic.replay.spec.ts for why video
// recording is split into its own screenshot-free test.
test.describe('slide-based.qmd — slide-based magic-move', () => {
  test('R code sequence (4 slides)', async ({ page }) => {
    await gotoSlide(page, '/examples/slide-based.html', 'step-1');
    await page.waitForTimeout(500);

    await goNext(page);
    await page.waitForTimeout(1000);

    await goNext(page);
    await page.waitForTimeout(1000);

    await goNext(page);
    await page.waitForTimeout(1000);

    await goPrev(page);
    await page.waitForTimeout(1000);

    await goPrev(page);
    await page.waitForTimeout(1000);

    await goPrev(page);
    await page.waitForTimeout(1000);
  });

  test('JavaScript code sequence (3 slides)', async ({ page }) => {
    await gotoSlide(page, '/examples/slide-based.html', 'another-sequence');
    await page.waitForTimeout(500);

    await goNext(page);
    await page.waitForTimeout(1000);

    await goNext(page);
    await page.waitForTimeout(1000);

    await goPrev(page);
    await page.waitForTimeout(1000);

    await goPrev(page);
    await page.waitForTimeout(1000);
  });
});
