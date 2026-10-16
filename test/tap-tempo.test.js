'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createTapTempo } = require('../src/core/tap-tempo.js');

test('first tap returns null and starts a new group', () => {
  const tap = createTapTempo();
  assert.equal(tap.tap(1000), null);
  assert.equal(tap.samples(), 0);
});

test('steady taps converge to the tapped tempo', () => {
  const tap = createTapTempo();
  let res = null;
  for (let i = 0; i < 5; i++) {
    res = tap.tap(1000 + i * 500); // 500ms => 120 BPM
  }
  assert.equal(res.bpm, 120);
  assert.equal(res.samples, 4);
  assert.equal(tap.bpm(), 120);
});

test('outliers are rejected via median filter', () => {
  const tap = createTapTempo();
  tap.tap(0);
  tap.tap(500);
  tap.tap(1000);
  tap.tap(1500);
  const before = tap.bpm();
  const res = tap.tap(2500); // 1000ms interval — far from the 500ms median
  assert.equal(res.bpm, before);
  assert.equal(tap.samples(), 3); // 离群值未入列 / outlier not stored
});

test('a long gap resets the group', () => {
  const tap = createTapTempo();
  tap.tap(0);
  tap.tap(500);
  tap.tap(1000);
  assert.equal(tap.samples(), 2);
  assert.equal(tap.tap(10000), null); // 超过 resetGapMs
  assert.equal(tap.samples(), 0);
});

test('tempo outside the valid range is ignored', () => {
  const tap = createTapTempo({ minBpm: 20, maxBpm: 300 });
  tap.tap(0);
  tap.tap(50); // 50ms => 1200 BPM, out of range
  assert.equal(tap.bpm(), null);
});

test('reset clears the state', () => {
  const tap = createTapTempo();
  tap.tap(0);
  tap.tap(500);
  tap.reset();
  assert.equal(tap.samples(), 0);
  assert.equal(tap.bpm(), null);
});

test('tap requires a finite timestamp', () => {
  const tap = createTapTempo();
  assert.throws(() => tap.tap('nope'));
});
