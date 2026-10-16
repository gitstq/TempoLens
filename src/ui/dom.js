/**
 * TempoLens · ui/dom.js
 * 轻量 DOM 工具 / tiny DOM helpers.
 *
 * 零依赖 UMD 模块 / Zero-dependency UMD module.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.TempoLens = root.TempoLens || {};
  root.TempoLens.dom = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function $(selector, ctx) {
    return (ctx || document).querySelector(selector);
  }

  function $$(selector, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(selector));
  }

  /**
   * 创建元素 / create an element.
   * attrs 支持 class/text/html/dataset/on{Event} 及其余属性。
   */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) { return; }
        if (key === 'class') { node.className = value; }
        else if (key === 'text') { node.textContent = value; }
        else if (key === 'html') { node.innerHTML = value; }
        else if (key === 'dataset') { Object.keys(value).forEach(function (d) { node.dataset[d] = value[d]; }); }
        else if (/^on/.test(key) && typeof value === 'function') { node.addEventListener(key.slice(2).toLowerCase(), value); }
        else if (value === true) { node.setAttribute(key, ''); }
        else { node.setAttribute(key, String(value)); }
      });
    }
    (children || []).forEach(function (child) {
      if (child === null || child === undefined || child === false) { return; }
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) { node.removeChild(node.firstChild); }
  }

  function on(node, event, handler) {
    if (node) { node.addEventListener(event, handler); }
    return node;
  }

  /** 触发一次 CSS 类脉冲 / pulse a CSS class once */
  function pulse(node, className, duration) {
    if (!node) { return; }
    node.classList.remove(className);
    // 强制重排以重启动画 / force reflow so the animation restarts
    void node.offsetWidth;
    node.classList.add(className);
    if (duration) {
      setTimeout(function () { node.classList.remove(className); }, duration);
    }
  }

  /** 下载文本文件 / download a text file (browser only) */
  function downloadText(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /** 读取文件为文本 / read a File as text (browser only) */
  function readFileAsText(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(new Error('read failed')); };
      reader.readAsText(file);
    });
  }

  /** 复制文本 / copy text to clipboard (browser only) */
  function copyText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = el('textarea', { class: 'sr-copy' });
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }

  return { $: $, $$: $$, el: el, clear: clear, on: on, pulse: pulse, downloadText: downloadText, readFileAsText: readFileAsText, copyText: copyText };
}));
