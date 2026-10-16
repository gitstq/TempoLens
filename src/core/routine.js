/**
 * TempoLens · core/routine.js
 * 练习例程：按顺序自动播放的步骤序列（速度/拍号/小节数），
 * 支持速度阶梯生成、JSON 序列化与校验。
 * Practice routines: ordered step sequences with tempo ladders,
 * JSON serialization and validation.
 *
 * 零依赖 UMD 模块 / Zero-dependency UMD module. 依赖 core/tempo.js。
 */
(function (root, factory) {
  'use strict';
  var api = factory(root.TempoLens ? root.TempoLens.tempo : require('./tempo.js'));
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.TempoLens = root.TempoLens || {};
  root.TempoLens.routine = api;
}(typeof self !== 'undefined' ? self : this, function (tempo) {
  'use strict';

  var MAX_STEPS = 50;
  var MAX_BARS = 999;

  function randomId() {
    return 'st-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  /**
   * 校验并补全单个步骤 / validate & normalize one routine step.
   * @returns {{ok: boolean, step?: object, errors: Array<string>}}
   */
  function validateStep(step) {
    var errors = [];
    var s = step || {};
    var bpm = Math.round(Number(s.bpm));
    var bars = Math.round(Number(s.bars));
    var beatsPerBar = Math.round(Number(s.beatsPerBar));
    var swing = Number(s.swing);

    if (!isFinite(bpm) || bpm < tempo.MIN_BPM || bpm > tempo.MAX_BPM) {
      errors.push('bpm must be between ' + tempo.MIN_BPM + ' and ' + tempo.MAX_BPM);
    }
    if (!isFinite(bars) || bars < 1 || bars > MAX_BARS) {
      errors.push('bars must be between 1 and ' + MAX_BARS);
    }
    if (!isFinite(beatsPerBar) || beatsPerBar < 1 || beatsPerBar > 16) {
      errors.push('beatsPerBar must be between 1 and 16');
    }
    try {
      tempo.subdivisionSteps(s.subdivision || 'quarter');
    } catch (e) {
      errors.push('unknown subdivision: ' + s.subdivision);
    }
    if (!isFinite(swing) || swing < 0 || swing > 1) {
      errors.push('swing must be between 0 and 1');
    }
    if (errors.length) { return { ok: false, errors: errors }; }
    return {
      ok: true,
      step: {
        id: typeof s.id === 'string' && s.id ? s.id : randomId(),
        bpm: bpm,
        bars: bars,
        beatsPerBar: beatsPerBar,
        subdivision: s.subdivision || 'quarter',
        swing: Math.min(1, Math.max(0, swing))
      }
    };
  }

  /** 创建步骤 / create a step from partial input (throws on invalid) */
  function createStep(partial) {
    var result = validateStep(partial);
    if (!result.ok) { throw new Error('Invalid step: ' + result.errors.join('; ')); }
    return result.step;
  }

  /** 步骤时长（毫秒）/ step duration in ms */
  function stepDurationMs(step) {
    return step.bars * step.beatsPerBar * (60000 / step.bpm);
  }

  /** 例程总时长（毫秒）/ total routine duration in ms */
  function routineDurationMs(routine) {
    return routine.steps.reduce(function (sum, step) { return sum + stepDurationMs(step); }, 0);
  }

  /**
   * 校验整个例程 / validate a whole routine.
   * @returns {{ok: boolean, routine?: object, errors: Array<string>}}
   */
  function validateRoutine(routine) {
    var errors = [];
    var r = routine || {};
    if (!r || typeof r !== 'object') { return { ok: false, errors: ['routine must be an object'] }; }
    if (typeof r.name !== 'string' || !r.name.trim()) { errors.push('name is required'); }
    if (!Array.isArray(r.steps) || r.steps.length === 0) { errors.push('at least one step is required'); }
    else if (r.steps.length > MAX_STEPS) { errors.push('too many steps (max ' + MAX_STEPS + ')'); }
    var steps = [];
    if (Array.isArray(r.steps)) {
      for (var i = 0; i < r.steps.length && i < MAX_STEPS; i++) {
        var res = validateStep(r.steps[i]);
        if (!res.ok) { errors.push('step ' + (i + 1) + ': ' + res.errors.join('; ')); }
        else { steps.push(res.step); }
      }
    }
    if (errors.length) { return { ok: false, errors: errors }; }
    return {
      ok: true,
      routine: {
        id: typeof r.id === 'string' && r.id ? r.id : randomId(),
        name: r.name.trim().slice(0, 80),
        steps: steps
      }
    };
  }

  /** 序列化为 JSON 字符串 / serialize to JSON */
  function serializeRoutine(routine, pretty) {
    var res = validateRoutine(routine);
    if (!res.ok) { throw new Error('Cannot serialize invalid routine: ' + res.errors.join('; ')); }
    return JSON.stringify(res.routine, null, pretty ? 2 : 0);
  }

  /** 从 JSON 字符串解析（失败抛错）/ parse from JSON (throws on invalid) */
  function parseRoutine(json) {
    var data;
    try {
      data = JSON.parse(json);
    } catch (e) {
      throw new Error('Invalid routine JSON: ' + e.message);
    }
    var res = validateRoutine(data);
    if (!res.ok) { throw new Error('Invalid routine: ' + res.errors.join('; ')); }
    return res.routine;
  }

  /**
   * 根据速度阶梯参数生成步骤序列。
   * Build routine steps from a tempo ladder spec.
   * @param {{fromBpm:number, toBpm:number, stepBpm:number, barsPerStep:number,
   *          beatsPerBar?:number, subdivision?:string, swing?:number}} opts
   */
  function tempoLadder(opts) {
    var segments = tempo.rampSegments(opts);
    var beatsPerBar = opts.beatsPerBar || 4;
    var subdivision = opts.subdivision || 'quarter';
    var swing = opts.swing || 0;
    return segments.map(function (seg) {
      return createStep({
        bpm: seg.toBpm,
        bars: seg.bars,
        beatsPerBar: beatsPerBar,
        subdivision: subdivision,
        swing: swing
      });
    });
  }

  /**
   * 例程推进：根据当前步骤已播放时长决定下一步。
   * Advance the routine given elapsed time inside the current step.
   * @returns {{index: number, done: boolean}} index 为下一步下标，done 表示例程结束
   */
  function advanceRoutine(routine, index, elapsedMs) {
    if (!routine || !Array.isArray(routine.steps) || !routine.steps.length) {
      throw new Error('routine has no steps');
    }
    if (index < 0 || index >= routine.steps.length) {
      throw new RangeError('step index out of range');
    }
    var duration = stepDurationMs(routine.steps[index]);
    if (elapsedMs + 1e-6 >= duration) {
      var next = index + 1;
      return { index: next >= routine.steps.length ? -1 : next, done: next >= routine.steps.length };
    }
    return { index: index, done: false };
  }

  return {
    MAX_STEPS: MAX_STEPS,
    validateStep: validateStep,
    createStep: createStep,
    stepDurationMs: stepDurationMs,
    routineDurationMs: routineDurationMs,
    validateRoutine: validateRoutine,
    serializeRoutine: serializeRoutine,
    parseRoutine: parseRoutine,
    tempoLadder: tempoLadder,
    advanceRoutine: advanceRoutine
  };
}));
