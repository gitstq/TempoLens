/**
 * TempoLens · core/tempo.js
 * 速度与时间数学：BPM 换算、音符细分、摇摆偏移、速度阶梯。
 * Tempo & timing math: BPM conversion, subdivisions, swing offsets, tempo ramps.
 *
 * 零依赖 UMD 模块：既可在浏览器以 <script> 挂载到 window.TempoLens.tempo，
 * 也可在 Node 中 require() 供单元测试使用。Zero-dependency UMD module.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.TempoLens = root.TempoLens || {};
  root.TempoLens.tempo = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIN_BPM = 20;
  var MAX_BPM = 300;

  /** 细分名 -> 每拍点击次数 / subdivision name -> clicks per beat */
  var SUBDIVISIONS = {
    quarter: 1,
    eighth: 2,
    triplet: 3,
    sixteenth: 4
  };

  var SUBDIVISION_KEYS = Object.keys(SUBDIVISIONS);

  /** 口癖计数标签 / counting labels shown on the visualizer */
  var COUNT_LABELS = {
    quarter: ['1'],
    eighth: ['1', '&'],
    triplet: ['1', 'la', 'li'],
    sixteenth: ['1', 'e', '&', 'a']
  };

  function clampBpm(bpm) {
    var n = Math.round(Number(bpm));
    if (!isFinite(n)) { return 100; }
    if (n < MIN_BPM) { return MIN_BPM; }
    if (n > MAX_BPM) { return MAX_BPM; }
    return n;
  }

  /** 每拍毫秒数 / milliseconds per beat */
  function bpmToBeatMs(bpm) {
    return 60000 / clampBpm(bpm);
  }

  function subdivisionSteps(subdivision) {
    var steps = SUBDIVISIONS[subdivision];
    if (!steps) { throw new Error('Unknown subdivision: ' + subdivision); }
    return steps;
  }

  /** 单个细分步长（毫秒）/ step length in ms */
  function stepMs(beatMs, subdivision) {
    return beatMs / subdivisionSteps(subdivision);
  }

  /**
   * 细分下标在一拍内的偏移（毫秒），偶数细分时对反拍施加摇摆位移。
   * Offset (ms from beat start) of a subdivision index, with swing shift
   * applied to off-beats of even subdivisions.
   * @param {number} subIndex 0-based index inside the beat
   * @param {number} beatMs   length of one beat in ms
   * @param {string} subdivision 'quarter' | 'eighth' | 'triplet' | 'sixteenth'
   * @param {number} swing    0..1（1 = 精确三连音摇摆感 / exact triplet feel）
   */
  function subOffsetMs(subIndex, beatMs, subdivision, swing) {
    var steps = subdivisionSteps(subdivision);
    var s = Math.round(Number(subIndex)) % steps;
    if (s < 0) { s += steps; }
    var offset = s * (beatMs / steps);
    var sw = Number(swing);
    if (!isFinite(sw) || sw <= 0) { return offset; }
    if (sw > 1) { sw = 1; }
    if (steps % 2 === 0 && s % 2 === 1) {
      offset += (sw * beatMs) / 6;
    }
    return offset;
  }

  /** 口癖计数标签 / counting label for a subdivision index */
  function countLabel(subIndex, subdivision) {
    var labels = COUNT_LABELS[subdivision];
    if (!labels) { throw new Error('Unknown subdivision: ' + subdivision); }
    var s = Math.round(Number(subIndex)) % labels.length;
    if (s < 0) { s += labels.length; }
    return labels[s];
  }

  /**
   * 生成速度阶梯（渐进提速/降速练习）。
   * Build tempo ramp segments for gradual speed-up / slow-down practice.
   * @param {{fromBpm:number, toBpm:number, stepBpm:number, barsPerStep:number}} opts
   * @returns {Array<{fromBpm:number, toBpm:number, bars:number}>}
   */
  function rampSegments(opts) {
    var fromBpm = clampBpm(opts.fromBpm);
    var toBpm = clampBpm(opts.toBpm);
    var stepBpm = Math.abs(Math.round(Number(opts.stepBpm)));
    var bars = Math.round(Number(opts.barsPerStep));
    if (!stepBpm || stepBpm < 1) { throw new Error('stepBpm must be an integer >= 1'); }
    if (!bars || bars < 1) { throw new Error('barsPerStep must be an integer >= 1'); }
    if (fromBpm === toBpm) {
      return [{ fromBpm: fromBpm, toBpm: fromBpm, bars: bars }];
    }
    var dir = toBpm > fromBpm ? 1 : -1;
    var segments = [];
    var current = fromBpm;
    while (current !== toBpm) {
      var next = current + dir * stepBpm;
      if ((dir > 0 && next > toBpm) || (dir < 0 && next < toBpm)) { next = toBpm; }
      segments.push({ fromBpm: current, toBpm: next, bars: bars });
      current = next;
    }
    return segments;
  }

  /** 摆锤相位 -> 角度（度），供视觉层使用 / pendulum phase to angle in degrees */
  function pendulumAngle(phase, maxAngle) {
    var max = typeof maxAngle === 'number' ? maxAngle : 14;
    var p = Number(phase) || 0;
    return max * Math.cos(2 * Math.PI * p);
  }

  return {
    MIN_BPM: MIN_BPM,
    MAX_BPM: MAX_BPM,
    SUBDIVISIONS: SUBDIVISIONS,
    SUBDIVISION_KEYS: SUBDIVISION_KEYS,
    COUNT_LABELS: COUNT_LABELS,
    clampBpm: clampBpm,
    bpmToBeatMs: bpmToBeatMs,
    subdivisionSteps: subdivisionSteps,
    stepMs: stepMs,
    subOffsetMs: subOffsetMs,
    countLabel: countLabel,
    rampSegments: rampSegments,
    pendulumAngle: pendulumAngle
  };
}));
