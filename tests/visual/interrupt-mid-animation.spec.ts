import { expect, test } from '@playwright/test';
import { captureFrame, type FilmstripFrame, gotoSlide, writeManifest } from './filmstrip';

// Regression coverage for the "stop-and-retarget" fix in animateToStep()
// (div-based magic-move): navigating backward starts an exit animation for
// whatever tokens the forward step would otherwise add (cloned onto an
// overlay layer, fading out). If the user immediately navigates forward
// again before that exit finishes, the previous call's clones used to be
// orphaned — left fading on their own original schedule, on top of the new
// call's freshly-rendered content — until they happened to finish ~1s later.
// animateToStep() now tears down any still-running clones (and the
// in-flight height Animation) from a previous call before building the new
// one, so an interrupt redirects immediately instead of leaving ghosts.
test.describe('basic.qmd — div-based magic-move — mid-animation interrupt', () => {
  test('backward-interrupted-by-forward leaves no stale exit clones', async ({ page }, testInfo) => {
    await gotoSlide(page, '/examples/basic.html', 'magic-move-example');
    const container = page.locator('#magic-move-example .magic-move');
    const wrapper = container.locator('.magic-move-wrapper');
    const frames: FilmstripFrame[] = [];

    // Reach step 3 (fully settled) so navigating backward has real exit
    // tokens (the group_by/summarise lines) to animate out.
    await page.evaluate(() => window.Reveal.next());
    await page.waitForTimeout(700);
    await page.evaluate(() => window.Reveal.next());
    await page.waitForTimeout(700);
    await captureFrame(page, container, 'interrupt-step3-settled.png', 'Step 3 (settled)', frames, testInfo);

    // step3 -> step2: creates exit clones for the removed lines.
    await page.evaluate(() => window.Reveal.prev());
    const clonesFromBackwardCall = await wrapper.evaluate((el) =>
      Array.from(el.children).filter((c) => c.tagName === 'SPAN' && !(c as HTMLElement).dataset.key).length,
    );
    expect(clonesFromBackwardCall).toBeGreaterThan(0);

    // Interrupt mid-flight: step2 -> step3 again, before the exit clones above finish fading.
    await page.waitForTimeout(150);
    await page.evaluate(() => window.Reveal.next());

    // The interrupting call must tear down the previous call's clones
    // immediately, not leave them to fade out on their own original
    // schedule (~1s later) on top of the freshly-rendered step 3 content.
    // Checked via a plain evaluate() (not captureFrame/locator.screenshot()),
    // since Locator.screenshot() waits for the element to be visually
    // "stable" first — which, on the buggy code, silently waits out exactly
    // the orphaned clones' fade this test exists to catch, masking the bug.
    const staleClonesAfterInterrupt = await wrapper.evaluate((el) =>
      Array.from(el.children).filter((c) => c.tagName === 'SPAN' && !(c as HTMLElement).dataset.key).length,
    );
    expect(staleClonesAfterInterrupt).toBe(0);

    await captureFrame(page, container, 'interrupt-mid-redirect.png', 'Interrupted mid-redirect', frames, testInfo);

    await page.waitForTimeout(700);
    await captureFrame(page, container, 'interrupt-settled-step3.png', 'Settled back at step 3', frames, testInfo);
    writeManifest(testInfo, frames);
  });
});
