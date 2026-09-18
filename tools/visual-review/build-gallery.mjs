#!/usr/bin/env node
// Generates tools/visual-review/gallery.html: a static page for a human to
// browse the visual-test filmstrips (committed baselines) and watch the
// matching recorded videos (ephemeral, produced by `npm run test:visual`).
//
// Reads tests/visual/*.spec.ts-snapshots/manifest-*.json (written by
// writeManifest() in tests/visual/filmstrip.ts) rather than reverse-engineering
// frame order from filenames, and looks up each test's video in
// test-results/videos/<key>.webm (written by tools/visual-review/video-reporter.ts)
// using the same key.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..');
const testsVisualDir = path.join(repoRoot, 'tests', 'visual');
const videosDir = path.join(repoRoot, 'test-results', 'videos');
const outFile = path.join(repoRoot, 'tools', 'visual-review', 'gallery.html');

function findSnapshotDirs() {
  return fs
    .readdirSync(testsVisualDir)
    .filter((name) => name.endsWith('-snapshots'))
    .map((name) => path.join(testsVisualDir, name));
}

function loadManifests(snapshotDir) {
  return fs
    .readdirSync(snapshotDir)
    .filter((name) => name.startsWith('manifest-') && name.endsWith('.json'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(snapshotDir, name), 'utf8')))
    .map((manifest) => ({ ...manifest, snapshotDir }));
}

// Frame baselines are written under their exact logical name by
// captureFrame() in tests/visual/filmstrip.ts (there's no Playwright
// OS/browser suffix here, since these bypass toHaveScreenshot entirely).
function resolveFrameImage(snapshotDir, logicalName) {
  const fullPath = path.join(snapshotDir, logicalName);
  return fs.existsSync(fullPath) ? fullPath : null;
}

