/**
 * TempoLens · ui/visualizer.js
 * 视觉指示层：节拍点、摆锤、小节/细分读数、细分口癖标签。
 * Visual indicator: beat dots, pendulum, bar/subdivision readout.
 *
 * 零依赖 UMD 模块 / Zero-dependency UMD module.
 * 浏览器依赖 window.TempoLens 命名空间（dom/tempo/icons）。
 */
(function (root, factory) {
  'use strict';
  var TL = root.TempoLens || {};
  var api = factory(TL);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.TempoLens = root.TempoLens || {};
  root.TempoLens.visualizer = api;
}(typeof self !== 'undefined' ? self : this, function (TL) {
  'use strict';

  var tempo = TL.tempo || (typeof require === 'function' ? require('../core/tempo.js') : null);
  var dom = TL.dom || (typeof require === 'function' ? require('./dom.js') : null);

  /**
   * 创建视觉指示器 / create the visualizer.
   * @param {{root: HTMLElement}} options
   */
  function createVisualizer(options) {
    var root = options.root;
    var el = dom.el;

    // —— DOM 结构 / DOM scaffold ——
    var pendulum = el('div', { class: 'viz-pendulum' }, [
      el('div', { class: 'viz-pendulum-arm' }, [el('div', { class: 'viz-pendulum-bob' })]),
      el('div', { class: 'viz-pendulum-base' })
    ]);
    var dotsWrap = el('div', { class: 'viz-dots', role: 'list' });
    var barReadout = el('div', { class: 'viz-readout' }, [
      el('span', { class: 'viz-bar', text: '1' }),
      el('span', { class: 'viz-sep', text: '.' }),
      el('span', { class: 'viz-beat', text: '1' }),
      el('span', { class: 'viz-sub', text: '' })
    ]);
    var statusLine = el('div', { class: 'viz-status', text: '' });

    root.appendChild(pendulum);
    root.appendChild(dotsWrap);
    root.appendChild(barReadout);
    root.appendChild(statusLine);

    var dots = [];
    var cfg = { beatsPerBar: 4, subdivision: 'quarter' };
    var queue = [];           // 待渲染事件 / pending events
    var lastBeatEvent = null; // 最近一个拍点（sub=0）事件
    var reducedMotion = false;

    try {
      reducedMotion = typeof window !== 'undefined' && window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { reducedMotion = false; }

    function buildDots() {
      dom.clear(dotsWrap);
      dots = [];
      for (var i = 0; i < cfg.beatsPerBar; i++) {
        var dot = el('span', { class: 'viz-dot', dataset: { beat: String(i + 1) }, role: 'listitem' });
        dots.push(dot);
        dotsWrap.appendChild(dot);
      }
    }

    function setConfig(next) {
      var changed = !cfg || cfg.beatsPerBar !== next.beatsPerBar || cfg.subdivision !== next.subdivision;
      cfg = { beatsPerBar: next.beatsPerBar || 4, subdivision: next.subdivision || 'quarter' };
      if (changed) { buildDots(); }
    }

    /** 入队一个调度事件 / enqueue a scheduler event */
    function push(event) {
      queue.push(event);
      if (queue.length > 64) { queue.splice(0, queue.length - 64); }
    }

    function clearIndicators() {
      queue.length = 0;
      lastBeatEvent = null;
      dots.forEach(function (dot) { dot.classList.remove('is-active', 'is-accent'); });
      pendulum.style.transform = 'rotate(0deg)';
      setReadout(1, 1, '');
      statusLine.textContent = '';
    }

    function setReadout(bar, beat, subLabel) {
      var barEl = root.querySelector('.viz-bar');
      var beatEl = root.querySelector('.viz-beat');
      var subEl = root.querySelector('.viz-sub');
      if (barEl) { barEl.textContent = String(bar); }
      if (beatEl) { beatEl.textContent = String(beat); }
      if (subEl) { subEl.textContent = subLabel || ''; }
    }

    /**
     * 每帧调用 / call once per animation frame.
     * @param {number} now 当前时钟（与事件 time 同一时间基）
     */
    function render(now) {
      // 1) 消费到点事件 / consume due events
      while (queue.length && queue[0].time <= now + 1) {
        var ev = queue.shift();
        dots.forEach(function (d) { d.classList.remove('is-active', 'is-accent'); });
        var dot = dots[ev.beatInBar - 1];
        if (dot) {
          dot.classList.add('is-active');
          if (ev.accent) { dom.pulse(dot, 'is-accent', 200); }
        }
        setReadout(ev.bar, ev.beatInBar, ev.sub > 0 ? tempo.countLabel(ev.sub, ev.subdivision) : '');
        if (ev.sub === 0) { lastBeatEvent = ev; }
      }
      // 2) 摆锤 / pendulum driven by the next beat event in queue
      var upcoming = null;
      for (var i = 0; i < queue.length; i++) {
        if (queue[i].sub === 0) { upcoming = queue[i]; break; }
      }
      if (lastBeatEvent) {
        var t0 = lastBeatEvent.time;
        var t1 = upcoming ? upcoming.time : t0 + tempo.bpmToBeatMs(lastBeatEvent.bpm);
        var phase = t1 > t0 ? (now - t0) / (t1 - t0) : 0;
        if (phase < 0) { phase = 0; }
        if (phase > 1) { phase = 1; }
        var angle = tempo.pendulumAngle(phase, reducedMotion ? 0 : 14);
        pendulum.style.transform = 'rotate(' + angle.toFixed(2) + 'deg)';
      }
    }

    function setStatus(text) { statusLine.textContent = text || ''; }

    buildDots();

    return {
      setConfig: setConfig,
      push: push,
      render: render,
      clear: clearIndicators,
      setStatus: setStatus,
      getConfig: function () { return { beatsPerBar: cfg.beatsPerBar, subdivision: cfg.subdivision }; }
    };
  }

  return { createVisualizer: createVisualizer };
}));
