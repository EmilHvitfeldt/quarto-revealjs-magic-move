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

// examples/timing-options.qmd exercises the per-container `magicMove` config
// surface (delay-exit/delay-enter/stagger/duration/easing, read from data
// attributes on the fenced div — see resolveMagicMoveOptions in magic-move.js)
// added alongside buildAnimationPlan/scheduleAnimationPlan. These are the first
// baselines where the *default* timing is not what's under test: each case is
// deliberately configured to look different from a plain (all-defaults) step,
// so a regression that silently ignores the config would still pass every
// other suite (all of which stick to defaults) but fail here.
test.describe('timing-options.qmd — per-container magic-move config', () => {
  test('staggered exit', async ({ page }, testInfo) => {
    await gotoSlide(page, '/examples/timing-options.html', 'staggered-exit');
    const container = page.locator('#staggered-exit .magic-move');
    const frames: FilmstripFrame[] = [];

    await captureFrame(page, container, 'staggered-exit-step1-initial.png', 'Step 1 (initial)', frames, testInfo);

    await goNext(page);
    await captureFilmstrip(page, container, 'staggered-exit-step2', 'Step 2 (stagger: 0.3)', frames, testInfo);

    writeManifest(testInfo, frames);
  });

  test('delayed enter', async ({ page }, testInfo) => {
    await gotoSlide(page, '/examples/timing-options.html', 'delayed-enter');
    const container = page.locator('#delayed-enter .magic-move');
    const frames: FilmstripFrame[] = [];

    await captureFrame(page, container, 'delayed-enter-step1-initial.png', 'Step 1 (initial)', frames, testInfo);

    await goNext(page);
    await captureFilmstrip(page, container, 'delayed-enter-step2', 'Step 2 (delay-enter: 0.6)', frames, testInfo);

    writeManifest(testInfo, frames);
  });

  test('custom duration and easing', async ({ page }, testInfo) => {
    await gotoSlide(page, '/examples/timing-options.html', 'slower-custom-eased-transition');
    const container = page.locator('#slower-custom-eased-transition .magic-move');
    const frames: FilmstripFrame[] = [];

    await captureFrame(page, container, 'custom-duration-step1-initial.png', 'Step 1 (initial)', frames, testInfo);

    await goNext(page);
    // Sample past the default 950ms schedule too: duration is 1200ms here, so
    // the transition is still visibly in flight at the last default sample point.
    await captureFilmstrip(page, container, 'custom-duration-step2', 'Step 2 (duration: 1200ms)', frames, testInfo);
    await page.waitForTimeout(300);
    await captureFrame(page, container, 'custom-duration-step2-1250ms.png', 'Step 2 settled @ 1250ms', frames, testInfo);

    writeManifest(testInfo, frames);
  });

  // Confirms the resolution of the plan's backward-navigation question: `enter`/`exit`
  // are computed per-transition from whichever step is currently on screen vs. the
  // target (animateToStep's fromStep/toStep call args already carry that meaning, for
  // both fragmentshown and fragmenthidden), not from each step's fixed position in the
  // authored sequence. So navigating backward through a staggered-exit case should
  // stagger tokens *entering* (the ones that were deleted going forward, now
  // reappearing) rather than replaying the forward exit stagger in reverse.
  test('staggered exit, then navigate back (direction sanity check)', async ({ page }, testInfo) => {
    await gotoSlide(page, '/examples/timing-options.html', 'staggered-exit');
    const container = page.locator('#staggered-exit .magic-move');
    const frames: FilmstripFrame[] = [];

    await goNext(page);
    await page.waitForTimeout(1000); // let the forward exit settle before reversing

    await goPrev(page);
    await captureFilmstrip(page, container, 'staggered-exit-back-to-step1', 'Back to step 1', frames, testInfo);

    writeManifest(testInfo, frames);
  });
});
