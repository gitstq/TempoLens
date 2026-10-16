/**
 * TempoLens · ui/routine-panel.js
 * 练习例程编辑面板：步骤增删、速度阶梯生成、导入导出、播放控制。
 * Practice routine editor panel: steps, tempo ladders, import/export, playback.
 *
 * 零依赖 UMD 模块 / Zero-dependency UMD module. 仅浏览器环境。
 */
(function (root, factory) {
  'use strict';
  var TL = root.TempoLens || {};
  var api = factory(TL);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.TempoLens = root.TempoLens || {};
  root.TempoLens.routinePanel = api;
}(typeof self !== 'undefined' ? self : this, function (TL) {
  'use strict';

  var STORAGE_KEY = 'tempolens.routine.v1';

  /**
   * 创建例程面板 / create the routine panel.
   * @param {object} options
   * @param {HTMLElement} options.root
   * @param {function} options.t          翻译函数 t(lang, key, vars)
   * @param {function} options.getLang
   * @param {function(string): void} options.notify  Toast 提示
   * @param {function(object): boolean} options.onStart  开始例程
   * @param {function(): void} options.onStop            停止例程
   * @param {object} [options.storage]
   */
  function createRoutinePanel(options) {
    var root = options.root;
    var t = options.t;
    var getLang = options.getLang;
    var notify = options.notify || function () {};
    var onStart = options.onStart || function () {};
    var onStop = options.onStop || function () {};
    var storage = options.storage;

    var dom = TL.dom;
    var icons = TL.icons;
    var routineCore = TL.routine;
    var stats = TL.stats;

    var stepsEl = dom.$('#routine-steps', root);
    var nameEl = dom.$('#routine-name', root);
    var summaryEl = dom.$('#routine-summary', root);
    var statusEl = dom.$('#routine-status', root);
    var addBtn = dom.$('#btn-add-step', root);
    var startBtn = dom.$('#btn-start-routine', root);
    var exportBtn = dom.$('#btn-export-routine', root);
    var importBtn = dom.$('#btn-import-routine', root);
    var fileInput = dom.$('#routine-file', root);
    var ladderBtn = dom.$('#btn-ladder', root);
    var ladderFrom = dom.$('#ladder-from', root);
    var ladderTo = dom.$('#ladder-to', root);
    var ladderStep = dom.$('#ladder-step', root);
    var ladderBars = dom.$('#ladder-bars', root);

    var steps = [];
    var playing = false;

    // —— 本地持久化 / persistence ——

    function saveLocal() {
      if (!storage) { return; }
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify({ name: nameEl.value, steps: steps }));
      } catch (e) { /* noop */ }
    }

    function loadLocal() {
      if (!storage) { return; }
      try {
        var raw = storage.getItem(STORAGE_KEY);
        if (!raw) { return; }
        var data = JSON.parse(raw);
        if (data && Array.isArray(data.steps) && data.steps.length) {
          var res = routineCore.validateRoutine({ name: data.name || 'Routine', steps: data.steps });
          if (res.ok) {
            steps = res.routine.steps;
            if (typeof data.name === 'string' && data.name) { nameEl.value = data.name; }
          }
        }
      } catch (e) { /* noop */ }
    }

    // —— 渲染 / rendering ——

    function renderSteps() {
      dom.clear(stepsEl);
      if (!steps.length) {
        stepsEl.appendChild(dom.el('p', { class: 'routine-empty', text: t(getLang(), 'routine.empty') }));
        return;
      }
      steps.forEach(function (step, index) {
        stepsEl.appendChild(renderRow(step, index));
      });
    }

    function renderRow(step, index) {
      var bpmInput = dom.el('input', {
        class: 'input', type: 'number', min: '20', max: '300', step: '1', value: String(step.bpm),
        'aria-label': t(getLang(), 'label.stepBpm')
      });
      var barsInput = dom.el('input', {
        class: 'input', type: 'number', min: '1', max: '999', step: '1', value: String(step.bars),
        'aria-label': t(getLang(), 'label.stepBars')
      });
      var subSelect = dom.el('select', { class: 'input step-subdivision', 'aria-label': t(getLang(), 'label.subdivision') });
      TL.tempo.SUBDIVISION_KEYS.forEach(function (key) {
        var opt = dom.el('option', { value: key, text: t(getLang(), 'sub.' + key) });
        if (key === step.subdivision) { opt.selected = true; }
        subSelect.appendChild(opt);
      });
      var dur = dom.el('span', {
        class: 'step-dur',
        text: stats.formatDuration(routineCore.stepDurationMs(step)),
        title: t(getLang(), 'stats.time')
      });

      function commit(field, value) {
        var patch = {};
        patch[field] = value;
        var candidate = {};
        for (var k in step) { candidate[k] = step[k]; }
        candidate[field] = value;
        var res = routineCore.validateStep(candidate);
        if (!res.ok) {
          notify(res.errors[0]);
          renderSteps();
          return;
        }
        steps[index] = res.step;
        dur.textContent = stats.formatDuration(routineCore.stepDurationMs(steps[index]));
        updateSummary();
        saveLocal();
      }

      dom.on(bpmInput, 'change', function () { commit('bpm', Number(bpmInput.value)); });
      dom.on(barsInput, 'change', function () { commit('bars', Number(barsInput.value)); });
      dom.on(subSelect, 'change', function () { commit('subdivision', subSelect.value); });

      var upBtn = dom.el('button', { class: 'btn', type: 'button', html: icons.icon('up', 14), title: t(getLang(), 'action.moveUp') });
      var downBtn = dom.el('button', { class: 'btn', type: 'button', html: icons.icon('down', 14), title: t(getLang(), 'action.moveDown') });
      var delBtn = dom.el('button', { class: 'btn', type: 'button', html: icons.icon('trash', 14), title: t(getLang(), 'action.removeStep') });
      dom.on(upBtn, 'click', function () { move(index, -1); });
      dom.on(downBtn, 'click', function () { move(index, 1); });
      dom.on(delBtn, 'click', function () { removeStep(index); });

      return dom.el('div', { class: 'step-row', role: 'listitem' }, [
        dom.el('span', { class: 'step-index', text: String(index + 1) }),
        bpmInput,
        barsInput,
        subSelect,
        dur,
        dom.el('div', { class: 'step-actions' }, [upBtn, downBtn, delBtn])
      ]);
    }

    function updateSummary() {
      var lang = getLang();
      if (!steps.length) {
        summaryEl.textContent = '';
        return;
      }
      summaryEl.textContent = t(lang, 'routine.steps', {
        n: steps.length,
        t: stats.formatDuration(routineCore.routineDurationMs({ steps: steps }))
      });
    }

    // —— 步骤操作 / step operations ——

    function addStep(partial) {
      if (steps.length >= routineCore.MAX_STEPS) {
        notify(t(getLang(), 'routine.tooManySteps'));
        return;
      }
      try {
        steps.push(routineCore.createStep(partial || {}));
      } catch (e) {
        notify(e.message);
        return;
      }
      renderSteps();
      updateSummary();
      saveLocal();
    }

    function removeStep(index) {
      steps.splice(index, 1);
      renderSteps();
      updateSummary();
      saveLocal();
    }

    function move(index, dir) {
      var target = index + dir;
      if (target < 0 || target >= steps.length) { return; }
      var tmp = steps[index];
      steps[index] = steps[target];
      steps[target] = tmp;
      renderSteps();
      updateSummary();
      saveLocal();
    }

    function buildLadder() {
      try {
        var generated = routineCore.tempoLadder({
          fromBpm: Number(ladderFrom.value),
          toBpm: Number(ladderTo.value),
          stepBpm: Number(ladderStep.value),
          barsPerStep: Number(ladderBars.value),
          beatsPerBar: Number(dom.$('#beats-per-bar').value) || 4,
          subdivision: dom.$('#subdivision').value || 'quarter'
        });
        steps = generated;
        renderSteps();
        updateSummary();
        saveLocal();
        notify(t(getLang(), 'action.tempoLadder') + ' ✓');
      } catch (e) {
        notify(e.message);
      }
    }

    function getRoutine() {
      var res = routineCore.validateRoutine({ name: nameEl.value, steps: steps });
      return res.ok ? res.routine : null;
    }

    function exportRoutine() {
      var routine = getRoutine();
      if (!routine) { notify(t(getLang(), 'routine.empty')); return; }
      dom.downloadText('tempolens-routine.json', routineCore.serializeRoutine(routine, true));
      notify(t(getLang(), 'action.exportRoutine') + ' ✓');
    }

    function importRoutine(file) {
      dom.readFileAsText(file).then(function (text) {
        try {
          var routine = routineCore.parseRoutine(text);
          steps = routine.steps;
          nameEl.value = routine.name;
          renderSteps();
          updateSummary();
          saveLocal();
          notify(t(getLang(), 'routine.imported'));
        } catch (e) {
          notify(t(getLang(), 'routine.importFailed'));
        }
      }).catch(function () {
        notify(t(getLang(), 'routine.importFailed'));
      });
    }

    function startRoutine() {
      var routine = getRoutine();
      if (!routine) { notify(t(getLang(), 'routine.empty')); return; }
      var ok = onStart(routine);
      if (ok) { setPlaying(true); }
    }

    function stopRoutine() {
      onStop();
      setPlaying(false);
    }

    function setPlaying(value) {
      playing = !!value;
      startBtn.textContent = t(getLang(), playing ? 'action.stopRoutine' : 'action.startRoutine');
    }

    function onStep(index, total) {
      var lang = getLang();
      if (index < 0) {
        statusEl.textContent = total > 0 ? t(lang, 'routine.done') : '';
        setPlaying(false);
      } else {
        statusEl.textContent = t(lang, 'routine.current', { i: index + 1, n: total });
      }
    }

    function setLang() {
      renderSteps();
      updateSummary();
      setPlaying(playing);
      onStep(-1, 0);
    }

    // —— 事件绑定 / wiring ——

    dom.on(addBtn, 'click', function () {
      var bpm = Number(dom.$('#bpm-input').value) || 100;
      addStep({ bpm: bpm, bars: 4, beatsPerBar: Number(dom.$('#beats-per-bar').value) || 4, subdivision: dom.$('#subdivision').value || 'quarter' });
    });
    dom.on(startBtn, 'click', function () { playing ? stopRoutine() : startRoutine(); });
    dom.on(exportBtn, 'click', exportRoutine);
    dom.on(importBtn, 'click', function () { fileInput.click(); });
    dom.on(fileInput, 'change', function () {
      if (fileInput.files && fileInput.files[0]) { importRoutine(fileInput.files[0]); }
      fileInput.value = '';
    });
    dom.on(ladderBtn, 'click', buildLadder);

    loadLocal();
    if (!steps.length) {
      addStep({ bpm: 60, bars: 4, beatsPerBar: 4, subdivision: 'quarter' });
      addStep({ bpm: 80, bars: 4, beatsPerBar: 4, subdivision: 'quarter' });
      addStep({ bpm: 100, bars: 8, beatsPerBar: 4, subdivision: 'eighth' });
    }
    renderSteps();
    updateSummary();
    setPlaying(false);

    return {
      getRoutine: getRoutine,
      onStep: onStep,
      setLang: setLang,
      setPlaying: setPlaying
    };
  }

  return { createRoutinePanel: createRoutinePanel };
}));
