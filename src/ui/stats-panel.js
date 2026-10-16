/**
 * TempoLens · ui/stats-panel.js
 * 练习统计面板：会话磁贴、累计数据、连续打卡与热力图。
 * Practice stats panel: session tiles, totals, streaks and heatmap.
 *
 * 零依赖 UMD 模块 / Zero-dependency UMD module. 仅浏览器环境。
 */
(function (root, factory) {
  'use strict';
  var TL = root.TempoLens || {};
  var api = factory(TL);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.TempoLens = root.TempoLens || {};
  root.TempoLens.statsPanel = api;
}(typeof self !== 'undefined' ? self : this, function (TL) {
  'use strict';

  /**
   * 创建统计面板 / create the stats panel.
   * @param {object} options
   * @param {HTMLElement} options.root
   * @param {function} options.t
   * @param {function} options.getLang
   * @param {function(): Array} options.getSessions  提供会话列表
   * @param {function(): void} options.onClear       清除数据回调
   * @param {function(string): void} options.notify
   */
  function createStatsPanel(options) {
    var root = options.root;
    var t = options.t;
    var getLang = options.getLang;
    var getSessions = options.getSessions || function () { return []; };
    var onClear = options.onClear || function () {};
    var notify = options.notify || function () {};

    var dom = TL.dom;
    var stats = TL.stats;

    var clearBtn = dom.$('#btn-clear-stats', root);
    var heatmapEl = dom.$('#heatmap', root);
    var live = null; // 当前会话快照 / live session snapshot

    function setText(id, value) {
      var node = dom.$('#' + id, root);
      if (node) { node.textContent = String(value); }
    }

    function renderHeatmap(sessions) {
      var lang = getLang();
      dom.clear(heatmapEl);
      var days = stats.heatmap(sessions, { days: 119, todayKey: stats.dateKey(Date.now()) });
      days.forEach(function (day) {
        var cell = dom.el('span', {
          class: 'heatmap-cell',
          dataset: { level: String(day.level) },
          title: day.date + ' · ' + day.bars + ' ' + t(lang, 'stats.bars')
        });
        heatmapEl.appendChild(cell);
      });
    }

    function render() {
      var lang = getLang();
      var sessions = getSessions() || [];
      var summary = stats.summarize(sessions);
      var streaks = stats.streakInfo(sessions, stats.dateKey(Date.now()));
      var today = stats.dateKey(Date.now());
      var todayBars = stats.dayBars(sessions)[today] || 0;

      // 本次会话 / live session
      if (live) {
        setText('stat-session-bars', live.bars);
        setText('stat-session-time', stats.formatDuration(live.ms));
        setText('stat-session-bpm', live.bpm || 0);
      } else {
        setText('stat-session-bars', 0);
        setText('stat-session-time', '0m');
        setText('stat-session-bpm', 0);
      }

      setText('stat-today', todayBars);
      setText('stat-total-bars', summary.totalBars);
      setText('stat-total-time', stats.formatDuration(summary.totalMs));
      setText('stat-streak', streaks.current);
      setText('stat-longest', streaks.longest);
      setText('stat-days', summary.activeDays);

      renderHeatmap(sessions);
    }

    function setLiveSession(info) {
      live = info || null;
      if (live) {
        setText('stat-session-bars', live.bars);
        setText('stat-session-time', stats.formatDuration(live.ms));
        setText('stat-session-bpm', live.bpm || 0);
      }
    }

    function setLang() { render(); }

    dom.on(clearBtn, 'click', function () {
      var lang = getLang();
      if (typeof window !== 'undefined' && window.confirm) {
        if (!window.confirm(t(lang, 'action.confirmClear'))) { return; }
      }
      onClear();
      notify(t(lang, 'action.clearStats') + ' ✓');
    });

    render();

    return { render: render, setLiveSession: setLiveSession, setLang: setLang };
  }

  return { createStatsPanel: createStatsPanel };
}));
