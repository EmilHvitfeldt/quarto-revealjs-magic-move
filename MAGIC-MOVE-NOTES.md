# Magic Move for Quarto Reveal.js

## Overview

This project implements magic-move animations for Quarto reveal.js presentations, enabling smooth animated transitions between code states. Uses Quarto's native syntax highlighting - no external dependencies.

## Key Files

- **`index-native.qmd`** - Quarto source with magic-move containers
- **`all-the-js-code-native.html`** - Contains all the JavaScript/CSS logic (loaded via `include-after-body`)
- **`index-native.html`** - Rendered output

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

### Quarto YAML

```yaml
format:
  revealjs:
    # Do NOT set highlight-style: none - we use native highlighting
    include-after-body:
      - "all-the-js-code-native.html"
```

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

### Quarto Extension

Could package this as a `_extensions/magic-move/` extension with:
- `_extension.yml` - metadata
- Lua filter for transformation (cleaner syntax)
- JS/CSS assets

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
