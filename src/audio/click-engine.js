/**
 * TempoLens · audio/click-engine.js
 * Web Audio 点击音合成引擎：全部音色由振荡器/噪声实时合成，零音频素材。
 * Web Audio click synthesis engine — every sound is synthesized at runtime,
 * so the app ships zero audio assets.
 *
 * 零依赖 UMD 模块 / Zero-dependency UMD module. 仅浏览器环境可用。
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.TempoLens = root.TempoLens || {};
  root.TempoLens.clickEngine = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** 音色预设 / sound presets */
  var SOUND_PRESETS = {
    click: { accentHz: 1960, normalHz: 1320, subHz: 980, type: 'triangle', decay: 0.035, subGain: 0.45, noise: false },
    wood: { accentHz: 820, normalHz: 640, subHz: 520, type: 'sine', decay: 0.055, subGain: 0.4, noise: true },
    beep: { accentHz: 1318, normalHz: 880, subHz: 659, type: 'sine', decay: 0.06, subGain: 0.38, noise: false }
  };

  function clamp01(v) {
    var n = Number(v);
    if (!isFinite(n) || n < 0) { return 0; }
    if (n > 1) { return 1; }
    return n;
  }

  /**
   * 创建点击引擎 / create the click engine.
   * @param {{AudioContext?: function}} [options] 可注入 AudioContext 便于测试
   */
  function createClickEngine(options) {
    var opts = options || {};
    var Ctx = opts.AudioContext ||
      (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) ||
      null;
    var ctx = null;
    var master = null;
    var noiseBuffer = null;
    var volume = 0.7;
    var muted = false;
    var sound = 'click';

    function ensure() {
      if (ctx || !Ctx) { return ctx; }
      try {
        ctx = new Ctx();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : volume;
        master.connect(ctx.destination);
      } catch (e) {
        ctx = null;
        master = null;
      }
      return ctx;
    }

    /** 在用户手势中调用以解锁音频 / call inside a user gesture to unlock audio */
    function unlock() {
      var c = ensure();
      if (c && c.state === 'suspended' && typeof c.resume === 'function') { c.resume(); }
    }

    function setVolume(v) {
      volume = clamp01(v);
      if (master && !muted) { master.gain.value = volume; }
    }

    function setMuted(m) {
      muted = !!m;
      if (master) { master.gain.value = muted ? 0 : volume; }
    }

    function setSound(name) {
      if (SOUND_PRESETS[name]) { sound = name; }
    }

    function getSound() { return sound; }

    function getNoise(c) {
      if (noiseBuffer) { return noiseBuffer; }
      var len = Math.max(1, Math.floor(c.sampleRate * 0.05));
      noiseBuffer = c.createBuffer(1, len, c.sampleRate);
      var data = noiseBuffer.getChannelData(0);
      for (var i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len); // 衰减噪声 / decaying noise
      }
      return noiseBuffer;
    }

    function blip(c, when, freq, dur, gain, type, useNoise) {
      var env = c.createGain();
      env.gain.setValueAtTime(0.0001, when);
      env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), when + 0.002);
      env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      env.connect(master);
      if (useNoise) {
        var src = c.createBufferSource();
        src.buffer = getNoise(c);
        var bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = freq;
        bp.Q.value = 1.1;
        src.connect(bp);
        bp.connect(env);
        src.start(when);
        src.stop(when + dur + 0.02);
      } else {
        var osc = c.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, when);
        osc.connect(env);
        osc.start(when);
        osc.stop(when + dur + 0.02);
      }
    }

    /**
     * 调度一次点击 / schedule one click.
     * @param {object} event 调度器事件 {time, accent, sub, downbeat}
     * @param {number} [when] 可覆盖的绝对播放时间（AudioContext 时间）
     */
    function play(event, when) {
      var c = ensure();
      if (!c) { return; }
      var t = when === undefined ? Number(event.time) : Number(when);
      if (!isFinite(t)) { return; }
      var preset = SOUND_PRESETS[sound];
      var isSub = event.sub > 0;
      var freq = event.accent ? preset.accentHz : (isSub ? preset.subHz : preset.normalHz);
      var gain = event.accent ? 1 : (isSub ? preset.subGain : 0.72);
      blip(c, t, freq, preset.decay, gain, preset.type, !!preset.noise);
    }

    /** 当前时钟（秒）/ current clock in seconds; falls back to performance time */
    function contextTime() {
      if (ctx) { return ctx.currentTime; }
      if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now() / 1000;
      }
      return Date.now() / 1000;
    }

    return {
      play: play,
      unlock: unlock,
      setVolume: setVolume,
      setMuted: setMuted,
      setSound: setSound,
      getSound: getSound,
      ensure: ensure,
      contextTime: contextTime,
      contextState: function () { return ctx ? ctx.state : 'none'; },
      presets: SOUND_PRESETS
    };
  }

  return { createClickEngine: createClickEngine, SOUND_PRESETS: SOUND_PRESETS };
}));
