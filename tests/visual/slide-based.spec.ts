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

  // Slide-based's own counterpart to timing-options.spec.ts's "staggered exit": the
  // `.sourceCode` height transition (animateSlideMagicMove, magic-move.js) used to
  // always run on a fixed [0, duration] window regardless of `delay-move`/`stagger`,
  // so with delay-move=1.3 the box would finish shrinking well before the delayed move
  // that's supposed to close the gap even started. It's now synced to the `move`
  // schedule the same way the div-based wrapper height fix is, so the box should hold
  // its "from" size through the staggered exits and only start shrinking once the
  // delayed move begins.
  test('staggered exit (delay-move / stagger drive the height transition)', async ({ page }, testInfo) => {
    await gotoSlide(page, '/examples/slide-based.html', 'staggered-exit-step-1');
    const frames: FilmstripFrame[] = [];

    await captureFrame(page, page, 'slide-staggered-exit-step1-initial.png', 'Step 1 (initial)', frames, testInfo);

    await goNext(page);
    await captureFilmstrip(page, page, 'slide-staggered-exit-step2', 'Step 2 (stagger: 0.3, delay-move: 1.3)', frames, testInfo);
    // Sample past the default schedule too: with delayContainer=0.5 stacked on top of
    // delay-move=1.3, the move (and the height transition synced to it) doesn't even
    // start until 900ms and doesn't finish until ~1400ms.
    await page.waitForTimeout(500);
    await captureFrame(page, page, 'slide-staggered-exit-step2-1450ms.png', 'Step 2 settled @ 1450ms', frames, testInfo);

    writeManifest(testInfo, frames);
  });
});
