import { expect, test } from '@playwright/test';
import {
  captureFilmstrip,
  captureFrame,
  type FilmstripFrame,
  goNext,
  gotoSlide,
  writeManifest,
} from './filmstrip';

// examples/deck-wide-config.qmd sets `format: revealjs: magic-move: {...}` in its YAML
// header instead of per-container attributes. This is the deck-wide config surface from
// issue #4: Quarto's revealjs writer only forwards known reveal.js config keys into the
// `Reveal.initialize({...})` call it emits, so `deck.getConfig().magicMove` stayed
// `undefined` for anyone authoring this in plain YAML until `_extension.yml` declared
// `magicMove` as a real config key of the RevealMagicMove plugin.
test.describe('deck-wide-config.qmd — deck-wide magic-move config', () => {
  test('YAML magic-move option reaches Reveal.getConfig()', async ({ page }) => {
    await gotoSlide(page, '/examples/deck-wide-config.html', 'deck-wide-default');
    const config = await page.evaluate(() => window.Reveal.getConfig().magicMove);
    // This is the raw value Quarto forwarded from the YAML - still kebab-case
    // `delay-exit`, exactly as authored. normalizeMagicMoveKeys (exercised by the
    // animation test below, and unit-tested separately) converts it to delayExit
    // only for magic-move.js's own internal reads; it doesn't mutate Reveal's config.
    expect(config).toEqual({ duration: 1200, stagger: 0.3, 'delay-exit': 0.2 });
  });

  test('deck-wide duration/stagger actually drive the animation', async ({ page }, testInfo) => {
    await gotoSlide(page, '/examples/deck-wide-config.html', 'deck-wide-default');
    const container = page.locator('#deck-wide-default .magic-move');
    const frames: FilmstripFrame[] = [];

    await captureFrame(page, container, 'deck-wide-step1-initial.png', 'Step 1 (initial)', frames, testInfo);

    await goNext(page);
    // Default duration is 500ms, so a plain (unconfigured) step would already be
    // settled by the last default sample point (950ms). duration: 1200 here means
    // it's still visibly animating - proof the deck-wide config (not a hardcoded
    // default) is what's driving this transition.
    await captureFilmstrip(page, container, 'deck-wide-step2', 'Step 2 (deck-wide duration: 1200ms)', frames, testInfo);

    writeManifest(testInfo, frames);
  });
});
