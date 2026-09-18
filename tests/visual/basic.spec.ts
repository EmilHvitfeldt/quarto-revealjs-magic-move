import { test } from '@playwright/test';
import {
  advanceFragment,
  captureFilmstrip,
  captureFrame,
  type FilmstripFrame,
  gotoSlide,
  retreatFragment,
  writeManifest,
} from './filmstrip';

// examples/basic.qmd has two div-based magic-move sequences, one per slide.
// Each is exercised forward (step1 -> step2 -> ...) and then backward
// (... -> step2 -> step1), since fragmenthidden runs its own reverse FLIP
// animation rather than just snapping back — a separate code path with its
// own failure modes.
test.describe('basic.qmd — div-based magic-move', () => {
  test('R code sequence (3 steps)', async ({ page }, testInfo) => {
    await gotoSlide(page, '/examples/basic.html', 'magic-move-example');
    const container = page.locator('#magic-move-example .magic-move');
    const frames: FilmstripFrame[] = [];

    await captureFrame(page, container, 'r-step1-initial.png', 'Step 1 (initial)', frames, testInfo);

    await advanceFragment(page);
    await captureFilmstrip(page, container, 'r-step2', 'Step 2', frames, testInfo);

    await advanceFragment(page);
    await captureFilmstrip(page, container, 'r-step3', 'Step 3', frames, testInfo);

    await retreatFragment(page);
    await captureFilmstrip(page, container, 'r-back-step2', 'Back to step 2', frames, testInfo);

    await retreatFragment(page);
    await captureFilmstrip(page, container, 'r-back-step1', 'Back to step 1', frames, testInfo);

    writeManifest(testInfo, frames);
  });

  test('JavaScript code sequence (2 steps)', async ({ page }, testInfo) => {
    await gotoSlide(page, '/examples/basic.html', 'another-example');
    const container = page.locator('#another-example .magic-move');
    const frames: FilmstripFrame[] = [];

    await captureFrame(page, container, 'js-step1-initial.png', 'Step 1 (initial)', frames, testInfo);

    await advanceFragment(page);
    await captureFilmstrip(page, container, 'js-step2', 'Step 2', frames, testInfo);

    await retreatFragment(page);
    await captureFilmstrip(page, container, 'js-back-step1', 'Back to step 1', frames, testInfo);

    writeManifest(testInfo, frames);
  });
});
