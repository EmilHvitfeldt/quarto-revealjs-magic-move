# Changelog

## Unreleased

### New features

- Div-based and slide-based code magic-move now support configurable animation timing. A deck-wide default can be set via `format: revealjs: magic-move: { ... }` in the document's YAML, and overridden per `.magic-move` container with fenced-div/header attributes:
  - `duration` — animation length in ms (default `500`)
  - `easing` — CSS easing function (default `ease-in-out`)
  - `delay-exit`, `delay-move`, `delay-enter` — ratios of `duration` that offset when each kind of change starts (default `0`, i.e. everything plays simultaneously)
  - `stagger` — ratio of `duration` to cascade successive same-type groups (e.g. each deleted line fading out one after another instead of all at once)

  Example:

  ```markdown
  ::: {.magic-move delay-exit=0 stagger=0.3 delay-move=1.3}
  ...
  :::
  ```

  Values can be unquoted as long as they contain no whitespace (`stagger=0.3` works the same as `stagger="0.3"`).

### Bug fixes

- Removed lines/tokens in div-based and slide-based code magic-move now fade out instead of vanishing instantly. Previously only additions and moves were animated.
- Backward navigation (stepping back through a magic-move sequence) now correctly time-reverses any configured stagger/delay choreography, instead of replaying it in the same order it played forward.
- The deck-wide `format: revealjs: magic-move: { ... }` default now actually reaches the browser. `_extension.yml` previously never declared `magicMove` as a config key, so Quarto's revealjs writer silently dropped it and `deck.getConfig().magicMove` was always `undefined` ([#4](https://github.com/EmilHvitfeldt/quarto-revealjs-magic-move/issues/4)). Nested option names can be written as either `delayExit` or `delay-exit` — both now resolve the same way.

### Internal

- The animation pipeline for div-based and slide-based code was restructured into three stages: **match** (unchanged token/line matching), **plan** (`buildAnimationPlan`, a pure function turning a match result into an ordered list of exit/move/enter operations), and **schedule** (`scheduleAnimationPlan`, a pure function resolving that plan into per-token start times from the timing config above). This has no effect on default-timing output but makes the choreography configurable and independently testable.
- Added `tests/unit/` (`node --test`, run via `npm run test:unit`) covering the new plan/schedule functions.
- Added `examples/timing-options.qmd` and `tests/visual/timing-options.spec.ts` demonstrating and covering the new timing options.
- Added `examples/deck-wide-config.qmd` and `tests/visual/deck-wide-config.spec.ts` covering the deck-wide config path specifically, plus a `tests/unit/normalize-magic-move-keys.test.js` unit test for the kebab/camelCase normalization.
