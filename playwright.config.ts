import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html'], ['./tools/visual-review/video-reporter.ts']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    // Off by default: filmstrip specs take ~13 raw screenshots per test,
    // and that traffic contends with Chromium's screencast pipeline enough
    // to corrupt some recorded video frames into solid gray/black flashes.
    // basic.replay.spec.ts (screenshot-free, purely for video) turns this
    // back on with test.use({ video: 'on' }).
    video: 'off',
  },
  webServer: {
    // Serves the test-only render output (npm run render:test), not docs/
    // (the public site). Some examples (mathjax.qmd, svgs.qmd) are
    // deliberately excluded from the public site's render list/navbar and
    // search index — see _quarto-test.yml — but still need real HTML output
    // to test against.
    command: 'npx http-server .quarto-test-render -p 4173 -c-1 -s',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  // Filmstrip frames are captured and diffed by hand in tests/visual/filmstrip.ts
  // (see the comment on captureFrame for why), not via expect().toHaveScreenshot(),
  // so there's no toHaveScreenshot config here.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
