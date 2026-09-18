import { test } from '@playwright/test';
import {
  captureFilmstrip,
  captureFrame,
  type FilmstripFrame,
  goNext,
  goPrev,
  gotoSlide,
  writeManifest,
} from './filmstrip';

// examples/code-chunk-cases.qmd has one div-based magic-move sequence per
// slide, each isolating a single kind of code-chunk diff (insertion,
// deletion, rename, reorder, ...) so a regression in one diff strategy
// doesn't hide behind a more complex sequence.

async function runTwoStep(page: import('@playwright/test').Page, sectionId: string, testInfo: import('@playwright/test').TestInfo) {
  await gotoSlide(page, '/examples/code-chunk-cases.html', sectionId);
  const container = page.locator(`#${sectionId} .magic-move`);
  const frames: FilmstripFrame[] = [];

  await captureFrame(page, container, `${sectionId}-step1-initial.png`, 'Step 1 (initial)', frames, testInfo);

  await goNext(page);
  await captureFilmstrip(page, container, `${sectionId}-step2`, 'Step 2', frames, testInfo);

  await goPrev(page);
  await captureFilmstrip(page, container, `${sectionId}-back-step1`, 'Back to step 1', frames, testInfo);

  writeManifest(testInfo, frames);
}

test.describe('code-chunk-cases.qmd — div-based magic-move', () => {
  test('line insertion', async ({ page }, testInfo) => {
    await runTwoStep(page, 'line-insertion', testInfo);
  });

  test('line deletion', async ({ page }, testInfo) => {
    await runTwoStep(page, 'line-deletion', testInfo);
  });

  test('token rename', async ({ page }, testInfo) => {
    await runTwoStep(page, 'token-rename', testInfo);
  });

  test('indentation only change', async ({ page }, testInfo) => {
    await runTwoStep(page, 'indentation-only-change', testInfo);
  });

  test('line reorder', async ({ page }, testInfo) => {
    await runTwoStep(page, 'line-reorder', testInfo);
  });

  test('pipe extraction (3 steps)', async ({ page }, testInfo) => {
    await gotoSlide(page, '/examples/code-chunk-cases.html', 'pipe-extraction');
    const container = page.locator('#pipe-extraction .magic-move');
    const frames: FilmstripFrame[] = [];

    await captureFrame(page, container, 'pipe-extraction-step1-initial.png', 'Step 1 (initial)', frames, testInfo);

    await goNext(page);
    await captureFilmstrip(page, container, 'pipe-extraction-step2', 'Step 2', frames, testInfo);

    await goNext(page);
    await captureFilmstrip(page, container, 'pipe-extraction-step3', 'Step 3', frames, testInfo);

    await goPrev(page);
    await captureFilmstrip(page, container, 'pipe-extraction-back-step2', 'Back to step 2', frames, testInfo);

    await goPrev(page);
    await captureFilmstrip(page, container, 'pipe-extraction-back-step1', 'Back to step 1', frames, testInfo);

    writeManifest(testInfo, frames);
  });

  test('pipe collapse (3 steps)', async ({ page }, testInfo) => {
    await gotoSlide(page, '/examples/code-chunk-cases.html', 'pipe-collapse');
    const container = page.locator('#pipe-collapse .magic-move');
    const frames: FilmstripFrame[] = [];

    await captureFrame(page, container, 'pipe-collapse-step1-initial.png', 'Step 1 (initial)', frames, testInfo);

    await goNext(page);
    await captureFilmstrip(page, container, 'pipe-collapse-step2', 'Step 2', frames, testInfo);

    await goNext(page);
    await captureFilmstrip(page, container, 'pipe-collapse-step3', 'Step 3', frames, testInfo);

    await goPrev(page);
    await captureFilmstrip(page, container, 'pipe-collapse-back-step2', 'Back to step 2', frames, testInfo);

    await goPrev(page);
    await captureFilmstrip(page, container, 'pipe-collapse-back-step1', 'Back to step 1', frames, testInfo);

    writeManifest(testInfo, frames);
  });

  test('single line to multi line wrap', async ({ page }, testInfo) => {
    await runTwoStep(page, 'single-line-to-multi-line-wrap', testInfo);
  });

  test('comment only change', async ({ page }, testInfo) => {
    await runTwoStep(page, 'comment-only-change', testInfo);
  });

  test('literal value change', async ({ page }, testInfo) => {
    await runTwoStep(page, 'literal-value-change', testInfo);
  });

  test('duplicate lines one edited', async ({ page }, testInfo) => {
    await runTwoStep(page, 'duplicate-lines-one-edited', testInfo);
  });

  test('whitespace only change', async ({ page }, testInfo) => {
    await runTwoStep(page, 'whitespace-only-change', testInfo);
  });

  test('unrelated rewrite', async ({ page }, testInfo) => {
    await runTwoStep(page, 'unrelated-rewrite', testInfo);
  });

  test('large block small diff', async ({ page }, testInfo) => {
    await runTwoStep(page, 'large-block-small-diff', testInfo);
  });
});
