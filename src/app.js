/**
 * TempoLens · app.js
 * 应用引导：设置装载、国际化、控件绑定、键盘快捷键、URL 分享。
 * Bootstrap: settings, i18n, control wiring, keyboard shortcuts, URL sharing.
 *
 * 零依赖，直接在浏览器中以普通脚本运行 / plain script, zero dependencies.
 */
(function () {
  'use strict';

  var TL = window.TempoLens;
  var dom = TL.dom;
  var icons = TL.icons;
  var i18n = TL.i18n;
  var settingsCore = TL.settings;
  var tempo = TL.tempo;

  // —— 存储（localStorage 不可用时退化为内存）/ storage with in-memory fallback ——

  function createStorage() {
    var memory = {};
    try {
      var probe = '__tempolens_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch (e) {
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(memory, k) ? memory[k] : null; },
        setItem: function (k, v) { memory[k] = String(v); },
        removeItem: function (k) { delete memory[k]; }
      };
    }
  }

  var storage = createStorage();

  // —— 初始设置：URL 分享码 > 本地存储 > 默认值 ——
  // Initial settings: URL share code > localStorage > defaults

  function initialSettings() {
    var hash = window.location.hash || '';
    if (hash.indexOf('#s=') === 0) {
      var decoded = settingsCore.decodeSettings(hash.slice(3));
      if (decoded) { return { settings: decoded, fromLink: true }; }
      return { settings: settingsCore.loadSettings(storage), fromLink: false, invalidLink: true };
    }
    return { settings: settingsCore.loadSettings(storage), fromLink: false };
  }

  var boot = initialSettings();
  var settings = boot.settings;
  var lang = i18n.resolveLang(settings.lang, window.navigator ? window.navigator.languages : []);

  // —— DOM 引用 / element references ——

  var els = {
    langSelect: dom.$('#lang-select'),
    themeSelect: dom.$('#theme-select'),
    brandMark: dom.$('#brand-icon'),
    iconPlay: dom.$('#icon-play'),
    iconStop: dom.$('#icon-stop'),
    iconTap: dom.$('#icon-tap'),
    btnSlower: dom.$('#btn-slower'),
    btnFaster: dom.$('#btn-faster'),
    btnPlay: dom.$('#btn-play'),
    btnTap: dom.$('#btn-tap'),
    playLabel: dom.$('#play-label'),
    bpmValue: dom.$('#bpm-value'),
    bpmSlider: dom.$('#bpm-slider'),
    bpmInput: dom.$('#bpm-input'),
    beatsPerBar: dom.$('#beats-per-bar'),
    subdivision: dom.$('#subdivision'),
    swing: dom.$('#swing'),
    swingValue: dom.$('#swing-value'),
    accentMode: dom.$('#accent-mode'),
    countIn: dom.$('#count-in'),
    sound: dom.$('#sound'),
    volume: dom.$('#volume'),
    volumeValue: dom.$('#volume-value'),
    mute: dom.$('#mute'),
    polyEnable: dom.$('#poly-enable'),
    polyRatio: dom.$('#poly-ratio'),
    polyBpm: dom.$('#poly-bpm'),
    polyCycle: dom.$('#poly-cycle'),
    btnShare: dom.$('#btn-share'),
    btnExportSettings: dom.$('#btn-export-settings'),
    btnImportSettings: dom.$('#btn-import-settings'),
    settingsFile: dom.$('#settings-file'),
    visualizerRoot: dom.$('#visualizer'),
    toast: dom.$('#toast')
  };

  // —— Toast ——

  var toastTimer = null;
  function notify(text) {
    els.toast.textContent = text;
    els.toast.classList.add('is-visible');
    if (toastTimer) { window.clearTimeout(toastTimer); }
    toastTimer = window.setTimeout(function () {
      els.toast.classList.remove('is-visible');
    }, 2200);
  }

  function t(key, vars) { return i18n.t(lang, key, vars); }

  // —— 音频与视觉 / audio & visuals ——

  var audio = TL.clickEngine.createClickEngine();
  var visualizer = TL.visualizer.createVisualizer({ root: els.visualizerRoot });

  // —— 传输控制器 / transport（须先于面板创建，面板渲染时会读取会话）——

  var transport = TL.transport.createTransport({
    audio: audio,
    visualizer: visualizer,
    getSettings: function () { return settings; },
    onSettingsChange: function (patch) { setSettings(patch); },
    onStateChange: onStateChange,
    onRoutineStep: function (index, total) {
      routinePanel.onStep(index, total);
      if (index < 0) {
        visualizer.setStatus('');
      } else {
        visualizer.setStatus(t('routine.current', { i: index + 1, n: total }));
      }
    },
    onStatsChange: function () { statsPanel.render(); },
    onTap: function () { dom.pulse(els.btnTap, 'is-tapping', 220); },
    storage: storage
  });

  // —— 统计与例程面板 / panels ——

  var statsPanel = TL.statsPanel.createStatsPanel({
    root: dom.$('#card-stats'),
    t: t,
    getLang: function () { return lang; },
    getSessions: function () { return transport.loadSessions(); },
    onClear: function () { transport.clearSessions(); },
    notify: notify
  });

  var routinePanel = TL.routinePanel.createRoutinePanel({
    root: dom.$('#card-routine'),
    t: t,
    getLang: function () { return lang; },
    notify: notify,
    onStart: function (routine) {
      var ok = transport.startRoutine(routine);
      if (ok) { visualizer.setStatus(t('routine.current', { i: 1, n: routine.steps.length })); }
      return ok;
    },
    onStop: function () {
      transport.stopRoutine();
    },
    storage: storage
  });

  // —— 设置同步 / settings sync ——

  function setSettings(patch) {
    settings = settingsCore.sanitizeSettings(merge(settings, patch));
    settingsCore.saveSettings(storage, settings);
    transport.applySettings(settings);
    syncControls();
    updateShareUrl();
  }

  function merge(base, patch) {
    var out = {};
    for (var k in base) { out[k] = base[k]; }
    for (var key in patch) { out[key] = patch[key]; }
    return out;
  }

  function updateShareUrl() {
    if (!window.history || !window.history.replaceState) { return; }
    try {
      window.history.replaceState(null, '', '#s=' + settingsCore.encodeSettings(settings));
    } catch (e) { /* URL 过长时忽略 / ignore overlong URLs */ }
  }

  // —— 控件同步 / control sync ——

  function setSliderFill(input) {
    if (!input) { return; }
    var min = Number(input.min || 0);
    var max = Number(input.max || 100);
    var value = Number(input.value || 0);
    var pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
    input.style.setProperty('--fill', pct.toFixed(1) + '%');
  }

  function syncControls() {
    els.bpmValue.textContent = String(settings.bpm);
    els.bpmSlider.value = String(settings.bpm);
    els.bpmInput.value = String(settings.bpm);
    els.beatsPerBar.value = String(settings.beatsPerBar);
    els.subdivision.value = settings.subdivision;
    els.swing.value = String(Math.round(settings.swing * 100));
    els.swingValue.textContent = Math.round(settings.swing * 100) + '%';
    els.accentMode.value = settings.accentMode;
    els.countIn.value = String(settings.countInBars);
    els.sound.value = settings.sound;
    els.volume.value = String(Math.round(settings.volume * 100));
    els.volumeValue.textContent = Math.round(settings.volume * 100) + '%';
    els.mute.checked = settings.muted;
    els.polyEnable.checked = !!settings.polyrhythm;
    els.polyRatio.value = settings.polyrhythm || '3:2';
    els.polyRatio.disabled = !settings.polyrhythm;
    els.polyBpm.value = settings.polyBpm === null ? '' : String(settings.polyBpm);
    els.polyBpm.disabled = !settings.polyrhythm;
    els.langSelect.value = settings.lang;
    els.themeSelect.value = settings.theme;
    setSliderFill(els.bpmSlider);
    setSliderFill(els.swing);
    setSliderFill(els.volume);
    updatePolyCycle();
  }

  function updatePolyCycle() {
    if (!settings.polyrhythm) {
      els.polyCycle.textContent = '';
      return;
    }
    try {
      var ratio = TL.polyrhythm.parsePolyrhythm(settings.polyrhythm);
      var bpm = settings.polyBpm || settings.bpm;
      var beats = TL.polyrhythm.cycleBeats(ratio.a, ratio.b);
      els.polyCycle.textContent = t('poly.cycle') + ': ' + t('poly.beats', { n: beats }) +
        ' · ' + Math.round(TL.polyrhythm.defaultCycleMs(ratio.a, ratio.b, bpm)) + ' ms';
    } catch (e) {
      els.polyCycle.textContent = t('poly.invalid');
    }
  }

  // —— 播放状态 / playback state ——

  function onStateChange(running) {
    els.iconPlay.classList.toggle('is-hidden', running);
    els.iconStop.classList.toggle('is-hidden', !running);
    els.playLabel.textContent = t(running ? 'action.stop' : 'action.play');
    els.btnPlay.setAttribute('aria-pressed', running ? 'true' : 'false');
    if (!running) { statsPanel.setLiveSession(null); }
  }

  // —— 图标注入 / icon injection ——

  function injectIcons() {
    els.brandMark.innerHTML = icons.icon('music', 22);
    els.iconPlay.innerHTML = icons.icon('play', 20);
    els.iconStop.innerHTML = icons.icon('stop', 20);
    els.iconTap.innerHTML = icons.icon('hand', 17);
    els.btnSlower.innerHTML = icons.icon('minus', 16);
    els.btnFaster.innerHTML = icons.icon('plus', 16);
    dom.$$('[data-icon]').forEach(function (node) {
      node.innerHTML = icons.icon(node.getAttribute('data-icon'), 15);
    });
  }

  // —— 主题 / theme ——

  function applyTheme() {
    var html = document.documentElement;
    if (settings.theme === 'auto') {
      html.removeAttribute('data-theme');
    } else {
      html.setAttribute('data-theme', settings.theme);
    }
  }

  // —— 语言 / language ——

  function applyLang() {
    lang = i18n.resolveLang(settings.lang, window.navigator ? window.navigator.languages : []);
    i18n.translateDocument(document, lang);
    injectIcons();
    syncControls();
    routinePanel.setLang();
    statsPanel.setLang();
    onStateChange(transport.isRunning());
  }

  // —— 事件绑定 / wiring ——

  function bindEvents() {
    dom.on(els.langSelect, 'change', function () {
      setSettings({ lang: els.langSelect.value });
      applyLang();
    });
    dom.on(els.themeSelect, 'change', function () {
      setSettings({ theme: els.themeSelect.value });
      applyTheme();
    });

    dom.on(els.bpmSlider, 'input', function () {
      els.bpmValue.textContent = els.bpmSlider.value;
      els.bpmInput.value = els.bpmSlider.value;
      setSliderFill(els.bpmSlider);
    });
    dom.on(els.bpmSlider, 'change', function () {
      setSettings({ bpm: Number(els.bpmSlider.value) });
    });
    dom.on(els.bpmInput, 'change', function () {
      setSettings({ bpm: tempo.clampBpm(Number(els.bpmInput.value)) });
    });
    dom.on(els.btnSlower, 'click', function () { nudgeBpm(-1); });
    dom.on(els.btnFaster, 'click', function () { nudgeBpm(1); });

    dom.on(els.btnPlay, 'click', function () { transport.toggle(); });
    dom.on(els.btnTap, 'click', function () {
      transport.tap(typeof performance !== 'undefined' ? performance.now() : Date.now());
      dom.pulse(els.btnTap, 'is-tapping', 220);
    });

    dom.on(els.beatsPerBar, 'change', function () { setSettings({ beatsPerBar: Number(els.beatsPerBar.value) }); });
    dom.on(els.subdivision, 'change', function () { setSettings({ subdivision: els.subdivision.value }); });
    dom.on(els.swing, 'input', function () {
      els.swingValue.textContent = els.swing.value + '%';
      setSliderFill(els.swing);
    });
    dom.on(els.swing, 'change', function () {
      setSettings({ swing: Number(els.swing.value) / 100 });
    });
    dom.on(els.accentMode, 'change', function () { setSettings({ accentMode: els.accentMode.value }); });
    dom.on(els.countIn, 'change', function () { setSettings({ countInBars: Number(els.countIn.value) }); });
    dom.on(els.sound, 'change', function () { setSettings({ sound: els.sound.value }); });
    dom.on(els.volume, 'input', function () {
      els.volumeValue.textContent = els.volume.value + '%';
      setSliderFill(els.volume);
    });
    dom.on(els.volume, 'change', function () {
      setSettings({ volume: Number(els.volume.value) / 100 });
    });
    dom.on(els.mute, 'change', function () { setSettings({ muted: els.mute.checked }); });

    dom.on(els.polyEnable, 'change', function () {
      if (els.polyEnable.checked) {
        var spec = els.polyRatio.value.trim() || '3:2';
        try {
          TL.polyrhythm.parsePolyrhythm(spec);
          setSettings({ polyrhythm: spec });
        } catch (e) {
          els.polyEnable.checked = false;
          notify(t('poly.invalid'));
        }
      } else {
        setSettings({ polyrhythm: null });
      }
    });
    dom.on(els.polyRatio, 'change', function () {
      var spec = els.polyRatio.value.trim();
      try {
        TL.polyrhythm.parsePolyrhythm(spec);
        setSettings({ polyrhythm: spec });
      } catch (e) {
        notify(t('poly.invalid'));
        els.polyRatio.value = settings.polyrhythm || '3:2';
      }
    });
    dom.on(els.polyBpm, 'change', function () {
      var value = els.polyBpm.value.trim();
      setSettings({ polyBpm: value === '' ? null : Number(value) });
    });

    dom.on(els.btnShare, 'click', function () {
      updateShareUrl();
      dom.copyText(window.location.href).then(function () {
        notify(t('action.copied'));
      }).catch(function () {
        notify(t('action.copyFailed'));
      });
    });
    dom.on(els.btnExportSettings, 'click', function () {
      dom.downloadText('tempolens-settings.json', JSON.stringify(settings, null, 2));
      notify(t('action.exportSettings') + ' ✓');
    });
    dom.on(els.btnImportSettings, 'click', function () { els.settingsFile.click(); });
    dom.on(els.settingsFile, 'change', function () {
      var file = els.settingsFile.files && els.settingsFile.files[0];
      if (!file) { return; }
      dom.readFileAsText(file).then(function (text) {
        try {
          var data = JSON.parse(text);
          setSettings(data);
          applyLang();
          notify(t('action.importSettings') + ' ✓');
        } catch (e) {
          notify(t('routine.importFailed'));
        }
      }).catch(function () {
        notify(t('routine.importFailed'));
      });
      els.settingsFile.value = '';
    });

    // 键盘快捷键 / keyboard shortcuts
    dom.on(document, 'keydown', function (event) {
      var target = event.target;
      var tag = target && target.tagName ? target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'select' || tag === 'textarea' || event.metaKey || event.ctrlKey) {
        return;
      }
      switch (event.key) {
        case ' ':
        case 'Spacebar':
          event.preventDefault();
          transport.toggle();
          break;
        case 't':
        case 'T':
          transport.tap(typeof performance !== 'undefined' ? performance.now() : Date.now());
          dom.pulse(els.btnTap, 'is-tapping', 220);
          break;
        case 'ArrowUp':
          event.preventDefault();
          nudgeBpm(event.shiftKey ? 10 : 1);
          break;
        case 'ArrowDown':
          event.preventDefault();
          nudgeBpm(event.shiftKey ? -10 : -1);
          break;
        case 'm':
        case 'M':
          setSettings({ muted: !settings.muted });
          break;
        case '1': setSettings({ subdivision: 'quarter' }); break;
        case '2': setSettings({ subdivision: 'eighth' }); break;
        case '3': setSettings({ subdivision: 'triplet' }); break;
        case '4': setSettings({ subdivision: 'sixteenth' }); break;
        default:
          break;
      }
    });

    // 实时会话统计轮询 / poll live session stats
    window.setInterval(function () {
      if (transport.isRunning()) {
        statsPanel.setLiveSession(transport.sessionInfo());
      }
    }, 500);

    // 首次手势解锁音频 / unlock audio on first gesture
    var unlock = function () {
      audio.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  function nudgeBpm(delta) {
    setSettings({ bpm: tempo.clampBpm(settings.bpm + delta) });
  }

  // —— 启动 / boot ——

  function boot$() {
    injectIcons();
    applyTheme();
    applyLang();
    bindEvents();
    transport.applySettings(settings);
    if (boot.invalidLink) {
      notify(t('share.invalid'));
    } else if (boot.fromLink) {
      notify(t('share.loaded'));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot$);
  } else {
    boot$();
  }
}());
