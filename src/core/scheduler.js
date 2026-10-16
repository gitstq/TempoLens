/**
 * TempoLens · core/scheduler.js
 * 预调度（look-ahead）节拍引擎：提前一小段时间规划点击事件，
 * 使音频层可以在精确的时间点调度，避免 setInterval 抖动。
 * Look-ahead metronome scheduler: plans clicks slightly ahead of time so the
 * audio layer can schedule them sample-accurately (no setInterval jitter).
 *
 * 零依赖 UMD 模块 / Zero-dependency UMD module. 依赖 core/tempo.js。
 *
 * 核心不变式：cursorTime 始终等于当前网格位置 (beat, sub) 的时钟时间，
 * 即 time(b, s) = cursorTime + (b - beat) * beatMs + subOffset(s) - subOffset(sub)。
 * Invariant: cursorTime is the clock time of the current grid position.
 */
(function (root, factory) {
  'use strict';
  var api = factory(root.TempoLens ? root.TempoLens.tempo : require('./tempo.js'));
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.TempoLens = root.TempoLens || {};
  root.TempoLens.scheduler = api;
}(typeof self !== 'undefined' ? self : this, function (tempo) {
  'use strict';

  var EPS = 1e-6;
  var MAX_EVENTS_PER_PLAN = 200000;
  var ACCENT_MODES = { bar: true, beat: true, none: true };

  function normalizeConfig(config) {
    var beatsPerBar = Math.round(Number(config.beatsPerBar));
    if (!isFinite(beatsPerBar) || beatsPerBar < 1) { beatsPerBar = 4; }
    if (beatsPerBar > 16) { beatsPerBar = 16; }
    var subdivision = config.subdivision || 'quarter';
    tempo.subdivisionSteps(subdivision); // 校验，非法则抛错 / validates, throws on unknown
    var swing = Number(config.swing);
    if (!isFinite(swing) || swing < 0) { swing = 0; }
    if (swing > 1) { swing = 1; }
    var accentMode = config.accentMode || 'bar';
    if (!ACCENT_MODES[accentMode]) { accentMode = 'bar'; }
    return {
      bpm: tempo.clampBpm(config.bpm),
      beatsPerBar: beatsPerBar,
      subdivision: subdivision,
      swing: swing,
      accentMode: accentMode
    };
  }

  /**
   * 规划 [startTime, untilTime) 区间内的点击事件。
   * Plan click events in the half-open interval [startTime, untilTime).
   *
   * @param {object} options
   * @param {number} options.startTime  网格位置 (startBeat, startSub) 对应的时间
   *                                  （而非 (0,0) 的时间 / time of the start position）
   * @param {number} options.untilTime  规划截止时间（不含）
   * @param {number} [options.startBeat=0] 起始全局拍号（0 起）
   * @param {number} [options.startSub=0]  起始拍内细分下标
   * @returns {{events: Array<object>, endBeat: number, endSub: number}}
   * event: {time, beat, sub, bar, beatInBar, downbeat, accent, bpm, subdivision}
   */
  function planClicks(options) {
    var startTime = Number(options.startTime);
    var untilTime = Number(options.untilTime);
    if (!isFinite(startTime) || !isFinite(untilTime)) {
      throw new TypeError('planClicks requires finite startTime and untilTime');
    }
    var cfg = normalizeConfig(options);
    var beatMs = tempo.bpmToBeatMs(cfg.bpm);
    var steps = tempo.subdivisionSteps(cfg.subdivision);

    var beat0 = Math.round(Number(options.startBeat) || 0);
    if (beat0 < 0) { beat0 = 0; }
    var sub0 = Math.round(Number(options.startSub) || 0);
    if (sub0 < 0) { sub0 = 0; }
    if (sub0 >= steps) {
      beat0 += Math.floor(sub0 / steps);
      sub0 = sub0 % steps;
    }
    var baseOffset = tempo.subOffsetMs(sub0, beatMs, cfg.subdivision, cfg.swing);
    var beat = beat0;
    var sub = sub0;

    var events = [];
    while (events.length < MAX_EVENTS_PER_PLAN) {
      var offset = tempo.subOffsetMs(sub, beatMs, cfg.subdivision, cfg.swing);
      var time = startTime + (beat - beat0) * beatMs + (offset - baseOffset);
      if (time >= untilTime - EPS) { break; }
      var bar = Math.floor(beat / cfg.beatsPerBar) + 1;
      var beatInBar = (beat % cfg.beatsPerBar) + 1;
      var downbeat = sub === 0 && beatInBar === 1;
      var accent = cfg.accentMode === 'none'
        ? false
        : cfg.accentMode === 'beat' ? sub === 0 : downbeat;
      events.push({
        time: time,
        beat: beat,
        sub: sub,
        bar: bar,
        beatInBar: beatInBar,
        downbeat: downbeat,
        accent: accent,
        bpm: cfg.bpm,
        subdivision: cfg.subdivision
      });
      sub += 1;
      if (sub >= steps) { sub = 0; beat += 1; }
    }
    return { events: events, endBeat: beat, endSub: sub };
  }

  /**
   * 创建调度器实例 / create a scheduler instance.
   * @param {{onClick: function(object): void}} options 每个就绪事件回调一次
   */
  function createScheduler(options) {
    var onClick = (options && options.onClick) || function () {};
    var cfg = null;
    var running = false;
    var cursorTime = 0; // 当前网格位置 (beat, sub) 的时钟时间
    var beat = 0;
    var sub = 0;

    function currentBeatMs() { return tempo.bpmToBeatMs(cfg.bpm); }

    function currentSubOffset(s) {
      return tempo.subOffsetMs(s, currentBeatMs(), cfg.subdivision, cfg.swing);
    }

    return {
      /** 更新配置；运行中传入 now 时以当前网格位置重新锚定时钟 */
      configure: function (config, now) {
        var next = normalizeConfig(config);
        cfg = next;
        if (running && now !== undefined && isFinite(Number(now))) {
          cursorTime = Number(now); // 当前网格位置对齐到 now
        }
      },
      getConfig: function () {
        return cfg ? {
          bpm: cfg.bpm,
          beatsPerBar: cfg.beatsPerBar,
          subdivision: cfg.subdivision,
          swing: cfg.swing,
          accentMode: cfg.accentMode
        } : null;
      },
      /** 开始播放 / start. now 为当前时钟（如 AudioContext.currentTime） */
      start: function (now, config) {
        if (config) { this.configure(config); }
        if (!cfg) { throw new Error('Scheduler is not configured'); }
        beat = 0;
        sub = 0;
        cursorTime = Number(now);
        running = true;
      },
      stop: function () {
        running = false;
      },
      isRunning: function () { return running; },
      position: function () {
        return { beat: beat, sub: sub, time: cursorTime };
      },
      /**
       * 推进调度：规划 [cursor, now + lookaheadMs) 内的事件并回调。
       * Advance the scheduler; fires onClick once per due event.
       * @param {number} now 当前时钟
       * @param {number} lookaheadMs 提前量（毫秒）
       * @returns {Array<object>} 本次触发的事件
       */
      tick: function (now, lookaheadMs) {
        if (!running || !cfg) { return []; }
        var nowMs = Number(now);
        if (!isFinite(nowMs)) { return []; }
        var beatMs = currentBeatMs();

        // 落后过多（如后台标签页被降频）时丢弃积压，保持当前网格位置
        // If we fell far behind (e.g. throttled background tab), drop the backlog.
        if (nowMs > cursorTime + 250) { cursorTime = nowMs; }

        var until = nowMs + (Number(lookaheadMs) || 0);
        var plan = planClicks({
          startTime: cursorTime,
          untilTime: until,
          bpm: cfg.bpm,
          beatsPerBar: cfg.beatsPerBar,
          subdivision: cfg.subdivision,
          swing: cfg.swing,
          accentMode: cfg.accentMode,
          startBeat: beat,
          startSub: sub
        });

        var newCursor = cursorTime +
          (plan.endBeat - beat) * beatMs +
          (currentSubOffset(plan.endSub) - currentSubOffset(sub));
        beat = plan.endBeat;
        sub = plan.endSub;
        cursorTime = newCursor;

        for (var i = 0; i < plan.events.length; i++) { onClick(plan.events[i]); }
        return plan.events;
      }
    };
  }

  return { planClicks: planClicks, createScheduler: createScheduler, normalizeConfig: normalizeConfig };
}));
