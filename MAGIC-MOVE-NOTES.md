# Shiki Magic Move Integration for Quarto Reveal.js

## Overview

This project integrates [shiki-magic-move](https://github.com/shikijs/shiki-magic-move) into Quarto reveal.js presentations, enabling smooth animated transitions between code states. This is NOT a built-in Quarto feature - it's a custom hack.

## Key Files

- **`index.qmd`** - Quarto source with magic-move containers
- **`all-the-js-code.html`** - Contains all the JavaScript logic (loaded via `include-after-body`)
- **`index.html`** - Rendered output

## How It Works

### 1. HTML Structure in QMD

```markdown
::: {.magic-move-container data-lang="r"}

```r
# First code state
code here
```

[]{.fragment .magic-move-step}

```r
# Second code state
code here with changes
```

[]{.fragment .magic-move-step}

```r
# Third code state
more changes
```

:::
```

Key elements:
- `.magic-move-container` - wrapper div with `data-lang` attribute for syntax highlighting
- Code blocks - each represents a step in the animation
- `[]{.fragment .magic-move-step}` - empty span that triggers fragment events in reveal.js

### 2. JavaScript Flow

1. **Load dependencies** from CDN:
   - `shiki` - syntax highlighter
   - `shiki-magic-move/core` - token generation and syncing
   - `shiki-magic-move/renderer` - FLIP animation renderer

2. **Initialize highlighter** with themes and languages

3. **Process each `.magic-move-container`**:
   - Extract code from each `<pre><code>` block
   - Generate keyed tokens using `codeToKeyedTokens()`
   - Sync keys between consecutive steps using `syncTokenKeys()`
   - Apply custom improvements for better token matching
   - Fix duplicate keys

4. **Create render target** and hide original code blocks

5. **Listen for reveal.js fragment events** to animate between steps

### 3. Reveal.js Scale Compensation

Reveal.js scales slides using CSS `transform: scale()`. This breaks position calculations in the magic-move renderer because:
- `getBoundingClientRect()` returns screen coordinates (scaled)
- CSS `left`/`top` properties work in local coordinates (unscaled)

**Solution**: Temporarily apply counter-scale during position calculation:
```javascript
const scale = getScale()  // e.g., 0.8
renderTarget.style.transform = `scale(${1/scale})`  // counter-scale
renderTarget.getBoundingClientRect()  // force layout
renderer.render(tokens[step], options)  // calculate positions
renderTarget.style.transform = ''  // remove immediately (before paint)
```

This happens synchronously before the browser paints, so there's no visual flicker.

## Token Matching Challenges

### The Problem

`syncTokenKeys` matches tokens by content. When code restructures, token boundaries change:
- `data.frame(table(Year.Release))` → one token: `(Year.Release))`
- After restructuring → separate token: `(Year.Release)`

These don't match because they're literally different strings.

### Custom Solutions Implemented

#### 1. `improveTokenMatching()`
Matches tokens that are substrings of each other, with constraints:
- Only matches unmatched tokens (those with different hash prefix)
- Requires strings differ by at most 1 character
- Prefers matches on the same or nearby lines
- Scores by length similarity + line proximity

#### 2. `fixDuplicateKeys()`
When multiple tokens get the same key:
- Keeps the key for the token closest to the original line position
- Assigns unique keys to others
- Uses previous step's line positions as reference

#### 3. Processing Order
Critical: process each step completely before moving to the next:
```javascript
for (let i = 1; i < tokens.length; i++) {
  syncTokenKeys(tokens[i - 1], tokens[i])      // 1. Standard sync
  improveTokenMatching(tokens[i - 1], tokens[i]) // 2. Improve matches
  fixDuplicateKeys(tokens[i], tokens[i - 1], i)  // 3. Fix duplicates
}
```

If you sync ALL steps first, then improve ALL steps, the improvements to step N break the already-synced step N+1.

## Configuration

### Quarto YAML
```yaml
format:
  revealjs:
    highlight-style: none  # Disable Quarto's highlighting (shiki does it)
    include-after-body:
      - "all-the-js-code.html"
```

### Highlighter Languages
Add languages in the `createHighlighter()` call:
```javascript
const highlighter = await createHighlighter({
  themes: ['github-dark'],
  langs: ['r', 'javascript', 'python']  // Add more as needed
})
```

### Animation Options
```javascript
renderer.render(tokens[step], {
  duration: 500,      // milliseconds
  stagger: 3,         // delay between tokens
  delayMove: 0,
  delayLeave: 0,
  delayEnter: 0.3,
  easing: 'ease-in-out',
  animateContainer: false  // prevent container size animation
})
```

### Container Sizing
Height is calculated from max lines across all steps:
```javascript
const maxLines = Math.max(...steps.map(s => s.split('\n').length))
const lineHeight = 1.4
const estimatedHeight = (maxLines * lineHeight) + 2  // +2em for padding
```

## Known Limitations

1. **Token matching is imperfect** - when code changes significantly, tokens may fade in/out instead of animating

2. **Same content, different positions** - multiple identical tokens (e.g., `Year.Release` appearing twice) may match incorrectly; the line-aware fixing helps but isn't perfect

3. **Scale changes** - if browser/window resizes, scale needs recalculation (currently calculated once at init)

4. **Languages** - must be pre-loaded in the highlighter

## Debugging

Console logs show token keys at various stages:
- "After all processing:" shows final `(Year.Release)` keys
- "Step X fixDuplicateKeys:" shows duplicate resolution

To debug token matching:
1. Check if tokens have same key suffix between steps → will animate
2. Different keys → will fade in/out
3. Look for `unique-XXXX` keys indicating duplicates were resolved

## Dependencies (loaded from CDN)

- `https://esm.sh/shiki@3.0.0`
- `https://esm.sh/shiki-magic-move/core`
- `https://esm.sh/shiki-magic-move/renderer`
- `https://cdn.jsdelivr.net/npm/shiki-magic-move/dist/style.css`

---

## Notes for Native Quarto Integration

### Current Limitations of Manual Approach

1. **`highlight-style: none` is global** - disables syntax highlighting for ALL code blocks, not just magic-move ones
2. **Verbose syntax** - requires manual div wrappers and fragment markers
3. **Runtime tokenization** - tokens are generated in browser, adding load time
4. **Language must be specified twice** - in `data-lang` and in code fence

### Ideal Native Syntax (aspirational)

Something like:
```markdown
```{.r magic-move}
# step 1
x <- 1
---
# step 2
x <- 1
y <- 2
```
```

Or using Quarto's native fragment syntax with a special class.

### Integration Points in Quarto

1. **Lua filters** - Quarto uses Pandoc Lua filters. A filter could:
   - Detect magic-move code blocks
   - Transform them into the required HTML structure
   - Inject the necessary JS/CSS
   - Pre-compute tokens at render time (see below)

2. **Quarto extensions** - Could package this as a `_extensions/magic-move/` extension with:
   - `_extension.yml` - metadata
   - Lua filter for transformation
   - JS/CSS assets

3. **reveal.js plugins** - Quarto supports custom reveal plugins via `revealjs-plugins`

### Pre-computed Tokens (Recommended for Native)

shiki-magic-move supports `ShikiMagicMovePrecompiled` which accepts pre-tokenized data. Benefits:
- No runtime shiki dependency (smaller bundle)
- Faster page load
- Tokens computed once at build time

The flow would be:
1. Lua filter extracts code blocks
2. Build step runs shiki tokenization (Node.js)
3. Tokens serialized as JSON in HTML
4. Client-side only needs the renderer

See: `shiki-magic-move/dist/renderer.mjs` - can be used standalone without the full shiki library.

### HTML Structure Quarto Generates for Code

Quarto currently generates:
```html
<pre class="r"><code>Year.Release &lt;- game$Year.Release</code></pre>
```

For magic-move we're creating:
```html
<div class="magic-move-container" data-lang="r">
  <pre class="r"><code>...</code></pre>
  <span class="fragment magic-move-step"></span>
  <pre class="r"><code>...</code></pre>
</div>
```

A Lua filter would need to:
1. Identify consecutive code blocks meant for magic-move
2. Wrap them in container div
3. Insert fragment spans between them
4. Add `data-lang` attribute

### Coexisting with Quarto's Syntax Highlighting

Options:
1. **Let Quarto highlight, re-highlight with shiki** - wasteful but works
2. **Disable highlighting per-block** - Quarto may support this with `code-block-highlight: false` or similar
3. **Use Quarto's built-in shiki** - Quarto 1.4+ uses shiki internally! Could potentially tap into that

### Quarto Already Uses Shiki

As of Quarto 1.4+, shiki is the default syntax highlighter. This means:
- The tokenization infrastructure exists
- Themes are already available
- May be able to access tokens directly from Quarto's pipeline

Investigate: How does Quarto's shiki integration work? Can we get keyed tokens from it?

### Reveal.js Auto-Animate Alternative

Reveal.js has built-in [auto-animate](https://revealjs.com/auto-animate/) which can animate between slides. However:
- It animates entire elements, not individual tokens
- Less granular than shiki-magic-move
- Won't achieve the "morphing code" effect

### Files to Look At

- Quarto source: how `highlight-style` is processed
- Quarto's shiki integration code
- `shiki-magic-move/src/renderer.ts` - standalone renderer
- `shiki-magic-move/src/core.ts` - `codeToKeyedTokens` and `syncTokenKeys`

### Key Functions to Potentially Run at Build Time

```javascript
// These could run in Node.js at build time:
import { codeToKeyedTokens, syncTokenKeys } from 'shiki-magic-move/core'

const tokens = steps.map(code =>
  codeToKeyedTokens(highlighter, code, { lang, theme })
)
for (let i = 1; i < tokens.length; i++) {
  syncTokenKeys(tokens[i-1], tokens[i])
}
// Then serialize tokens to JSON for client
```

```javascript
// Client-side only needs:
import { MagicMoveRenderer } from 'shiki-magic-move/renderer'
const renderer = new MagicMoveRenderer(container)
renderer.render(precomputedTokens[step], options)
```

### Custom Token Matching

Our custom `improveTokenMatching` and `fixDuplicateKeys` functions would need to run at build time too if pre-computing tokens. They modify the token keys which is essential for good animations.
