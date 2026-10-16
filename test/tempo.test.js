'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const tempo = require('../src/core/tempo.js');

const near = (a, b, eps) => Math.abs(a - b) < (eps || 1e-9);

test('clampBpm clamps to [20, 300] and rounds', () => {
  assert.equal(tempo.clampBpm(10), 20);
  assert.equal(tempo.clampBpm(999), 300);
  assert.equal(tempo.clampBpm(120.4), 120);
  assert.equal(tempo.clampBpm('abc'), 100);
});

test('bpmToBeatMs converts tempo to milliseconds', () => {
  assert.equal(tempo.bpmToBeatMs(120), 500);
  assert.equal(tempo.bpmToBeatMs(60), 1000);
  assert.equal(tempo.bpmToBeatMs(20), 3000);
  assert.equal(tempo.bpmToBeatMs(300), 200);
});

test('subdivisionSteps validates names', () => {
  assert.equal(tempo.subdivisionSteps('quarter'), 1);
  assert.equal(tempo.subdivisionSteps('eighth'), 2);
  assert.equal(tempo.subdivisionSteps('triplet'), 3);
  assert.equal(tempo.subdivisionSteps('sixteenth'), 4);
  assert.throws(() => tempo.subdivisionSteps('nope'));
});

test('subOffsetMs lays out subdivisions inside a beat', () => {
  const beatMs = 500; // 120 BPM
  assert.equal(tempo.subOffsetMs(0, beatMs, 'quarter', 0), 0);
  assert.equal(tempo.subOffsetMs(1, beatMs, 'eighth', 0), 250);
  assert.equal(tempo.subOffsetMs(3, beatMs, 'sixteenth', 0), 375);
  assert.ok(near(tempo.subOffsetMs(1, beatMs, 'triplet', 0), 500 / 3));
});

test('swing shifts off-beats of even subdivisions only', () => {
  const beatMs = 600; // 100 BPM
  assert.equal(tempo.subOffsetMs(1, beatMs, 'eighth', 0), 300);
  // 满摇摆时反拍落在 2/3 拍处（三连音感觉）/ full swing puts the off-beat at 2/3 of the beat
  assert.ok(near(tempo.subOffsetMs(1, beatMs, 'eighth', 1), 400));
  // 三连音不受摇摆影响 / triplets are unaffected
  assert.equal(tempo.subOffsetMs(1, beatMs, 'triplet', 1), 200);
  // 正拍不受影响 / downbeats unaffected
  assert.equal(tempo.subOffsetMs(0, beatMs, 'eighth', 1), 0);
  assert.equal(tempo.subOffsetMs(2, beatMs, 'sixteenth', 1), 300);
});

test('countLabel returns counting syllables', () => {
  assert.equal(tempo.countLabel(0, 'sixteenth'), '1');
  assert.equal(tempo.countLabel(1, 'sixteenth'), 'e');
  assert.equal(tempo.countLabel(2, 'sixteenth'), '&');
  assert.equal(tempo.countLabel(3, 'sixteenth'), 'a');
  assert.equal(tempo.countLabel(1, 'triplet'), 'la');
  assert.equal(tempo.countLabel(2, 'triplet'), 'li');
  assert.equal(tempo.countLabel(0, 'quarter'), '1');
});

test('rampSegments builds ascending, descending and flat ladders', () => {
  const up = tempo.rampSegments({ fromBpm: 60, toBpm: 70, stepBpm: 5, barsPerStep: 4 });
  assert.deepEqual(up, [
    { fromBpm: 60, toBpm: 65, bars: 4 },
    { fromBpm: 65, toBpm: 70, bars: 4 }
  ]);
  const down = tempo.rampSegments({ fromBpm: 120, toBpm: 100, stepBpm: 7, barsPerStep: 2 });
  assert.deepEqual(down, [
    { fromBpm: 120, toBpm: 113, bars: 2 },
    { fromBpm: 113, toBpm: 106, bars: 2 },
    { fromBpm: 106, toBpm: 100, bars: 2 }
  ]);
  assert.deepEqual(
    tempo.rampSegments({ fromBpm: 90, toBpm: 90, stepBpm: 5, barsPerStep: 4 }),
    [{ fromBpm: 90, toBpm: 90, bars: 4 }]
  );
});

test('rampSegments rejects invalid parameters', () => {
  assert.throws(() => tempo.rampSegments({ fromBpm: 60, toBpm: 70, stepBpm: 0, barsPerStep: 4 }));
  assert.throws(() => tempo.rampSegments({ fromBpm: 60, toBpm: 70, stepBpm: 5, barsPerStep: 0 }));
});

test('pendulumAngle swings between -max and +max', () => {
  assert.equal(tempo.pendulumAngle(0, 14), 14);
  assert.ok(near(tempo.pendulumAngle(0.5, 14), -14));
  assert.ok(near(tempo.pendulumAngle(0.25, 14), 0));
  assert.equal(tempo.pendulumAngle(0), 14); // 默认幅度 / default amplitude
});
