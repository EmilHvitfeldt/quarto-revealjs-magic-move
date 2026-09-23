# Magic Move for Quarto revealjs

A Quarto extension that brings [Magic Move](https://slidevjs.com/features/magic-move.html)-style animated transitions to [revealjs](https://quarto.org/docs/presentations/revealjs/) presentations. Code, math, and SVG output morph smoothly between states instead of hard-cutting, so viewers can visually track what changed.

Built on Quarto's native syntax highlighting, with no external JavaScript dependencies.

## Installation

```bash
quarto add emilhvitfeldt/quarto-revealjs-magic-move
```

This installs the extension under `_extensions`. Add the following to your document's YAML header:

```yaml
---
format: revealjs
revealjs-plugins:
  - magic-move
---
```

## Usage

There are two ways to mark up a magic-move sequence: **div-based** (fragments within a single slide) and **slide-based** (consecutive slides).

### Div-based (fragments)

Wrap consecutive code blocks in a `magic-move` div. Each block becomes a step, and pressing space/arrow keys steps through the animation as fragments on one slide.

````markdown
::: magic-move

```javascript
if (condition) a else b
```

```javascript
if (condition) {
  a
} else {
  b
}
```

:::
````

### Slide-based

Add the `.magic-move` class to consecutive slide headers instead. Each slide is a full step, and the animation plays as you navigate from one slide to the next.

`````markdown
## Step 1 {.magic-move}

```r
x <- 1
```

## Step 2 {.magic-move}

```r
x <- 1
y <- 2
```
`````

A slide without `.magic-move` breaks the sequence, so you can freely mix animated and regular slides.

### What can animate

Magic-move works on:

- **Code blocks** (any language Quarto highlights) — tokens are matched and moved between states
- **Math** (`$$ ... $$`) — equations morph between steps
- **SVG output** — consecutive `.magic-move` slides that each render an inline SVG have their shapes (`rect`, `circle`, `line`, `polyline`, `polygon`, `ellipse`, `path`, and R-style glyph text) matched and morphed between states. This works with any plotting library whose SVG output uses plain, literal shape elements with stable attributes across renders — verified with:
  - **R**: ggplot2, grid, base R graphics, lattice (all render through R's `dev: svg` Cairo device)
  - **Python**: matplotlib, seaborn, plotnine (bar/line/area marks — not scatter/point markers, see limitations), and Altair with `alt.renderers.enable("svg")`
  - **Julia**: CairoMakie, and Plots.jl with the GR backend (`Plots.gr(fmt = :svg)`)

See the `example*.qmd` files in this repo for runnable demos of each.

## Limitations

- Token matching is content-based; significantly different code may fade in/out instead of animating smoothly
- Coarse tokenization from Quarto's syntax highlighter means very fine-grained punctuation animation isn't always perfect
- SVG shape matching has no fallback for elements whose grouping key (fill/stroke/clip-path) differs between renders. This breaks a few specific cases:
  - **Plotly (via kaleido)** and **ggiraph's `girafe()` widgets** stamp a random clip-path id on every render, so shapes never match across slides and the transition falls back to a hard cut
  - **Gadfly.jl** positions marks via an ancestor `<g transform>` rather than each element's own coordinates, which the matcher doesn't read
  - **matplotlib/seaborn/plotnine scatter or point markers** render as `<use>` glyph references rather than literal `<circle>`/`<path>` shapes, so they don't animate (bars/lines/areas from the same libraries are unaffected)
  - **Charts rendered via Quarto's Observable JS (`{ojs}`) engine** — e.g. D3, Observable Plot, Vega-Lite — produce fully compatible SVG shapes, but render *after* Reveal's `ready` event, while this extension only scans for SVG content once, at `ready`. So `{ojs}`-rendered charts never get picked up as a magic-move sequence at all, regardless of their SVG shape compatibility.

## License

MIT
