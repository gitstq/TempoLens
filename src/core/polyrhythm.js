/**
 * TempoLens · core/polyrhythm.js
 * 复节奏（Polyrhythm）网格：两个声部以不同密度叠加，如 3:2、4:3。
 * Polyrhythm grid: two voices at different densities, e.g. 3:2, 4:3.
 *
 * 零依赖 UMD 模块 / Zero-dependency UMD module.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.TempoLens = root.TempoLens || {};
  root.TempoLens.polyrhythm = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIN_VOICE = 2;
  var MAX_VOICE = 12;

  function gcd(a, b) {
    var x = Math.abs(a);
    var y = Math.abs(b);
    while (y) { var t = y; y = x % y; x = t; }
    return x;
  }

  function lcm(a, b) {
    return Math.abs(a * b) / gcd(a, b);
  }

  /**
   * 解析复节奏谱面 / parse a polyrhythm spec.
   * 支持 "3:2"、"3x2"、"3/2" / accepts ':', 'x' or '/' separators.
   * @returns {{a: number, b: number}}
   */
  function parsePolyrhythm(spec) {
    if (typeof spec !== 'string') {
      throw new TypeError('polyrhythm spec must be a string like "3:2"');
    }
    var m = spec.trim().match(/^(\d+)\s*[:x\/]\s*(\d+)$/);
    if (!m) { throw new Error('Invalid polyrhythm: ' + spec); }
    var a = parseInt(m[1], 10);
    var b = parseInt(m[2], 10);
    if (a < MIN_VOICE || a > MAX_VOICE || b < MIN_VOICE || b > MAX_VOICE) {
      throw new RangeError('Polyrhythm voices must be between ' + MIN_VOICE + ' and ' + MAX_VOICE);
    }
    if (a === b) { throw new Error('Polyrhythm voices must differ'); }
    return { a: a, b: b };
  }

  /** 一个完整循环包含的拍数 / beats in one full cycle */
  function cycleBeats(a, b) {
    return lcm(a, b);
  }

  /** 默认循环时长（毫秒）/ default cycle length in ms */
  function defaultCycleMs(a, b, bpm) {
    var tempoValue = Number(bpm);
    if (!isFinite(tempoValue) || tempoValue <= 0) { throw new RangeError('bpm must be positive'); }
    return cycleBeats(a, b) * (60000 / tempoValue);
  }

  /**
   * 生成一个循环内的复节奏事件。
   * Generate the merged click events for one polyrhythm cycle.
   * @param {{a:number, b:number, cycleMs:number, accent?:boolean}} options
   * @returns {Array<{time:number, voice:string, index:number, accent:boolean}>}
   *   按时间排序，同刻事件 voice 'a' 在前 / sorted by time, 'a' first on ties.
   */
  function polyEvents(options) {
    var a = Math.round(Number(options.a));
    var b = Math.round(Number(options.b));
    var cycleMs = Number(options.cycleMs);
    if (!isFinite(a) || a < MIN_VOICE || a > MAX_VOICE) { throw new RangeError('voice a out of range'); }
    if (!isFinite(b) || b < MIN_VOICE || b > MAX_VOICE) { throw new RangeError('voice b out of range'); }
    if (a === b) { throw new Error('Polyrhythm voices must differ'); }
    if (!isFinite(cycleMs) || cycleMs <= 0) { throw new RangeError('cycleMs must be positive'); }
    var accent = options.accent !== false;

    var events = [];
    var i;
    for (i = 0; i < a; i++) {
      events.push({ time: (i * cycleMs) / a, voice: 'a', index: i, accent: accent && i === 0 });
    }
    for (i = 0; i < b; i++) {
      events.push({ time: (i * cycleMs) / b, voice: 'b', index: i, accent: accent && i === 0 });
    }
    events.sort(function (x, y) {
      if (x.time < y.time) { return -1; }
      if (x.time > y.time) { return 1; }
      return x.voice < y.voice ? -1 : x.voice > y.voice ? 1 : 0;
    });
    return events;
  }

  return {
    MIN_VOICE: MIN_VOICE,
    MAX_VOICE: MAX_VOICE,
    gcd: gcd,
    lcm: lcm,
    parsePolyrhythm: parsePolyrhythm,
    cycleBeats: cycleBeats,
    defaultCycleMs: defaultCycleMs,
    polyEvents: polyEvents
  };
}));
