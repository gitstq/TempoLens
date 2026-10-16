/**
 * TempoLens · core/tap-tempo.js
 * 智能 Tap Tempo：带离群值拒绝与间隔超时重置的均值估计。
 * Smart tap tempo with outlier rejection and gap-based reset.
 *
 * 零依赖 UMD 模块 / Zero-dependency UMD module.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.TempoLens = root.TempoLens || {};
  root.TempoLens.tapTempo = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULTS = {
    maxTaps: 8,        // 参与平均的最大样本数 / max samples kept for the average
    resetGapMs: 2500,  // 超过该间隔未敲击则重新开始 / gap that starts a new group
    outlierRatio: 0.35,// 与中位数偏差超过该比例视为离群值 / outlier threshold vs median
    minBpm: 20,
    maxBpm: 300
  };

  function median(values) {
    if (!values.length) { return 0; }
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function mean(values) {
    if (!values.length) { return 0; }
    var sum = 0;
    for (var i = 0; i < values.length; i++) { sum += values[i]; }
    return sum / values.length;
  }

  /**
   * 创建 Tap Temo 实例 / create a tap-tempo instance.
   * @returns {{tap: function(number): ?{bpm:number, samples:number},
   *            bpm: function(): ?number, reset: function(): void, samples: number}}
   */
  function createTapTempo(options) {
    var opts = {};
    var key;
    for (key in DEFAULTS) { if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) { opts[key] = DEFAULTS[key]; } }
    if (options) {
      for (key in options) {
        if (options[key] !== undefined && Object.prototype.hasOwnProperty.call(options, key)) { opts[key] = options[key]; }
      }
    }

    var intervals = [];
    var lastTap = null;

    function estimate() {
      if (!intervals.length) { return null; }
      var value = 60000 / mean(intervals);
      if (value < opts.minBpm || value > opts.maxBpm) { return null; }
      return Math.round(value);
    }

    function reset() {
      intervals = [];
      lastTap = null;
    }

    /**
     * 记录一次敲击 / register one tap.
     * @param {number} nowMs 单调时钟（毫秒）/ monotonic clock in ms
     * @returns {?{bpm:number, samples:number}} 首次敲击返回 null
     */
    function tap(nowMs) {
      var now = Number(nowMs);
      if (!isFinite(now)) { throw new TypeError('tap(nowMs) requires a finite number'); }
      if (lastTap === null || now - lastTap > opts.resetGapMs) {
        intervals = [];
        lastTap = now;
        return null;
      }
      var interval = now - lastTap;
      lastTap = now;
      if (interval <= 0) { return estimate() ? { bpm: estimate(), samples: intervals.length } : null; }
      if (intervals.length >= 2) {
        var med = median(intervals);
        if (med > 0 && Math.abs(interval - med) > opts.outlierRatio * med) {
          var kept = estimate();
          return kept === null ? null : { bpm: kept, samples: intervals.length };
        }
      }
      intervals.push(interval);
      if (intervals.length > opts.maxTaps) { intervals.shift(); }
      var bpm = estimate();
      return bpm === null ? null : { bpm: bpm, samples: intervals.length };
    }

    return {
      tap: tap,
      bpm: estimate,
      reset: reset,
      samples: function () { return intervals.length; }
    };
  }

  return { createTapTempo: createTapTempo, median: median, mean: mean, DEFAULTS: DEFAULTS };
}));
