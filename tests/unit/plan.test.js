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

test('scheduleAnimationPlan applies delay ratios; a group\'s keys share one start time', () => {
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
  // c and d are two keys of the *same* enter group (one contiguous run), so they
  // share a single start time - a group is a visual unit, not something that
  // itself trickles token-by-token.
  assert.equal(byKey.c.startMs, 500);
  assert.equal(byKey.d.startMs, 500);
});

test('stagger cascades across successive groups of the same type, one op at a time', () => {
  // Models "remove line 2, then remove line 3, then move" - each removed line is
  // its own exit op (buildAnimationPlan batches per-line), and stagger delays each
  // successive op relative to the previous one rather than trickling within one.
  const plan = [
    { type: 'exit', keys: ['line2-a', 'line2-b'] },
    { type: 'exit', keys: ['line3-a', 'line3-b'] },
    { type: 'move', key: 'line4' },
  ];
  const scheduled = scheduleAnimationPlan(plan, { duration: 1000, stagger: 0.3, delayMove: 1.3 });
  const byKey = Object.fromEntries(scheduled.map(e => [e.key, e]));

  assert.equal(byKey['line2-a'].startMs, 0);
  assert.equal(byKey['line2-b'].startMs, 0);
  assert.equal(byKey['line3-a'].startMs, 300);
  assert.equal(byKey['line3-b'].startMs, 300);
  // line4's move waits until both exit groups have fully finished: the second
  // exit group starts at 300ms and runs for 1000ms, ending at 1300ms.
  assert.equal(byKey.line4.startMs, 1300);
});

test('reverse mirrors the timeline: last-to-start plays first', () => {
  // Same shape as the "remove line 2, then line 3, then move" case, but this is what
  // backward navigation through it produces: buildAnimationPlan(fromStep=short,
  // toStep=full) naturally turns the removed lines into enter ops (they're
  // reappearing) - reverse should make the move happen first and the enter groups
  // replay in reverse order (last-removed reappears first), not just relabel them.
  const plan = [
    { type: 'move', key: 'line4' },
    { type: 'enter', keys: ['line2-a', 'line2-b'] },
    { type: 'enter', keys: ['line3-a', 'line3-b'] },
  ];
  const scheduled = scheduleAnimationPlan(plan, { duration: 1000, stagger: 0.3, delayMove: 1.3, reverse: true });
  const byKey = Object.fromEntries(scheduled.map(e => [e.key, e]));

  assert.equal(byKey.line4.startMs, 0);
  assert.equal(byKey['line3-a'].startMs, 1000);
  assert.equal(byKey['line3-b'].startMs, 1000);
  assert.equal(byKey['line2-a'].startMs, 1300);
  assert.equal(byKey['line2-b'].startMs, 1300);
  // line3 (the one removed *last* going forward) starts reappearing before line2.
  assert.ok(byKey['line3-a'].startMs < byKey['line2-a'].startMs);
});

test('reverse is a no-op when every op already starts simultaneously', () => {
  const plan = [
    { type: 'exit', keys: ['a'] },
    { type: 'move', key: 'b' },
    { type: 'enter', keys: ['c'] },
  ];
  const forward = scheduleAnimationPlan(plan, { duration: 500 });
  const reversed = scheduleAnimationPlan(plan, { duration: 500, reverse: true });
  assert.deepEqual(reversed, forward);
});

test('reverse on an empty plan returns an empty schedule', () => {
  assert.deepEqual(scheduleAnimationPlan([], { reverse: true }), []);
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

test('stagger indices exit and enter groups independently', () => {
  const plan = [
    { type: 'exit', keys: ['a'] },
    { type: 'enter', keys: ['b'] },
    { type: 'exit', keys: ['c'] },
  ];
  const scheduled = scheduleAnimationPlan(plan, { duration: 1000, stagger: 0.1 });
  const byKey = Object.fromEntries(scheduled.map(e => [e.key, e]));

  assert.equal(byKey.a.startMs, 0); // 1st exit group
  assert.equal(byKey.b.startMs, 0); // 1st enter group, its own independent counter
  assert.equal(byKey.c.startMs, 100); // 2nd exit group
});
