# Development Notes

Implementation notes for contributors. For usage docs, see [README.md](README.md).

## Overview

This project implements magic-move animations for Quarto reveal.js presentations, enabling smooth animated transitions between code states. Uses Quarto's native syntax highlighting - no external dependencies.

## Key Files

- **`_extensions/magic-move/_extension.yml`** - extension metadata, registers the revealjs plugin
- **`_extensions/magic-move/magic-move.js`** - all animation logic (div-based and slide-based)
- **`_extensions/magic-move/magic-move.css`** - animation and layout styles
- **`example*.qmd`** - demos covering code, slide-based, SVG, and MathJax sequences

## How It Works

### 1. HTML Structure in QMD

```markdown
::: magic-move

```r
# First code state
code here
```

```r
# Second code state
code here with changes
```

```r
# Third code state
more changes
```

:::
```

Key elements:
- `.magic-move` - wrapper div for the animation container
- Code blocks - each represents a step in the animation
- Fragment markers are auto-generated between code blocks

### 2. JavaScript Flow

1. **Find `.magic-move` containers** and their code blocks
2. **Auto-generate fragment markers** between code blocks
3. **Parse tokens** from Quarto's already-highlighted HTML
4. **Post-process tokens** - split on delimiters for finer granularity
5. **Match tokens** between steps by content (global matching)
6. **Assign keys** to tokens for tracking across steps
7. **Listen for reveal.js fragment events** to trigger animations
8. **FLIP animation** - First-Last-Invert-Play for smooth movement

### 3. Token Post-Processing

The native highlight.js tokenizer produces coarser tokens than ideal. For example, `(Year.Release))` might be a single token instead of separate parentheses.

To improve animation quality, tokens are **post-processed to split on delimiters**:

```javascript
// Delimiters that trigger splitting
const delimiters = /([()[\]{},])/

// "(Year.Release))" becomes: "(", "Year.Release", ")", ")"
```

This allows individual parentheses and brackets to animate independently when code is reformatted.

### 4. FLIP Animation

The animation uses the FLIP technique:
1. **First** - Record positions of all current tokens
2. **Last** - Render the new state (tokens in final positions)
3. **Invert** - Apply transforms to make tokens appear at their old positions
4. **Play** - Animate transforms back to zero (tokens move to final positions)

Tokens that exist in both states smoothly move to their new positions. New tokens fade in.

## Configuration

Note: do not set `highlight-style: none` in a document using this extension - it relies on Quarto's native syntax highlighting.

### Animation Timing

Current settings (in `all-the-js-code-native.html`):
- Duration: 0.5s
- Easing: ease-in-out

To change, modify the CSS animations and the JS transition:
```css
.magic-move .magic-move-render span span[data-entering] {
  animation: magic-enter 0.5s ease-in-out;
}
```
```javascript
span.style.transition = 'transform 0.5s ease-in-out'
```

## CSS Structure Requirements

Quarto's syntax highlighting CSS uses selectors like `code span.ot`. The implementation replicates Quarto's HTML structure:

```html
<div class="sourceCode">
  <pre class="sourceCode r">
    <code class="sourceCode r">
      <span id="line-1">  <!-- line wrapper -->
        <span class="fu">function</span>  <!-- token - NOT direct child of code -->
      </span>
    </code>
  </pre>
</div>
```

The line wrapper `<span>` is crucial - without it, the CSS selector `pre > code.sourceCode > span` would override token colors.

## Visual Regression Tests

Rendered animations are covered by Playwright-based visual snapshot tests under `tests/visual/`, since the bugs that matter here (a token overshooting mid-flight, a broken SVG morph) only show up as pixel differences during the animation, not just at the settled end state.

### How it works

