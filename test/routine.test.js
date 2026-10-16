'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const routine = require('../src/core/routine.js');

test('validateStep accepts and normalizes valid steps', () => {
  const res = routine.validateStep({ bpm: 120, bars: 4, beatsPerBar: 4, subdivision: 'eighth', swing: 0.5 });
  assert.equal(res.ok, true);
  assert.equal(res.step.bpm, 120);
  assert.equal(res.step.subdivision, 'eighth');
  assert.equal(typeof res.step.id, 'string');
});

test('validateStep rejects out-of-range values', () => {
  assert.equal(routine.validateStep({ bpm: 5 }).ok, false);
  assert.equal(routine.validateStep({ bpm: 400, bars: 4 }).ok, false);
  assert.equal(routine.validateStep({ bpm: 100, bars: 0 }).ok, false);
  assert.equal(routine.validateStep({ bpm: 100, bars: 4, subdivision: 'nope' }).ok, false);
  assert.equal(routine.validateStep({ bpm: 100, bars: 4, swing: 2 }).ok, false);
  assert.equal(routine.validateStep(null).ok, false);
});

test('stepDurationMs and routineDurationMs', () => {
  const step = { bpm: 120, bars: 4, beatsPerBar: 4 }; // 16 beats x 500ms = 8000ms
  assert.equal(routine.stepDurationMs(step), 8000);
  assert.equal(routine.routineDurationMs({ steps: [step, step] }), 16000);
  assert.equal(routine.routineDurationMs({ steps: [] }), 0);
});

test('tempoLadder generates steps from a ramp', () => {
  const steps = routine.tempoLadder({
    fromBpm: 60, toBpm: 70, stepBpm: 5, barsPerStep: 4,
    beatsPerBar: 4, subdivision: 'quarter'
  });
  assert.equal(steps.length, 2);
  assert.deepEqual(steps.map((s) => s.bpm), [65, 70]);
  assert.equal(steps[0].bars, 4);
  assert.equal(steps[0].beatsPerBar, 4);
  assert.throws(() => routine.tempoLadder({ fromBpm: 60, toBpm: 70, stepBpm: 0, barsPerStep: 4 }));
});

test('serialize/parse round trip preserves the routine', () => {
  const r = {
    name: 'Morning Practice',
    steps: [{ bpm: 80, bars: 4, beatsPerBar: 4, subdivision: 'quarter', swing: 0 }]
  };
  const json = routine.serializeRoutine(r, true);
  const parsed = routine.parseRoutine(json);
  assert.equal(parsed.name, 'Morning Practice');
  assert.equal(parsed.steps.length, 1);
  assert.equal(parsed.steps[0].bpm, 80);
});

test('parseRoutine rejects malformed input', () => {
  assert.throws(() => routine.parseRoutine('{not json'));
  assert.throws(() => routine.parseRoutine(JSON.stringify({ name: '', steps: [] })));
  assert.throws(() => routine.parseRoutine(JSON.stringify({ name: 'x', steps: [{ bpm: 1, bars: 4 }] })));
});

test('advanceRoutine moves between steps and finishes', () => {
  const r = {
    name: 'x',
    steps: [
      { bpm: 120, bars: 1, beatsPerBar: 4 }, // 2000ms
      { bpm: 120, bars: 1, beatsPerBar: 4 }  // 2000ms
    ]
  };
  assert.deepEqual(routine.advanceRoutine(r, 0, 1000), { index: 0, done: false });
  assert.deepEqual(routine.advanceRoutine(r, 0, 2000), { index: 1, done: false });
  assert.deepEqual(routine.advanceRoutine(r, 1, 2000), { index: -1, done: true });
  assert.throws(() => routine.advanceRoutine(r, 5, 0));
  assert.throws(() => routine.advanceRoutine({ name: 'x', steps: [] }, 0, 0));
});
