/**
 * TempoLens · core/settings.js
 * 设置模型：默认值、校验、清洗、URL 分享编码与本地存储持久化。
 * Settings model: defaults, validation, sanitization, URL share codes,
 * and storage persistence with an injectable storage backend.
 *
 * 零依赖 UMD 模块 / Zero-dependency UMD module. 依赖 core/tempo.js。
 */
(function (root, factory) {
  'use strict';
  var api = factory(root.TempoLens ? root.TempoLens.tempo : require('./tempo.js'), root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.TempoLens = root.TempoLens || {};
  root.TempoLens.settings = api;
}(typeof self !== 'undefined' ? self : this, function (tempo, root) {
  'use strict';

  var STORAGE_KEY = 'tempolens.settings.v1';
  var LANGS = ['zh-CN', 'zh-TW', 'en'];

  var DEFAULTS = {
    bpm: 100,
    beatsPerBar: 4,
    subdivision: 'quarter', // quarter | eighth | triplet | sixteenth
    swing: 0,               // 0..1
    accentMode: 'bar',      // bar | beat | none
    volume: 0.7,            // 0..1
    sound: 'click',         // click | wood | beep
    muted: false,
    countInBars: 0,         // 0 | 1 | 2
    polyrhythm: null,       // null 或 "3:2" / null or spec like "3:2"
    polyBpm: null,          // 复节奏基准速度，null = 跟随主速度 / null = follow main bpm
    lang: 'auto',           // auto | zh-CN | zh-TW | en
    theme: 'auto'           // auto | light | dark
  };

  /** 校验 / validate; returns an array of error strings (empty = valid) */
  function validateSettings(settings) {
    var errors = [];
    var s = settings || {};
    var bpm = Math.round(Number(s.bpm));
    if (!isFinite(bpm) || bpm < tempo.MIN_BPM || bpm > tempo.MAX_BPM) {
      errors.push('bpm must be between ' + tempo.MIN_BPM + ' and ' + tempo.MAX_BPM);
    }
    var beatsPerBar = Math.round(Number(s.beatsPerBar));
    if (!isFinite(beatsPerBar) || beatsPerBar < 1 || beatsPerBar > 16) {
      errors.push('beatsPerBar must be between 1 and 16');
    }
    try { tempo.subdivisionSteps(s.subdivision); } catch (e) { errors.push('unknown subdivision'); }
    var swing = Number(s.swing);
    if (!isFinite(swing) || swing < 0 || swing > 1) { errors.push('swing must be between 0 and 1'); }
    if (['bar', 'beat', 'none'].indexOf(s.accentMode) < 0) { errors.push('unknown accentMode'); }
    var volume = Number(s.volume);
    if (!isFinite(volume) || volume < 0 || volume > 1) { errors.push('volume must be between 0 and 1'); }
    if (['click', 'wood', 'beep'].indexOf(s.sound) < 0) { errors.push('unknown sound'); }
    if (typeof s.muted !== 'boolean') { errors.push('muted must be boolean'); }
    if ([0, 1, 2].indexOf(Math.round(Number(s.countInBars))) < 0) { errors.push('countInBars must be 0, 1 or 2'); }
    if (s.polyrhythm !== null && s.polyrhythm !== undefined) {
      try { getPoly().parsePolyrhythm(s.polyrhythm); } catch (e) { errors.push('invalid polyrhythm: ' + s.polyrhythm); }
    }
    if (s.polyBpm !== null && s.polyBpm !== undefined) {
      var pb = Math.round(Number(s.polyBpm));
      if (!isFinite(pb) || pb < tempo.MIN_BPM || pb > tempo.MAX_BPM) { errors.push('polyBpm out of range'); }
    }
    if (LANGS.indexOf(s.lang) < 0 && s.lang !== 'auto') { errors.push('unknown lang'); }
    if (['auto', 'light', 'dark'].indexOf(s.theme) < 0) { errors.push('unknown theme'); }
    return errors;
  }

  // 延迟解析复节奏校验器，避免循环依赖 / lazy polyrhythm validator to avoid cycles
  function getPoly() {
    if (typeof module === 'object' && module.exports) { return require('./polyrhythm.js'); }
    return root.TempoLens.polyrhythm;
  }

  /** 与默认值合并并清洗 / merge with defaults and clamp into valid ranges */
  function sanitizeSettings(partial) {
    var p = partial || {};
    var out = {};
    Object.keys(DEFAULTS).forEach(function (key) { out[key] = DEFAULTS[key]; });

    out.bpm = tempo.clampBpm(p.bpm === undefined ? DEFAULTS.bpm : p.bpm);
    var bpb = Math.round(Number(p.beatsPerBar === undefined ? DEFAULTS.beatsPerBar : p.beatsPerBar));
    out.beatsPerBar = isFinite(bpb) && bpb >= 1 && bpb <= 16 ? bpb : DEFAULTS.beatsPerBar;
    out.subdivision = tempo.SUBDIVISIONS[p.subdivision] ? p.subdivision : DEFAULTS.subdivision;
    var swing = Number(p.swing === undefined ? DEFAULTS.swing : p.swing);
    out.swing = isFinite(swing) ? Math.min(1, Math.max(0, swing)) : DEFAULTS.swing;
    out.accentMode = ['bar', 'beat', 'none'].indexOf(p.accentMode) >= 0 ? p.accentMode : DEFAULTS.accentMode;
    var vol = Number(p.volume === undefined ? DEFAULTS.volume : p.volume);
    out.volume = isFinite(vol) ? Math.min(1, Math.max(0, vol)) : DEFAULTS.volume;
    out.sound = ['click', 'wood', 'beep'].indexOf(p.sound) >= 0 ? p.sound : DEFAULTS.sound;
    out.muted = p.muted === undefined ? DEFAULTS.muted : !!p.muted;
    var ci = Math.round(Number(p.countInBars === undefined ? DEFAULTS.countInBars : p.countInBars));
    out.countInBars = [0, 1, 2].indexOf(ci) >= 0 ? ci : 0;
    out.polyrhythm = p.polyrhythm === undefined ? DEFAULTS.polyrhythm : p.polyrhythm;
    if (out.polyrhythm !== null) {
      try { getPoly().parsePolyrhythm(out.polyrhythm); } catch (e) { out.polyrhythm = null; }
    }
    if (p.polyBpm === undefined || p.polyBpm === null) { out.polyBpm = null; }
    else {
      var pb = Math.round(Number(p.polyBpm));
      out.polyBpm = isFinite(pb) && pb >= tempo.MIN_BPM && pb <= tempo.MAX_BPM ? pb : null;
    }
    out.lang = LANGS.indexOf(p.lang) >= 0 ? p.lang : (p.lang === 'auto' || p.lang === undefined ? DEFAULTS.lang : DEFAULTS.lang);
    out.theme = ['auto', 'light', 'dark'].indexOf(p.theme) >= 0 ? p.theme : DEFAULTS.theme;
    return out;
  }

  // —— base64url 编解码，浏览器与 Node 通用 / cross-environment base64url ——

  function bytesToB64Url(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) { bin += String.fromCharCode(bytes[i]); }
    var b64 = typeof btoa === 'function'
      ? btoa(bin)
      : Buffer.from(bytes).toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64UrlToBytes(str) {
    var b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) { b64 += '='; }
    if (typeof atob === 'function') {
      var bin = atob(b64);
      var bytes = [];
      for (var i = 0; i < bin.length; i++) { bytes.push(bin.charCodeAt(i)); }
      return bytes;
    }
    return Array.from(Buffer.from(b64, 'base64'));
  }

  function utf8Encode(str) {
    if (typeof TextEncoder === 'function') { return Array.from(new TextEncoder().encode(str)); }
    return Array.from(Buffer.from(str, 'utf8'));
  }

  function utf8Decode(bytes) {
    if (typeof TextDecoder === 'function') { return new TextDecoder().decode(new Uint8Array(bytes)); }
    return Buffer.from(bytes).toString('utf8');
  }

  /** 编码为 URL 分享码 / encode settings into a URL-safe share code */
  function encodeSettings(settings) {
    var clean = sanitizeSettings(settings);
    return bytesToB64Url(utf8Encode(JSON.stringify(clean)));
  }

  /** 解析分享码，失败返回 null / decode a share code; null on failure */
  function decodeSettings(code) {
    try {
      var json = utf8Decode(b64UrlToBytes(code));
      var data = JSON.parse(json);
      return sanitizeSettings(data);
    } catch (e) {
      return null;
    }
  }

  // —— 持久化 / persistence with injectable storage ——

  function loadSettings(storage) {
    if (!storage || typeof storage.getItem !== 'function') { return sanitizeSettings(null); }
    try {
      var raw = storage.getItem(STORAGE_KEY);
      if (!raw) { return sanitizeSettings(null); }
      return sanitizeSettings(JSON.parse(raw));
    } catch (e) {
      return sanitizeSettings(null);
    }
  }

  function saveSettings(storage, settings) {
    if (!storage || typeof storage.setItem !== 'function') { return false; }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(sanitizeSettings(settings)));
      return true;
    } catch (e) {
      return false;
    }
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    LANGS: LANGS,
    DEFAULTS: DEFAULTS,
    validateSettings: validateSettings,
    sanitizeSettings: sanitizeSettings,
    encodeSettings: encodeSettings,
    decodeSettings: decodeSettings,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    _bytesToB64Url: bytesToB64Url,
    _b64UrlToBytes: b64UrlToBytes
  };
}));
