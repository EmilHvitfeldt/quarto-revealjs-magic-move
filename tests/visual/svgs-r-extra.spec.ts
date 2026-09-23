import { test, type Page, type TestInfo } from '@playwright/test';
import {
  captureFilmstrip,
  captureFrame,
  type FilmstripFrame,
  goNext,
  goPrev,
  gotoSlide,
  writeManifest,
} from './filmstrip';

// examples/svgs-r-extra.qmd — like examples/svgs.qmd, magic-move pre-inlines
// every magic-move slide's img[data-src$=".svg"] into a real inline <svg> in
// one sequential async loop before it attaches its slidechanged listener, so
// "the whole page's SVG magic-move is ready" needs a proxy to wait on (see
// waitForSvgMagicMoveReady in tests/visual/filmstrip.ts for the same pattern
// applied to svgs.qmd). Unlike svgs.qmd, this file's *last* magic-move
// sequence (the ggiraph pair) renders an htmlwidget whose <svg> is already
// inline in the initial HTML — it never goes through the img-inlining loop,
// so it never gets data-inlined="true" and can't be used as the readiness
// proxy. "lattice-barchart---version-2" is the last slide in document order
// that *does* go through that loop, so its data-inlined="true" is used
// instead; the ggiraph pair's own (no-op, since it has no <img> to inline)
// loop iterations finish as an immediate microtask right after, well before
// any navigation this test triggers.
async function waitForRExtraMagicMoveReady(page: Page) {
  await page.locator('#lattice-barchart---version-2 svg[data-inlined="true"]').waitFor({ state: 'attached' });
}

// Same rationale as svgs.spec.ts's SVG_MAX_DIFF_PIXEL_RATIO.
const SVG_MAX_DIFF_PIXEL_RATIO = 0.08;

async function runSvgSequence(
  page: Page,
  testInfo: TestInfo,
  startId: string,
  prefix: string,
  stepCount: number,
) {
  await gotoSlide(page, '/examples/svgs-r-extra.html', startId);
  await waitForRExtraMagicMoveReady(page);
  const frames: FilmstripFrame[] = [];

  await captureFrame(
    page,
    page,
    `${prefix}-step1-initial.png`,
    'Step 1 (initial)',
    frames,
    testInfo,
    SVG_MAX_DIFF_PIXEL_RATIO,
  );

  for (let step = 2; step <= stepCount; step++) {
    await goNext(page);
    await captureFilmstrip(page, page, `${prefix}-step${step}`, `Step ${step}`, frames, testInfo, SVG_MAX_DIFF_PIXEL_RATIO);
  }

  for (let step = stepCount - 1; step >= 1; step--) {
    await goPrev(page);
    await captureFilmstrip(
      page,
      page,
      `${prefix}-back-step${step}`,
      `Back to step ${step}`,
      frames,
      testInfo,
      SVG_MAX_DIFF_PIXEL_RATIO,
    );
  }

  writeManifest(testInfo, frames);
}

// Each sequence below checks whether a different popular R plotting package
// (besides ggplot2/grid, already covered by svgs.qmd) survives magic-move's
// SVG shape-morph: base R graphics (points/bars/abline all render as <path>
// under the Cairo svg device, same as ggplot2) and lattice (grid-based, same
// device, same primitive shapes) both shape-morph correctly, matching
// ggplot2/grid's existing behavior.
//
// The ggiraph case is a deliberate negative result, kept here rather than
// dropped: a real girafe() htmlwidget renders literal <circle> elements (a
// genuinely different pipeline — gdtools-based, not Cairo's <path>
// approximations) and does get picked up by magic-move's hasSvg detection,
// but the shape-morph never actually animates. Each girafe widget instance
// suffixes every clip-path id with a random per-render hash
// (url(#svg_<hash>_c2)), and matchSvgCircles groups circles by a signature
// that includes that exact clipPath string with no fallback pass — unlike
// matchSvgPaths, which falls back to unclipped signature grouping and then
// fill-only matching when clip-paths don't line up. Two independently
// rendered girafe widgets never share a clip-path hash, so the signature
// keys never intersect, matchSvgCircles returns zero matches, and
// animateSvgMagicMove's zero-matches early return makes it fall back to a
// plain instant slide cut with no animation at all. Confirmed via
// console-logging the matcher's internal group keys during manual testing:
// fromKeys/toKeys were the two different random hashes. This is a
// pre-existing gap in the circle/rect/line/polygon/ellipse matchers, not
// something specific to this example.
test.describe('svgs-r-extra.qmd — SVG magic-move (other R plotting packages)', () => {
  test('Base R histogram (paths, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'base-r-histogram---normal', 'base-hist', 2);
  });

  test('Base R scatter + abline (paths, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'base-r-scatter-line---slope-20', 'base-slope', 2);
  });

  test('Base R barplot (paths, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'base-r-barplot---version-1', 'base-bar', 2);
  });

  test('Lattice scatter (paths, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'lattice-scatter---position-1', 'lattice-xy', 2);
  });

  test('Lattice barchart (paths, 2 slides)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'lattice-barchart---version-1', 'lattice-bar', 2);
  });

  test('ggiraph girafe widget (literal circles, does not animate)', async ({ page }, testInfo) => {
    await runSvgSequence(page, testInfo, 'ggiraph-points---position-1', 'ggiraph', 2);
  });
});
