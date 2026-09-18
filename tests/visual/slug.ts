export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Identifies a test by its describe + test title, ignoring which spec file
// or Playwright project produced it. Used to link a filmstrip test's
// manifest to its recorded video, which are deliberately produced by two
// *different* spec files (see basic.replay.spec.ts) — so the key can't be
// tied to a specific file path. Must be computed identically in
// tests/visual/filmstrip.ts (writeManifest, from TestInfo.titlePath, a plain
// array of ['', ...describe titles, test title]) and
// tools/visual-review/video-reporter.ts (onTestEnd, from
// TestCase.titlePath(), a method returning ['', project name, spec file
// title, ...describe titles, test title]). Those two have a different
// number of leading segments, so take the last two (describe + test title)
// rather than slicing from the front.
export function testKey(titlePath: string[]): string {
  return slugify(titlePath.slice(-2).join(' '));
}
