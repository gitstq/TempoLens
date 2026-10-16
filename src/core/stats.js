/**
 * TempoLens · core/stats.js
 * 练习统计：会话累计、按日聚合、连续打卡（streak）与热力图。
 * Practice stats: session accumulation, daily aggregation, streaks, heatmap.
 *
 * 零依赖 UMD 模块 / Zero-dependency UMD module.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.TempoLens = root.TempoLens || {};
  root.TempoLens.stats = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  /** 本地时区日期键 'YYYY-MM-DD' / local date key */
  function dateKey(ts) {
    var d = ts instanceof Date ? ts : new Date(ts);
    if (isNaN(d.getTime())) { throw new RangeError('invalid date'); }
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function keyToDate(key) {
    var m = String(key).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) { throw new Error('invalid date key: ' + key); }
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function nextDayKey(key) {
    var d = keyToDate(key);
    d.setDate(d.getDate() + 1);
    return dateKey(d);
  }

  /** 新建会话 / create a session record */
  function createSession(startedAt) {
    var start = Number(startedAt);
    if (!isFinite(start)) { throw new TypeError('startedAt must be a finite timestamp'); }
    return { startedAt: start, endedAt: null, bars: 0, bpmWeighted: 0 };
  }

  /** 累计小节与加权速度 / accumulate bars and weighted tempo */
  function recordBars(session, bars, bpm) {
    var b = Math.round(Number(bars));
    var v = Number(bpm);
    if (!isFinite(b) || b <= 0) { throw new RangeError('bars must be a positive integer'); }
    if (!isFinite(v) || v <= 0) { throw new RangeError('bpm must be positive'); }
    session.bars += b;
    session.bpmWeighted += b * v;
    return session;
  }

  function closeSession(session, endedAt) {
    session.endedAt = Number(endedAt);
    return session;
  }

  function sessionMs(session) {
    if (session.endedAt === null || session.endedAt === undefined) { return 0; }
    return Math.max(0, session.endedAt - session.startedAt);
  }

  /** 按日聚合小节数 / aggregate bars per day key */
  function dayBars(sessions) {
    var map = {};
    (sessions || []).forEach(function (s) {
      var key = dateKey(s.startedAt);
      map[key] = (map[key] || 0) + (s.bars || 0);
    });
    return map;
  }

  /** 有练习的日期（升序）/ active day keys, ascending */
  function activeDays(sessions) {
    return Object.keys(dayBars(sessions)).filter(function (k) { return dayBars(sessions)[k] > 0; }).sort();
  }

  /**
   * 连续打卡统计 / streak statistics.
   * 当前连续从今天（或昨天，若今天尚未练习）向前数。
   * Current streak counts back from today, or from yesterday if today has no practice yet.
   * @param {string} todayKey 'YYYY-MM-DD'
   * @returns {{current: number, longest: number}}
   */
  function streakInfo(sessions, todayKey) {
    var bars = dayBars(sessions);
    var days = Object.keys(bars).filter(function (k) { return bars[k] > 0; }).sort();
    if (!days.length) { return { current: 0, longest: 0 }; }

    var longest = 1;
    var run = 1;
    for (var i = 1; i < days.length; i++) {
      if (nextDayKey(days[i - 1]) === days[i]) { run += 1; } else { run = 1; }
      if (run > longest) { longest = run; }
    }

    var current = 0;
    var cursor = bars[todayKey] > 0 ? todayKey : null;
    if (!cursor) {
      // 今天没练习：若昨天有，则连续记录到昨天
      var d = keyToDate(todayKey);
      d.setDate(d.getDate() - 1);
      var y = dateKey(d);
      if (bars[y] > 0) { cursor = y; }
    }
    while (cursor && bars[cursor] > 0) {
      current += 1;
      var prev = keyToDate(cursor);
      prev.setDate(prev.getDate() - 1);
      cursor = dateKey(prev);
    }
    return { current: current, longest: longest };
  }

  /** 汇总 / summary across sessions */
  function summarize(sessions) {
    var list = sessions || [];
    var totalBars = 0;
    var totalMs = 0;
    var weighted = 0;
    list.forEach(function (s) {
      totalBars += s.bars || 0;
      totalMs += sessionMs(s);
      weighted += s.bpmWeighted || 0;
    });
    var days = activeDays(list);
    return {
      sessions: list.length,
      totalBars: totalBars,
      totalMs: totalMs,
      avgBpm: totalBars > 0 ? Math.round(weighted / totalBars) : 0,
      activeDays: days.length,
      lastActiveDay: days.length ? days[days.length - 1] : null
    };
  }

  /**
   * 热力图数据 / heatmap data ending at todayKey.
   * @param {number} [days=56] 天数（建议 7 的倍数）/ number of days (multiple of 7 recommended)
   * @returns {Array<{date:string, bars:number, level:number}>} level 0..4
   */
  function heatmap(sessions, options) {
    var opts = options || {};
    var todayKey = opts.todayKey || dateKey(Date.now());
    var days = Math.round(Number(opts.days) || 56);
    if (days < 7) { days = 7; }
    if (days > 371) { days = 371; }
    var bars = dayBars(sessions);
    var max = 0;
    Object.keys(bars).forEach(function (k) { if (bars[k] > max) { max = bars[k]; } });

    var result = [];
    var cursor = keyToDate(todayKey);
    cursor.setDate(cursor.getDate() - (days - 1));
    for (var i = 0; i < days; i++) {
      var key = dateKey(cursor);
      var value = bars[key] || 0;
      var level = 0;
      if (value > 0) {
        var ratio = max > 0 ? value / max : 1;
        level = ratio >= 0.75 ? 4 : ratio >= 0.5 ? 3 : ratio >= 0.25 ? 2 : 1;
      }
      result.push({ date: key, bars: value, level: level });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }

  /** 格式化时长为 "1h 05m" / format duration */
  function formatDuration(ms) {
    var totalMin = Math.floor(Math.max(0, ms) / 60000);
    var h = Math.floor(totalMin / 60);
    var m = totalMin % 60;
    if (h > 0) { return h + 'h ' + pad2(m) + 'm'; }
    return m + 'm';
  }

  return {
    dateKey: dateKey,
    keyToDate: keyToDate,
    nextDayKey: nextDayKey,
    createSession: createSession,
    recordBars: recordBars,
    closeSession: closeSession,
    sessionMs: sessionMs,
    dayBars: dayBars,
    activeDays: activeDays,
    streakInfo: streakInfo,
    summarize: summarize,
    heatmap: heatmap,
    formatDuration: formatDuration
  };
}));
