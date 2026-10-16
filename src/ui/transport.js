/**
 * TempoLens · ui/transport.js
 * 传输控制器：节拍调度、音频播放、视觉同步、练习统计、例程推进与复节奏。
 * Transport controller: scheduling, audio playback, visual sync, stats,
 * routine progression and polyrhythm clock.
 *
 * 零依赖 UMD 模块 / Zero-dependency UMD module. 仅浏览器环境。
 */
(function (root, factory) {
  'use strict';
  var TL = root.TempoLens || {};
  var api = factory(TL);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.TempoLens = root.TempoLens || {};
  root.TempoLens.transport = api;
}(typeof self !== 'undefined' ? self : this, function (TL) {
  'use strict';

  var LOOKAHEAD = 0.12; // 秒 / seconds of audio scheduling lead
  var STATS_KEY = 'tempolens.stats.v1';
  var MAX_SESSIONS = 500;

  /** 复节奏时钟 / polyrhythm clock over one cycle */
  function createPolyClock(onClick) {
    var events = [];
    var cursor = 0;
    var cycleStart = 0;
    var cycleMs = 1000;
    return {
      reset: function (ratio, cycleMsValue, startTime) {
        events = TL.polyrhythm.polyEvents({ a: ratio.a, b: ratio.b, cycleMs: cycleMsValue });
        cursor = 0;
        cycleStart = startTime;
        cycleMs = cycleMsValue;
      },
      tick: function (now, lookahead) {
        var until = now + lookahead;
        var out = [];
        var guard = 0;
        while (guard++ < 4096) {
          if (!events.length) { break; }
          var ev = events[cursor];
          var time = cycleStart + ev.time;
          if (time >= until) { break; }
          out.push(ev);
          cursor += 1;
          if (cursor >= events.length) { cursor = 0; cycleStart += cycleMs; }
        }
        return out;
      }
    };
  }

  /**
   * 创建传输控制器 / create the transport controller.
   * @param {object} options
   * @param {object} options.audio       ClickEngine 实例
   * @param {object} options.visualizer  Visualizer 实例
   * @param {function} options.getSettings  读取当前设置
   * @param {function} options.onSettingsChange  设置变更回调（持久化 + UI 同步）
   * @param {function} options.onStateChange    播放状态回调 (running, finished)
   * @param {function} options.onRoutineStep    例程步骤回调 (index, total)
   * @param {function} options.onStatsChange    统计变更回调
   * @param {function} [options.onTap]          Tap 测速结果回调 (bpm|null)
   * @param {object} [options.storage]          可注入存储（测试用）
   */
  function createTransport(options) {
    var audio = options.audio;
    var visualizer = options.visualizer;
    var getSettings = options.getSettings;
    var onSettingsChange = options.onSettingsChange;
    var onStateChange = options.onStateChange || function () {};
    var onRoutineStep = options.onRoutineStep || function () {};
    var onStatsChange = options.onStatsChange || function () {};
    var onTap = options.onTap || function () {};
    var storage = options.storage;

    var scheduler = TL.scheduler.createScheduler({ onClick: handleClick });
    var tapTempo = TL.tapTempo.createTapTempo();
    var polyClock = createPolyClock(handlePolyClick);

    var running = false;
    var rafId = null;
    var session = null;
    var countInRemaining = 0;
    var routine = null;
    var routineIndex = -1;
    var routineStepStart = 0;
    var polyRatio = null;

    // —— 统计持久化 / stats persistence ——

    function loadSessions() {
      if (!storage) { return []; }
      try {
        var raw = storage.getItem(STATS_KEY);
        var list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
      } catch (e) { return []; }
    }

    function persistSession(rec) {
      if (!storage) { return; }
      try {
        var list = loadSessions();
        list.push(rec);
        if (list.length > MAX_SESSIONS) { list = list.slice(list.length - MAX_SESSIONS); }
        storage.setItem(STATS_KEY, JSON.stringify(list));
      } catch (e) { /* 存储不可用时静默失败 / fail silently */ }
    }

    function clearSessions() {
      if (!storage) { return; }
      try { storage.removeItem(STATS_KEY); } catch (e) { /* noop */ }
      onStatsChange();
    }

    // —— 事件处理 / event handlers ——

    function handleClick(ev) {
      audio.play(ev, ev.time);
      visualizer.push(ev);
      if (!session) { return; }
      if (ev.downbeat) {
        if (countInRemaining > 0) {
          countInRemaining -= 1;
          if (countInRemaining === 0 && routine && routineIndex >= 0) {
            // 预备拍结束：例程第一步从下一小节开始 / routine starts after count-in
            routineStepStart = ev.time + TL.tempo.bpmToBeatMs(ev.bpm) * scheduler.getConfig().beatsPerBar;
          }
          return;
        }
        TL.stats.recordBars(session, 1, ev.bpm);
        if (routine && routineIndex >= 0) {
          var elapsed = audio.contextTime() - routineStepStart;
          var res = TL.routine.advanceRoutine(routine, routineIndex, elapsed);
          if (res.done) {
            finishRoutine();
          } else if (res.index !== routineIndex) {
            routineIndex = res.index;
            applyRoutineStep(res.index);
          }
        }
      }
    }

    function handlePolyClick(ev) {
      var cfg = scheduler.getConfig() || { bpm: 100 };
      var pseudo = {
        time: ev.time,
        beat: 0,
        sub: 0,
        bar: 1,
        beatInBar: ev.voice === 'a' ? 1 : 2,
        downbeat: false,
        accent: ev.accent,
        bpm: cfg.bpm,
        subdivision: 'quarter'
      };
      audio.play(pseudo, ev.time);
      visualizer.push(pseudo);
      if (session && ev.voice === 'a' && ev.index === 0) {
        // 复节奏模式按循环累计统计 / count cycles in poly mode
        TL.stats.recordBars(session, 1, cfg.bpm);
      }
    }

    // —— 主循环 / main loop ——

    function loop() {
      if (!running) { return; }
      rafId = requestAnimationFrame(loop);
      var now = audio.contextTime();
      if (polyRatio) {
        var events = polyClock.tick(now, LOOKAHEAD);
        for (var i = 0; i < events.length; i++) { handlePolyClick(events[i]); }
      } else {
        scheduler.tick(now, LOOKAHEAD);
      }
      visualizer.render(now);
    }

    // —— 复节奏 / polyrhythm ——

    function syncPoly(settings) {
      var ratio = null;
      if (settings.polyrhythm) {
        try { ratio = TL.polyrhythm.parsePolyrhythm(settings.polyrhythm); } catch (e) { ratio = null; }
      }
      if (!ratio) {
        polyRatio = null;
        return;
      }
      var bpm = settings.polyBpm || settings.bpm;
      var cycleMs = TL.polyrhythm.defaultCycleMs(ratio.a, ratio.b, bpm);
      polyRatio = ratio;
      polyClock.reset(ratio, cycleMs, audio.contextTime());
    }

    // —— 播放控制 / playback ——

    function start() {
      if (running) { return; }
      var s = getSettings();
      audio.unlock();
      audio.setVolume(s.volume);
      audio.setMuted(s.muted);
      audio.setSound(s.sound);
      visualizer.setConfig(s);
      scheduler.configure({
        bpm: s.bpm,
        beatsPerBar: s.beatsPerBar,
        subdivision: s.subdivision,
        swing: s.swing,
        accentMode: s.accentMode
      });
      syncPoly(s);
      countInRemaining = s.countInBars;
      session = TL.stats.createSession(Date.now());
      scheduler.start(audio.contextTime());
      running = true;
      rafId = requestAnimationFrame(loop);
      onStateChange(true);
    }

    function stop(finished) {
      if (!running) { return; }
      running = false;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      scheduler.stop();
      if (session) {
        TL.stats.closeSession(session, Date.now());
        if (session.bars > 0) { persistSession(session); onStatsChange(); }
        session = null;
      }
      routine = null;
      routineIndex = -1;
      visualizer.clear();
      onStateChange(false, !!finished);
    }

    function toggle() { running ? stop() : start(); }

    function tap(nowMs) {
      var res = tapTempo.tap(nowMs);
      if (res && res.bpm) {
        onSettingsChange({ bpm: res.bpm });
        onTap(res.bpm);
      }
      return res;
    }

    function resetTap() { tapTempo.reset(); }

    // —— 设置同步 / settings sync ——

    function applySettings(s) {
      audio.setVolume(s.volume);
      audio.setMuted(s.muted);
      audio.setSound(s.sound);
      visualizer.setConfig(s);
      if (running) {
        if (!routine || routineIndex < 0) {
          scheduler.configure({
            bpm: s.bpm,
            beatsPerBar: s.beatsPerBar,
            subdivision: s.subdivision,
            swing: s.swing,
            accentMode: s.accentMode
          }, audio.contextTime());
        }
        syncPoly(s);
      }
    }

    // —— 例程 / routine ——

    function applyRoutineStep(index) {
      var step = routine.steps[index];
      onSettingsChange({
        bpm: step.bpm,
        beatsPerBar: step.beatsPerBar,
        subdivision: step.subdivision,
        swing: step.swing
      });
      var s = getSettings();
      scheduler.configure({
        bpm: step.bpm,
        beatsPerBar: step.beatsPerBar,
        subdivision: step.subdivision,
        swing: step.swing,
        accentMode: s.accentMode
      }, audio.contextTime());
      routineStepStart = audio.contextTime();
      onRoutineStep(index, routine.steps.length);
    }

    function startRoutine(routineObj) {
      if (!routineObj || !routineObj.steps || !routineObj.steps.length) { return false; }
      stop();
      routine = routineObj;
      routineIndex = 0;
      start();
      if (!running) { routine = null; routineIndex = -1; return false; }
      applyRoutineStep(0);
      return true;
    }

    function finishRoutine() {
      var total = routine ? routine.steps.length : 0;
      stop(true);
      onRoutineStep(-1, total);
    }

    function stopRoutine() {
      var wasRoutine = routine !== null;
      stop();
      if (wasRoutine) { onRoutineStep(-1, 0); }
    }

    return {
      start: start,
      stop: stop,
      toggle: toggle,
      tap: tap,
      resetTap: resetTap,
      applySettings: applySettings,
      startRoutine: startRoutine,
      stopRoutine: stopRoutine,
      clearSessions: clearSessions,
      loadSessions: loadSessions,
      isRunning: function () { return running; },
      isRoutineRunning: function () { return routine !== null && routineIndex >= 0; },
      currentStep: function () { return routineIndex; },
      /** 当前会话快照（用于实时统计）/ live session snapshot for the stats panel */
      sessionInfo: function () {
        if (!session) { return null; }
        return {
          bars: session.bars,
          bpm: session.bars > 0 ? Math.round(session.bpmWeighted / session.bars) : 0,
          ms: Date.now() - session.startedAt
        };
      }
    };
  }

  return { createTransport: createTransport, STATS_KEY: STATS_KEY };
}));
