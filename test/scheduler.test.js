'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { planClicks, createScheduler } = require('../src/core/scheduler.js');

const near = (a, b, eps) => Math.abs(a - b) < (eps || 1e-9);

test('planClicks emits evenly spaced clicks for a simple meter', () => {
  const plan = planClicks({ startTime: 0, untilTime: 2000, bpm: 120, beatsPerBar: 4, subdivision: 'quarter' });
  assert.equal(plan.events.length, 4);
  plan.events.forEach((ev, i) => {
    assert.ok(near(ev.time, i * 500));
    assert.equal(ev.beat, i);
    assert.equal(ev.beatInBar, (i % 4) + 1);
    assert.equal(ev.bar, Math.floor(i / 4) + 1);
    assert.equal(ev.downbeat, i % 4 === 0);
    assert.equal(ev.accent, i % 4 === 0);
  });
  assert.equal(plan.endBeat, 4);
  assert.equal(plan.endSub, 0);
});

test('planClicks subdivides beats', () => {
  const plan = planClicks({ startTime: 0, untilTime: 1000, bpm: 120, beatsPerBar: 4, subdivision: 'eighth' });
  assert.equal(plan.events.length, 4); // 0, 250, 500, 750
  assert.ok(near(plan.events[1].time, 250));
  assert.equal(plan.events[1].sub, 1);
  assert.equal(plan.events[1].accent, false);
  assert.equal(plan.events[2].sub, 0);
  assert.equal(plan.events[2].accent, true); // 第二小节强拍 / bar 2 downbeat
  assert.equal(plan.events[2].bar, 2);
});

test('planClicks applies swing to off-beats', () => {
  const plan = planClicks({ startTime: 0, untilTime: 1000, bpm: 120, beatsPerBar: 4, subdivision: 'eighth', swing: 1 });
  assert.ok(near(plan.events[1].time, 250 + 500 / 6)); // 333.33ms
  assert.ok(near(plan.events[2].time, 500));           // 正拍不受影响
  assert.ok(near(plan.events[3].time, 750 + 500 / 6));
});

test('planClicks honours startBeat/startSub offsets', () => {
  const plan = planClicks({
    startTime: 1000, untilTime: 1500,
    bpm: 120, beatsPerBar: 4, subdivision: 'eighth',
    startBeat: 2, startSub: 1
  });
  assert.equal(plan.events.length, 2);
  assert.equal(plan.events[0].sub, 1);
  assert.ok(near(plan.events[0].time, 1000));
  assert.equal(plan.events[1].sub, 0);
  assert.ok(near(plan.events[1].time, 1250));
  assert.equal(plan.endBeat, 3);
  assert.equal(plan.endSub, 1);
});

test('planClicks supports accent modes', () => {
  const beat = planClicks({ startTime: 0, untilTime: 1000, bpm: 120, beatsPerBar: 4, subdivision: 'quarter', accentMode: 'beat' });
  beat.events.forEach((ev) => assert.equal(ev.accent, true));
  const none = planClicks({ startTime: 0, untilTime: 1000, bpm: 120, beatsPerBar: 4, subdivision: 'quarter', accentMode: 'none' });
  none.events.forEach((ev) => assert.equal(ev.accent, false));
});

test('planClicks rejects invalid input', () => {
  assert.throws(() => planClicks({ startTime: 0, untilTime: 100, bpm: 120, subdivision: 'nope' }));
  assert.throws(() => planClicks({ startTime: 'x', untilTime: 100, bpm: 120 }));
});

test('planClicks returns no events for an empty window', () => {
  const plan = planClicks({ startTime: 0, untilTime: 0, bpm: 120, beatsPerBar: 4 });
  assert.equal(plan.events.length, 0);
  assert.equal(plan.endBeat, 0);
});

test('scheduler emits each click exactly once across ticks', () => {
  const fired = [];
  const sch = createScheduler({ onClick: (ev) => fired.push(ev.time) });
  sch.configure({ bpm: 120, beatsPerBar: 4, subdivision: 'quarter' });
  sch.start(0);
  sch.tick(0, 1000);   // [0, 1000)   -> 0, 500
  sch.tick(500, 1000); // [1000, 1500) -> 1000
  sch.tick(900, 1000); // [1500, 1900) -> 1500
  assert.deepEqual(fired, [0, 500, 1000, 1500]);
  assert.equal(sch.position().beat, 4);
  assert.equal(sch.isRunning(), true);
  sch.stop();
  assert.equal(sch.isRunning(), false);
  assert.deepEqual(sch.tick(2000, 1000), []);
});

test('scheduler re-anchors the grid on tempo change while running', () => {
  const fired = [];
  const sch = createScheduler({ onClick: (ev) => fired.push(ev.time) });
  sch.configure({ bpm: 60, beatsPerBar: 4, subdivision: 'quarter' }); // 1000ms/beat
  sch.start(0);
  sch.tick(0, 500);
  assert.deepEqual(fired, [0]);
  sch.configure({ bpm: 120 }, 500); // 120 BPM, re-anchor current position to now
  const more = sch.tick(500, 500).map((e) => e.time);
  assert.deepEqual(more, [500]);
  const next = sch.tick(600, 500).map((e) => e.time);
  assert.deepEqual(next, [1000]);
});

test('scheduler drops the backlog when the clock jumps', () => {
  const fired = [];
  const sch = createScheduler({ onClick: (ev) => fired.push(ev.time) });
  sch.configure({ bpm: 120, beatsPerBar: 4, subdivision: 'quarter' });
  sch.start(0);
  sch.tick(0, 100);
  assert.deepEqual(fired, [0]);
  const after = sch.tick(5000, 100).map((e) => e.time);
  assert.deepEqual(after, [5000]); // 不对历史补拍 / no catch-up burst
});

test('scheduler requires configuration before start', () => {
  const sch = createScheduler({ onClick: () => {} });
  assert.throws(() => sch.start(0));
});
