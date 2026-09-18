import { test } from '@playwright/test';
import { captureFilmstrip, captureFrame, type FilmstripFrame, goNext, goPrev, gotoSlide, writeManifest } from './filmstrip';

// examples/mathjax.qmd is deliberately excluded from the public site (see
// _quarto-test.yml) but still gets full coverage here. MathJax (loaded from
// an external CDN — this test needs network access) typesets asynchronously
// after page load, and magic-move only inserts its fragment markers once
// that resolves (see initDivBasedMathMagicMove/waitForMathJax in
// magic-move.js), so wait for one to exist rather than racing MathJax.
test.describe('mathjax.qmd — div-based magic-move (math)', () => {
  test('Isolating x (4 steps)', async ({ page }, testInfo) => {
    await gotoSlide(page, '/examples/mathjax.html', 'isolating-x');
    const container = page.locator('#isolating-x .magic-move');
    await container.locator('.magic-move-step').first().waitFor({ state: 'attached' });
    const frames: FilmstripFrame[] = [];

    await captureFrame(page, container, 'math-step1-initial.png', 'Step 1 (initial)', frames, testInfo);

    await goNext(page);
    await captureFilmstrip(page, container, 'math-step2', 'Step 2', frames, testInfo);

    await goNext(page);
    await captureFilmstrip(page, container, 'math-step3', 'Step 3', frames, testInfo);

    await goNext(page);
    await captureFilmstrip(page, container, 'math-step4', 'Step 4', frames, testInfo);

    await goPrev(page);
    await captureFilmstrip(page, container, 'math-back-step3', 'Back to step 3', frames, testInfo);

    await goPrev(page);
    await captureFilmstrip(page, container, 'math-back-step2', 'Back to step 2', frames, testInfo);

    await goPrev(page);
    await captureFilmstrip(page, container, 'math-back-step1', 'Back to step 1', frames, testInfo);

    writeManifest(testInfo, frames);
  });
});
