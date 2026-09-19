const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAnimationPlan, scheduleAnimationPlan } = require('../../_extensions/magic-move/magic-move.js');

// Minimal step builder: each line is an array of keys (pre-matched, as if matchSteps
// already ran). buildAnimationPlan/scheduleAnimationPlan are pure over token keys and
// line structure, so this is enough to exercise them without any DOM or highlighting.
function step(lines) {
  const tokens = lines.flat().map(key => ({ key }));
  return { lines: lines.map(line => line.map(key => ({ key }))), tokens };
}

test('all tokens matched -> only move ops, no exit/enter', () => {
  const from = step([['a', 'b'], ['c']]);
  const to = step([['a', 'b'], ['c']]);
  const plan = buildAnimationPlan(from, to);
  assert.deepEqual(plan, [
    { type: 'move', key: 'a' },
    { type: 'move', key: 'b' },
    { type: 'move', key: 'c' },
  ]);
});

test('added line -> batched enter op', () => {
  const from = step([['a']]);
  const to = step([['a'], ['b', 'c']]);
  const plan = buildAnimationPlan(from, to);
  assert.deepEqual(plan, [
    { type: 'move', key: 'a' },
    { type: 'enter', keys: ['b', 'c'] },
  ]);
});

test('removed line -> batched exit op', () => {
  const from = step([['a'], ['b', 'c']]);
  const to = step([['a']]);
  const plan = buildAnimationPlan(from, to);
  assert.deepEqual(plan, [
    { type: 'exit', keys: ['b', 'c'] },
    { type: 'move', key: 'a' },
  ]);
});

test('reordered line with unchanged tokens -> moves only, no exit/enter', () => {
  const from = step([['a'], ['b']]);
  const to = step([['b'], ['a']]);
  const plan = buildAnimationPlan(from, to);
  assert.deepEqual(plan.filter(op => op.type !== 'move').length, 0);
  assert.deepEqual(new Set(plan.map(op => op.key)), new Set(['a', 'b']));
});

test('exit/enter batching never crosses a line boundary', () => {
  // Two adjacent removed lines: each becomes its own exit op, not one merged op,
  // even though the runs are back-to-back in overall document order.
  const from = step([['a', 'b'], ['c', 'd']]);
  const to = step([[]]);
  const plan = buildAnimationPlan(from, to);
  const exits = plan.filter(op => op.type === 'exit');
  assert.deepEqual(exits, [
    { type: 'exit', keys: ['a', 'b'] },
    { type: 'exit', keys: ['c', 'd'] },
  ]);
});

test('empty diff produces an empty plan', () => {
  const from = step([[]]);
  const to = step([[]]);
  assert.deepEqual(buildAnimationPlan(from, to), []);
});

test('scheduleAnimationPlan defaults collapse to simultaneous playback', () => {
  const plan = [
    { type: 'exit', keys: ['a', 'b'] },
    { type: 'move', key: 'c' },
    { type: 'enter', keys: ['d', 'e'] },
  ];
  const scheduled = scheduleAnimationPlan(plan);
  for (const entry of scheduled) {
    assert.equal(entry.startMs, 0);
    assert.equal(entry.durationMs, 500);
    assert.equal(entry.easing, 'ease-in-out');
  }
});

test('scheduleAnimationPlan applies delay ratios and within-group stagger', () => {
  const plan = [
    { type: 'exit', keys: ['a'] },
    { type: 'move', key: 'b' },
    { type: 'enter', keys: ['c', 'd'] },
  ];
  const scheduled = scheduleAnimationPlan(plan, {
    duration: 1000,
    delayExit: 0,
    delayMove: 0.2,
    delayEnter: 0.5,
    stagger: 0.1,
  });
  const byKey = Object.fromEntries(scheduled.map(e => [e.key, e]));

  assert.equal(byKey.a.startMs, 0);
  assert.equal(byKey.b.startMs, 200);
  assert.equal(byKey.c.startMs, 500);
  assert.equal(byKey.d.startMs, 600); // 500 + 1 * 0.1 * 1000, staggered within the enter group only
});

test('delayContainer adds a uniform base to every op, on top of its own delay', () => {
  const plan = [
    { type: 'exit', keys: ['a'] },
    { type: 'move', key: 'b' },
    { type: 'enter', keys: ['c'] },
  ];
  const scheduled = scheduleAnimationPlan(plan, { duration: 1000, delayContainer: 0.25, delayEnter: 0.1 });
  const byKey = Object.fromEntries(scheduled.map(e => [e.key, e]));

  assert.equal(byKey.a.startMs, 250);
  assert.equal(byKey.b.startMs, 250);
  assert.equal(byKey.c.startMs, 350); // (0.25 + 0.1) * 1000
});

test('stagger does not cascade across separate groups', () => {
  const plan = [
    { type: 'enter', keys: ['a', 'b'] },
    { type: 'move', key: 'x' },
    { type: 'enter', keys: ['c'] },
  ];
  const scheduled = scheduleAnimationPlan(plan, { duration: 1000, delayEnter: 0, stagger: 0.1 });
  const byKey = Object.fromEntries(scheduled.map(e => [e.key, e]));

  assert.equal(byKey.a.startMs, 0);
  assert.equal(byKey.b.startMs, 100);
  // second enter group restarts its own index at 0, independent of the first group
  assert.equal(byKey.c.startMs, 0);
});