function relFromGallery(absPath) {
  return path.relative(path.dirname(outFile), absPath).split(path.sep).join('/');
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function renderTest(manifest) {
  const { title, frames, snapshotDir, key } = manifest;
  const specLabel = path.basename(snapshotDir).replace(/\.spec\.ts-snapshots$/, '');

  const resolvedFrames = frames.map((frame) => ({
    label: frame.label,
    imgPath: resolveFrameImage(snapshotDir, frame.name),
  }));

  const frameHtml = resolvedFrames
    .filter((f) => f.imgPath)
    .map(
      (f, i) =>
        `<img class="frame" data-index="${i}" src="${relFromGallery(f.imgPath)}" alt="${escapeHtml(f.label)}" title="${escapeHtml(f.label)}" loading="lazy">`,
    )
    .join('\n');

  const labels = JSON.stringify(resolvedFrames.filter((f) => f.imgPath).map((f) => f.label));
  const firstFrame = resolvedFrames.find((f) => f.imgPath);

  const videoPath = path.join(videosDir, `${key}.webm`);
  const videoHtml = fs.existsSync(videoPath)
    ? `<video controls muted loop src="${relFromGallery(videoPath)}"></video>`
    : `<p class="no-video">No recorded video yet — run <code>npm run test:visual</code> to generate one.</p>`;

  return `
    <section class="test" data-labels='${labels}'>
      <h2>${escapeHtml(specLabel)} — ${escapeHtml(title)}</h2>
      <div class="columns">
        <div class="filmstrip-panel">
          <div class="big-frame">
            <img class="big" src="${firstFrame ? relFromGallery(firstFrame.imgPath) : ''}" alt="">
            <div class="big-label"></div>
          </div>
          <div class="controls">
            <button class="play">▶ Play filmstrip</button>
            <span class="frame-count">${frames.length} sampled frames</span>
          </div>
          <div class="thumbs">${frameHtml}</div>
        </div>
        <div class="video-panel">
          <h3>Recorded video</h3>
          ${videoHtml}
        </div>
      </div>
    </section>`;
}

function buildHtml(manifests) {
  const bySpec = new Map();
  for (const m of manifests) {
    const specLabel = path.basename(m.snapshotDir).replace(/\.spec\.ts-snapshots$/, '');
    if (!bySpec.has(specLabel)) bySpec.set(specLabel, []);
    bySpec.get(specLabel).push(m);
  }

  const nav = [...bySpec.keys()]
    .map((spec) => `<li><a href="#${escapeHtml(spec)}">${escapeHtml(spec)}</a></li>`)
    .join('\n');

  const sections = [...bySpec.entries()]
    .map(
      ([spec, tests]) =>
        `<h1 id="${escapeHtml(spec)}">${escapeHtml(spec)}.qmd</h1>` + tests.map(renderTest).join('\n'),
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Magic Move — visual review</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, system-ui, sans-serif; margin: 0; display: flex; max-width: 1400px; }
  nav { position: sticky; top: 0; align-self: flex-start; width: 220px; padding: 1.5rem 1rem; border-right: 1px solid #8884; height: 100vh; overflow-y: auto; }
  nav ul { list-style: none; padding: 0; }
  nav a { text-decoration: none; }
  main { flex: 1; padding: 1.5rem 2rem; min-width: 0; }
  h1 { border-bottom: 2px solid #8884; padding-bottom: 0.5rem; margin-top: 2.5rem; }
  section.test { margin: 1.5rem 0 3rem; }
  .columns { display: flex; gap: 2rem; flex-wrap: wrap; }
  .filmstrip-panel { flex: 2; min-width: 320px; }
  .video-panel { flex: 1; min-width: 280px; }
  .big-frame { border: 1px solid #8884; border-radius: 8px; padding: 0.5rem; }
  .big-frame img.big { max-width: 100%; display: block; margin: 0 auto; }
  .big-label { text-align: center; font-size: 0.85rem; opacity: 0.75; margin-top: 0.35rem; min-height: 1.2em; }
  .controls { display: flex; align-items: center; gap: 0.75rem; margin: 0.6rem 0; }
  .controls button { cursor: pointer; padding: 0.35rem 0.8rem; border-radius: 6px; border: 1px solid #8884; background: transparent; font-size: 0.9rem; }
  .frame-count { font-size: 0.85rem; opacity: 0.65; }
  .thumbs { display: flex; gap: 0.35rem; overflow-x: auto; padding-bottom: 0.3rem; }
  .thumbs img.frame { height: 70px; border: 2px solid transparent; border-radius: 4px; cursor: pointer; flex-shrink: 0; }
  .thumbs img.frame.active { border-color: #4a9eff; }
  video { max-width: 100%; border-radius: 8px; border: 1px solid #8884; }
  .no-video { font-size: 0.9rem; opacity: 0.7; }
</style>
</head>
<body>
<nav>
  <strong>Examples</strong>
  <ul>${nav}</ul>
</nav>
<main>
  <p>Generated by <code>npm run review:visual</code>. Filmstrip frames are the committed baselines under <code>tests/visual/*-snapshots/</code>; videos are ephemeral, produced by the last local <code>npm run test:visual</code> run.</p>
  ${sections}
</main>
<script>
  for (const section of document.querySelectorAll('section.test')) {
    const labels = JSON.parse(section.dataset.labels);
    const big = section.querySelector('img.big');
    const bigLabel = section.querySelector('.big-label');
    const thumbs = [...section.querySelectorAll('.thumbs img.frame')];
    const playBtn = section.querySelector('.play');
    let index = 0;
    let timer = null;

    function show(i) {
      index = i;
      if (thumbs[i]) {
        big.src = thumbs[i].src;
        bigLabel.textContent = labels[i] || '';
      }
      thumbs.forEach((t, j) => t.classList.toggle('active', j === i));
    }

    thumbs.forEach((t, i) => t.addEventListener('click', () => show(i)));

    playBtn.addEventListener('click', () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
        playBtn.textContent = '▶ Play filmstrip';
        return;
      }
      playBtn.textContent = '⏸ Pause';
      timer = setInterval(() => show((index + 1) % thumbs.length), 350);
    });

    show(0);
  }
</script>
</body>
</html>`;
}

const manifests = findSnapshotDirs().flatMap(loadManifests);
if (manifests.length === 0) {
  console.error('No manifests found under tests/visual/*-snapshots/. Run `npm run test:visual` first.');
  process.exit(1);
}

fs.writeFileSync(outFile, buildHtml(manifests));
console.log(`Wrote ${path.relative(repoRoot, outFile)} (${manifests.length} test(s))`);
