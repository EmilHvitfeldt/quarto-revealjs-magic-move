const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMagicMoveKeys } = require('../../_extensions/magic-move/magic-move.js');

// Deck-wide options come from Quarto's YAML metadata pipeline (format: revealjs:
// magic-move: {...}), which passes nested keys through verbatim - no kebab/camel
// normalization like the browser's `dataset` API gives per-container attributes for
// free. normalizeMagicMoveKeys closes that gap so both casings resolve the same option.
test('camelCase keys pass through unchanged', () => {
  assert.deepEqual(
    normalizeMagicMoveKeys({ duration: 800, delayExit: 0.2 }),
    { duration: 800, delayExit: 0.2 },
  );
});

test('kebab-case keys are converted to camelCase', () => {
  assert.deepEqual(
    normalizeMagicMoveKeys({ 'delay-exit': 0.2, 'delay-move': 1.3, stagger: 0.3 }),
    { delayExit: 0.2, delayMove: 1.3, stagger: 0.3 },
  );
});

test('empty options object stays empty', () => {
  assert.deepEqual(normalizeMagicMoveKeys({}), {});
});
