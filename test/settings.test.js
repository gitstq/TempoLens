'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const settings = require('../src/core/settings.js');

function memoryStorage() {
  const map = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); },
    removeItem: (k) => { delete map[k]; }
  };
}

test('defaults are valid', () => {
  assert.deepEqual(settings.validateSettings(settings.DEFAULTS), []);
});

test('sanitize clamps out-of-range values', () => {
  const s = settings.sanitizeSettings({
    bpm: 9999, swing: 5, volume: -2, subdivision: 'nope', lang: 'fr', theme: 'x', countInBars: 7
  });
  assert.equal(s.bpm, 300);
  assert.equal(s.swing, 1);
  assert.equal(s.volume, 0);
  assert.equal(s.subdivision, 'quarter');
  assert.equal(s.lang, 'auto');
  assert.equal(s.theme, 'auto');
  assert.equal(s.countInBars, 0);
  assert.deepEqual(settings.validateSettings(s), []);
});

test('sanitize drops an invalid polyrhythm but keeps a valid one', () => {
  assert.equal(settings.sanitizeSettings({ polyrhythm: '9:9' }).polyrhythm, null);
  assert.equal(settings.sanitizeSettings({ polyrhythm: '3:2' }).polyrhythm, '3:2');
  assert.equal(settings.sanitizeSettings({ polyBpm: 999 }).polyBpm, null);
  assert.equal(settings.sanitizeSettings({ polyBpm: 90 }).polyBpm, 90);
});

test('encode/decode round trip is URL-safe', () => {
  const s = settings.sanitizeSettings({ bpm: 137, subdivision: 'triplet', swing: 0.42, polyrhythm: '4:3' });
  const code = settings.encodeSettings(s);
  assert.ok(/^[A-Za-z0-9\-_]+$/.test(code));
  const back = settings.decodeSettings(code);
  assert.equal(back.bpm, 137);
  assert.equal(back.subdivision, 'triplet');
  assert.ok(Math.abs(back.swing - 0.42) < 1e-9);
  assert.equal(back.polyrhythm, '4:3');
});

test('decodeSettings returns null for garbage', () => {
  assert.equal(settings.decodeSettings('!!!not-base64!!!'), null);
  assert.equal(settings.decodeSettings(''), null);
  assert.equal(settings.decodeSettings(undefined), null);
});

test('load/save round trip through storage', () => {
  const store = memoryStorage();
  const saved = settings.sanitizeSettings({ bpm: 90, sound: 'wood' });
  assert.equal(settings.saveSettings(store, saved), true);
  const loaded = settings.loadSettings(store);
  assert.equal(loaded.bpm, 90);
  assert.equal(loaded.sound, 'wood');
});

test('load falls back to defaults on corrupt data or missing storage', () => {
  const store = memoryStorage();
  store.setItem(settings.STORAGE_KEY, '{corrupt');
  assert.equal(settings.loadSettings(store).bpm, settings.DEFAULTS.bpm);
  assert.equal(settings.loadSettings(null).bpm, settings.DEFAULTS.bpm);
  assert.equal(settings.saveSettings(null, settings.DEFAULTS), false);
});
