/**
 * TempoLens · ui/icons.js
 * 内联 SVG 图标（24×24，stroke=currentColor，风格与 Lucide 一致）。
 * Inline SVG icons — no emoji, no icon font, no network requests.
 *
 * 零依赖 UMD 模块 / Zero-dependency UMD module.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.TempoLens = root.TempoLens || {};
  root.TempoLens.icons = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PATHS = {
    play: '<polygon points="6 3 20 12 6 21 6 3"></polygon>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="2"></rect>',
    hand: '<path d="M18 11V6.5a1.5 1.5 0 0 0-3 0V11"></path><path d="M15 10.5a1.5 1.5 0 0 0-3 0V12"></path><path d="M12 10.5a1.5 1.5 0 0 0-3 0V14"></path><path d="M9 12.5a1.5 1.5 0 0 0-3 0V17"></path><path d="M18 8.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.6-2.2L4 13.5a1.6 1.6 0 0 1 2.3-2.2L9 14"></path>',
    plus: '<path d="M12 5v14M5 12h14"></path>',
    minus: '<path d="M5 12h14"></path>',
    trash: '<path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>',
    share: '<circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"></path>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M7 10l5 5 5-5"></path><path d="M12 15V3"></path>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M17 8l-5-5-5 5"></path><path d="M12 3v12"></path>',
    chart: '<path d="M3 3v18h18"></path><rect x="7" y="12" width="3" height="6"></rect><rect x="12" y="8" width="3" height="10"></rect><rect x="17" y="4" width="3" height="14"></rect>',
    music: '<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>',
    settings: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>',
    globe: '<circle cx="12" cy="12" r="10"></circle><path d="M2 12h20"></path><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>',
    check: '<path d="M20 6L9 17l-5-5"></path>',
    close: '<path d="M18 6L6 18M6 6l12 12"></path>',
    up: '<path d="M18 15l-6-6-6 6"></path>',
    down: '<path d="M6 9l6 6 6-6"></path>',
    layers: '<path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path>',
    clock: '<circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path>',
    volume: '<path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>',
    volumeOff: '<path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M22 9l-6 6M16 9l6 6"></path>'
  };

  /** 返回 SVG 字符串 / return an SVG markup string */
  function icon(name, size, className) {
    var body = PATHS[name];
    if (!body) { return ''; }
    var s = size || 24;
    var cls = className ? ' class="' + className + '"' : '';
    return '<svg' + cls + ' width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  function has(name) { return Object.prototype.hasOwnProperty.call(PATHS, name); }

  return { icon: icon, has: has, names: Object.keys(PATHS) };
}));
