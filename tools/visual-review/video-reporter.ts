import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { testKey } from '../../tests/visual/slug';

const OUTPUT_DIR = path.join('test-results', 'videos');

// Copies each test's recorded video into a flat directory, named by the same
// testKey() the filmstrip manifest uses, so the review gallery can line a
// test's sampled frames up with its actual video without guessing at
// Playwright's own (hashed, truncated) test-results folder names.
export default class VideoReporter implements Reporter {
  onBegin() {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const video = result.attachments.find((attachment) => attachment.name === 'video' && attachment.path);
    if (!video?.path) return;

    const key = testKey(test.titlePath());
    fs.copyFileSync(video.path, path.join(OUTPUT_DIR, `${key}.webm`));
  }
}
