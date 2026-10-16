'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const stats = require('../src/core/stats.js');

const day = (offset) => new Date(2026, 4, 10 + offset, 12, 0, 0); // 2026-05-10 起
const mk = (date, bars, bpm) => ({
  startedAt: date.getTime(),
  endedAt: date.getTime() + 60000,
  bars: bars,
  bpmWeighted: bars * (bpm || 100)
});

test('dateKey formats local dates', () => {
  assert.equal(stats.dateKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(stats.dateKey(new Date(2026, 11, 31, 0, 0)), '2026-12-31');
});

test('sessions accumulate bars and weighted tempo', () => {
  const s = stats.createSession(1000);
  stats.recordBars(s, 4, 120);
  stats.recordBars(s, 4, 100);
  assert.equal(s.bars, 8);
  stats.closeSession(s, 5000);
  assert.equal(stats.sessionMs(s), 4000);
  const sum = stats.summarize([s]);
  assert.equal(sum.totalBars, 8);
  assert.equal(sum.totalMs, 4000);
  assert.equal(sum.avgBpm, 110); // (4*120 + 4*100) / 8
  assert.equal(sum.activeDays, 1);
});

test('recordBars validates input', () => {
  const s = stats.createSession(0);
  assert.throws(() => stats.recordBars(s, 0, 100));
  assert.throws(() => stats.recordBars(s, 4, -1));
});

test('streaks count consecutive practice days', () => {
  const sessions = [mk(day(0), 4), mk(day(1), 4), mk(day(2), 4), mk(day(4), 4), mk(day(5), 4)];
  const info = stats.streakInfo(sessions, stats.dateKey(day(5)));
  assert.equal(info.current, 2);  // 05-15, 05-14
  assert.equal(info.longest, 3);  // 05-10..05-12
});

test('current streak survives a rest day when yesterday was practiced', () => {
  const sessions = [mk(day(0), 2), mk(day(1), 2)];
  assert.equal(stats.streakInfo(sessions, stats.dateKey(day(2))).current, 2);
  assert.equal(stats.streakInfo(sessions, stats.dateKey(day(5))).current, 0);
});

test('empty stats report zero streaks', () => {
  assert.deepEqual(stats.streakInfo([], stats.dateKey(day(0))), { current: 0, longest: 0 });
});

test('heatmap produces one cell per day with levels', () => {
  const sessions = [mk(day(0), 10), mk(day(1), 5), mk(day(2), 1)];
  const cells = stats.heatmap(sessions, { days: 7, todayKey: stats.dateKey(day(6)) });
  assert.equal(cells.length, 7);
  assert.equal(cells[0].bars, 10);
  assert.equal(cells[0].level, 4); // 最大值 / max
  assert.equal(cells[1].level, 3); // 50%
  assert.equal(cells[2].level, 1); // 10%
  assert.equal(cells[6].bars, 0);
  assert.equal(cells[6].level, 0);
});

test('formatDuration renders hours and minutes', () => {
  assert.equal(stats.formatDuration(0), '0m');
  assert.equal(stats.formatDuration(90 * 1000), '1m');
  assert.equal(stats.formatDuration(59 * 60 * 1000), '59m');
  assert.equal(stats.formatDuration(65 * 60 * 1000), '1h 05m');
});
