import { test } from '@playwright/test';
import { captureFilmstrip, captureFrame, type FilmstripFrame, goNext, goPrev, gotoSlide, writeManifest } from './filmstrip';

// examples/slide-based.qmd has two slide-based magic-move sequences: each
// step is its own slide (section.magic-move), not a fragment within one
// slide. The animation overlay is position: fixed across the whole
// viewport rather than scoped to a single container (see
// magic-move.js's initSlideBasedMagicMove), and which section id is
// "current" changes every step, so frames are captured full-page rather
// than via a locator scoped to one element.
test.describe('slide-based.qmd — slide-based magic-move', () => {
  test('R code sequence (4 slides)', async ({ page }, testInfo) => {
    await gotoSlide(page, '/examples/slide-based.html', 'step-1');
    const frames: FilmstripFrame[] = [];

    await captureFrame(page, page, 'r-step1-initial.png', 'Step 1 (initial)', frames, testInfo);

    await goNext(page);
    await captureFilmstrip(page, page, 'r-step2', 'Step 2', frames, testInfo);

    await goNext(page);
    await captureFilmstrip(page, page, 'r-step3', 'Step 3', frames, testInfo);

    await goNext(page);
    await captureFilmstrip(page, page, 'r-step4', 'Step 4', frames, testInfo);

    await goPrev(page);
    await captureFilmstrip(page, page, 'r-back-step3', 'Back to step 3', frames, testInfo);

    await goPrev(page);
    await captureFilmstrip(page, page, 'r-back-step2', 'Back to step 2', frames, testInfo);

    await goPrev(page);
    await captureFilmstrip(page, page, 'r-back-step1', 'Back to step 1', frames, testInfo);

    writeManifest(testInfo, frames);
  });

  test('JavaScript code sequence (3 slides)', async ({ page }, testInfo) => {
    await gotoSlide(page, '/examples/slide-based.html', 'another-sequence');
    const frames: FilmstripFrame[] = [];

    await captureFrame(page, page, 'js-step1-initial.png', 'Step 1 (initial)', frames, testInfo);

    await goNext(page);
    await captureFilmstrip(page, page, 'js-step2', 'Step 2', frames, testInfo);

    await goNext(page);
    await captureFilmstrip(page, page, 'js-step3', 'Step 3', frames, testInfo);

    await goPrev(page);
    await captureFilmstrip(page, page, 'js-back-step2', 'Back to step 2', frames, testInfo);

    await goPrev(page);
    await captureFilmstrip(page, page, 'js-back-step1', 'Back to step 1', frames, testInfo);

    writeManifest(testInfo, frames);
  });
});