- Each `*.spec.ts` file renders an example page, triggers a magic-move step, and captures a **filmstrip**: a screenshot at each point in a fixed sample schedule (0/100/250/450/700/950ms after the trigger — see `tests/visual/filmstrip.ts`). Each sampled frame is diffed against a committed baseline PNG in the matching `*.spec.ts-snapshots/` directory.
- Every sequence is exercised **forward and backward**: after stepping forward through all states, the test steps back down through them too (`goPrev()`, i.e. `Reveal.prev()`). Both `fragmenthidden` and slide-based back-navigation run their own reverse FLIP animation (from/to swapped — see the FLIP Animation section above) rather than just snapping back, so it's a genuinely separate code path with its own failure modes, not just the forward frames played in reverse. This roughly doubles the number of baseline PNGs, which is the intended trade-off.
- **Div-based** sequences (`basic.spec.ts`, `mathjax.spec.ts`) capture a locator scoped to the `.magic-move` container. **Slide-based** sequences (`slide-based.spec.ts`) capture the whole page instead: `initSlideBasedMagicMove` in `magic-move.js` appends its animated clones to a `position: fixed` overlay on `document.body`, and which section id is "current" changes every step, so there's no single stable container element to scope a locator to.
- `mathjax.spec.ts` needs outbound network access: the math example loads MathJax from an external CDN (`examples/mathjax.qmd`'s revealjs math config), which typesets asynchronously after page load. magic-move only inserts its fragment markers once that resolves (`waitForMathJax` in `magic-move.js`), so the test waits for one to exist (`state: 'attached'`, not `'visible'` — the markers are zero-size `<span>`s) rather than racing MathJax.
- These captures deliberately do **not** use `expect(locator).toHaveScreenshot()`. That assertion waits for the page to stop visually changing before it ever returns a screenshot — regardless of its `animations` option, which only controls CSS animation/transition freezing, not this separate stabilization wait — so every "sampled" frame would silently collapse to the fully-settled end state. Instead, `captureFrame()` takes a raw `locator.screenshot()` (no stabilization wait) and diffs it against the baseline by hand with `pixelmatch`/`pngjs`, tolerating up to 4% differing pixels (`MAX_DIFF_PIXEL_RATIO` in `filmstrip.ts`) to absorb the few-ms drift real-time sampling can have between machines and runs. The faster (~500ms) math animation needed more headroom here than the ~800ms code/slide ones — a few ms of drift is a bigger fraction of a shorter animation's timeline, so the same absolute jitter moves a sampled frame further along the curve. Baselines are written/updated by setting `UPDATE_SNAPSHOTS=1` (see below) rather than Playwright's own `--update-snapshots` flag, since that flag only affects `toHaveScreenshot`.
- Each filmstrip spec (e.g. `basic.spec.ts`) has a companion `*.replay.spec.ts` (e.g. `basic.replay.spec.ts`) with identical `describe`/test titles, whose only job is to trigger the same steps and wait, with **no** screenshots. It's the only place video recording is turned on (`test.use({ video: 'on' })`; the project default is `video: 'off'`). Taking ~13 raw screenshots per test while video recording is also active contends with Chromium's screencast pipeline enough to corrupt some recorded frames into solid gray/black flashes — verified by extracting the video's frames with `ffmpeg` and tiling them into a contact sheet. Splitting screenshot-taking and video-recording into separate tests eliminates that entirely. The review gallery links a replay test's video to its filmstrip counterpart's manifest by `describe` + test title (`testKey()` in `tests/visual/slug.ts`), not by which file produced it, since it's produced by a different spec file on purpose.
- Tests render and serve from a **separate Quarto profile** (`_quarto-test.yml`, activated via `npm run render:test` → `quarto render --profile test`), not from `docs/` (the public site). This exists because `examples/mathjax.qmd` and `examples/svgs.qmd` are deliberately excluded from the public site's render list, navbar, and search index (they're "not ready yet" — see the commit that hid them) but still need real rendered HTML to test against. The test profile renders all four examples to `.quarto-test-render/` (gitignored, never committed), which Playwright's `webServer` serves. A single-file `quarto render examples/mathjax.qmd` doesn't work for a file outside the active profile's render list — Quarto falls back to standalone-document mode and can't resolve the `magic-move` reveal.js plugin — so this has to be a real (if separate) project render, not an ad hoc one.

### Running locally

```bash
npm install
npx playwright install chromium   # first time only
npm run render:test               # quarto render --profile test, output goes to .quarto-test-render/
npm run test:visual
```

### Reviewing filmstrips and videos in a browser

`npm run test:visual` only tells you pass/fail. To actually look at what the animations do, `tools/visual-review/` builds a small static gallery page from the committed filmstrip baselines and whatever `.webm` videos your last local test run produced:

```bash
npm run test:visual   # produces the videos the gallery links to, if you haven't already
npm run review:visual
```

This regenerates `tools/visual-review/gallery.html` and serves it at `http://127.0.0.1:4174/tools/visual-review/gallery.html`. Each test gets its own section: a scrubbable filmstrip (click a thumbnail, or hit "Play filmstrip" to flip through the sampled frames like a flipbook) next to the real recorded video for comparison. The gallery HTML itself is generated, not committed; the filmstrip images it reads from `tests/visual/*.spec.ts-snapshots/` are.

### Updating baselines after an intentional visual change

Font/anti-aliasing rendering differs between macOS and Linux, so baselines generated bare-metal on macOS can produce false failures in CI (which runs on Linux). Prefer one of:

- **Docker (matches CI exactly):**
  ```bash
  docker run --rm -v "$PWD":/work -w /work -e UPDATE_SNAPSHOTS=1 mcr.microsoft.com/playwright:v1.63.0-noble \
    npx playwright test
  ```
  (bump the image tag to match the installed `@playwright/test` version in `package.json`)
- **From CI, when Docker isn't available locally:** run the "Visual regression tests" workflow manually (`workflow_dispatch`) with `update_snapshots: true`. It uploads the regenerated `*-snapshots/` files as a build artifact — download and commit them.

Either way, review the changed PNGs (`git status` after replacing them) before committing, alongside the code change that caused them.

