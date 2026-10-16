'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parsePolyrhythm, polyEvents, cycleBeats, defaultCycleMs, gcd, lcm
} = require('../src/core/polyrhythm.js');

test('gcd and lcm', () => {
  assert.equal(gcd(4, 6), 2);
  assert.equal(gcd(3, 2), 1);
  assert.equal(lcm(3, 2), 6);
  assert.equal(lcm(4, 6), 12);
});

test('parsePolyrhythm accepts common separators and rejects junk', () => {
  assert.deepEqual(parsePolyrhythm('3:2'), { a: 3, b: 2 });
  assert.deepEqual(parsePolyrhythm(' 4 x 3 '), { a: 4, b: 3 });
  assert.deepEqual(parsePolyrhythm('5/2'), { a: 5, b: 2 });
  assert.throws(() => parsePolyrhythm('3-2'));
  assert.throws(() => parsePolyrhythm('13:2'));
  assert.throws(() => parsePolyrhythm('1:2'));
  assert.throws(() => parsePolyrhythm('3:3'));
  assert.throws(() => parsePolyrhythm('abc'));
  assert.throws(() => parsePolyrhythm(null));
});

test('cycleBeats and defaultCycleMs derive from the ratio', () => {
  assert.equal(cycleBeats(3, 2), 6);
  assert.equal(cycleBeats(2, 3), 6);
  assert.equal(cycleBeats(4, 6), 12);
  assert.equal(defaultCycleMs(3, 2, 120), 3000); // 6 beats x 500ms
});

test('polyEvents merges both voices in time order', () => {
  const events = polyEvents({ a: 3, b: 2, cycleMs: 3000 });
  assert.equal(events.length, 5);
  const times = events.map((e) => e.time);
  assert.deepEqual(times.slice().sort((x, y) => x - y), times);
  const aTimes = events.filter((e) => e.voice === 'a').map((e) => e.time);
  const bTimes = events.filter((e) => e.voice === 'b').map((e) => e.time);
  assert.deepEqual(aTimes, [0, 1000, 2000]);
  assert.deepEqual(bTimes, [0, 1500]);
  // 同刻事件 a 声部在前 / ties resolve to voice 'a' first
  assert.equal(events[0].voice, 'a');
  assert.equal(events[1].voice, 'b');
  // 每个声部首音带重音 / first click of each voice is accented
  assert.equal(events.filter((e) => e.accent).length, 2);
});

test('polyEvents validates its input', () => {
  assert.throws(() => polyEvents({ a: 3, b: 3, cycleMs: 1000 }));
  assert.throws(() => polyEvents({ a: 3, b: 2, cycleMs: 0 }));
  assert.throws(() => polyEvents({ a: 99, b: 2, cycleMs: 1000 }));
});