## Known Limitations

1. **Token matching is imperfect** - when code changes significantly, tokens may fade in/out instead of animating smoothly

2. **Coarse tokenization** - highlight.js groups tokens differently than shiki; post-processing helps but isn't perfect

3. **No theme control** - uses whatever theme Quarto applies

## TODO

- [ ] **Make the native tokenizer more granular** - Currently relying on post-processing to split on delimiters `()[]{},"`. Consider:
  - Splitting on more delimiters (e.g., operators like `<-`, `%>%`, `=`, `+`, `-`)
  - Splitting identifiers from adjacent punctuation
  - Character-level tokenization for maximum flexibility
  - Preserving syntax highlighting classes when splitting

## Future Ideas

### Ideal Native Syntax

With a Lua filter, could support cleaner syntax like:
```markdown
```{.r .magic-move}
# step 1
x <- 1
---
# step 2
x <- 1
y <- 2
```
```

### Reveal.js Auto-Animate

Reveal.js has built-in [auto-animate](https://revealjs.com/auto-animate/) which animates between slides. However:
- It animates entire elements, not individual tokens
- Less granular than magic-move
- Won't achieve the "morphing code" effect

### Cross-Slide Magic Move

Alternative approach: animate between code blocks on different slides instead of within a single slide using divs.

**Current approach (div-based):**
- All code steps live on one slide as fragments
- Simple DOM manipulation within a single slide
- Uses reveal.js fragment system

**Cross-slide approach:**
- Hook into reveal.js `slidechanged` event
- Detect when consecutive slides both have magic-move code blocks
- Clone tokens, position absolutely, animate during transition
- More complex but feels more natural for presentations

Example syntax:
```markdown
## Step 1 {.magic-move}

```r
x <- 1
```

## Step 2 {.magic-move}

```r
x <- 1
y <- 2
```
```

Benefits:
- Each code state gets its own slide (better for PDF export, navigation)
- More natural slide-to-slide flow
- Can mix with regular slides

Challenges:
- Need to capture "before" state from leaving slide
- Overlay animation on top of slide transition
- Handle edge cases (skipping slides, going backward)

### Image Transitions (Shared Element / Hero Animations)

Extend the FLIP technique to animate images between slides. Same concept as "shared element transitions" (Android) or "hero animations" (iOS).

**How it would work:**
1. Match images between slides by `src`, `alt`, or a `data-id` attribute
2. Capture position/size on leaving slide
3. Animate to position/size on entering slide

**Example syntax:**
```markdown
## Slide 1

![](diagram.png){.magic-element data-id="fig1" width="200"}

## Slide 2

![](diagram.png){.magic-element data-id="fig1" width="600"}
```

The image would smoothly grow and reposition during the slide transition.

**Could extend to:**
- Images
- Diagrams/figures
- Text blocks
- Any element with a matching `data-id`

**Note:** The browser's [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API) does this natively but has limited browser support.

### SVG Element Animations

Animate individual SVG elements between slides - powerful for evolving diagrams, flowcharts, and data visualizations.

**What could animate:**
- Shapes (rect, circle, path) moving/resizing
- Text elements repositioning
- Colors/fills transitioning
- Stroke properties changing

**Path morphing** is more complex - if paths have different numbers of points, need a library:
- [flubber](https://github.com/veltman/flubber) - smooth shape interpolation
- GSAP MorphSVG plugin

**Example syntax:**
```markdown
## Slide 1

```{=html}
<svg class="magic-svg" data-id="diagram">
  <rect id="box1" x="10" y="10" width="50" height="50"/>
  <circle id="node1" cx="100" cy="50" r="20"/>
</svg>
```

## Slide 2

```{=html}
<svg class="magic-svg" data-id="diagram">
  <rect id="box1" x="200" y="100" width="100" height="50"/>
  <circle id="node1" cx="50" cy="150" r="40"/>
</svg>
```
```

Elements with matching `id`s would animate between positions.

**Requirement:** SVGs must be inline (not `<img src="file.svg">`) to access child elements.

**Handling `<img src="file.svg">`:**

Several approaches to work with external SVG files:

1. **Fetch and inline at runtime** (recommended for plugin)
   ```javascript
   const img = document.querySelector('img[src$=".svg"]');
   const response = await fetch(img.src);
   const svgText = await response.text();
   const parser = new DOMParser();
   const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
   const svgElement = svgDoc.documentElement;
   img.replaceWith(svgElement);
   ```

2. **Use `<object>` instead of `<img>`**
   ```html
   <object data="file.svg" type="image/svg+xml"></object>
   ```
   Can access SVG DOM via `object.contentDocument`, but has cross-origin restrictions.

3. **Quarto Lua filter (build time)** - Inline SVGs during render. The filter reads the SVG file and injects it directly into HTML. Cleanest solution but requires build-time processing.

4. **Treat as single element** - Just animate position/size of the whole image without internal element animation. Simplest fallback.
