#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const childProcess = require('child_process');

const BASE_DIR = __dirname;
const FILES = {
  sharedState: path.join(BASE_DIR, 'shared-state.js'),
  sharedNav: path.join(BASE_DIR, 'shared-nav.js'),
  index: path.join(BASE_DIR, 'index.html'),
  userWallet: path.join(BASE_DIR, 'user-wallet.html'),
  userInvoices: path.join(BASE_DIR, 'user-invoices.html'),
  userRechargeDetail: path.join(BASE_DIR, 'user-recharge-detail.html'),
  userRecharge: path.join(BASE_DIR, 'user-recharge.html'),
  aggregatePayment: path.join(BASE_DIR, 'aggregate-payment.html'),
  userRefund: path.join(BASE_DIR, 'user-refund.html'),
  merchantScan: path.join(BASE_DIR, 'merchant-scan.html'),
  adminAccounts: path.join(BASE_DIR, 'admin-accounts.html'),
  adminAccountDetail: path.join(BASE_DIR, 'admin-account-detail.html'),
  adminOrders: path.join(BASE_DIR, 'admin-orders.html'),
  adminSettlements: path.join(BASE_DIR, 'admin-settlements.html'),
  merchantHome: path.join(BASE_DIR, 'merchant-home.html'),
  merchantOrders: path.join(BASE_DIR, 'merchant-orders.html'),
  merchantSettlements: path.join(BASE_DIR, 'merchant-settlements.html'),
  adminRefunds: path.join(BASE_DIR, 'admin-refunds.html'),
};

const results = [];
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    passCount++;
    results.push({ name, status: 'PASS' });
  } catch (err) {
    failCount++;
    results.push({ name, status: 'FAIL', message: err.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error((message || 'Assertion failed') + ': expected ' + expected + ', got ' + actual);
}

function assertApprox(actual, expected, message, epsilon = 0.001) {
  if (Math.abs(actual - expected) > epsilon) throw new Error((message || 'Assertion failed') + ': expected ' + expected + ', got ' + actual);
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readRequiredFile(filePath) {
  assert(fs.existsSync(filePath), 'Required file is missing: ' + filePath);
  return readFile(filePath);
}

function assertContains(source, expected, message) {
  assert(source.includes(expected), message + ': missing ' + JSON.stringify(expected));
}

function assertNotContains(source, forbidden, message) {
  assert(!source.includes(forbidden), message + ': found ' + JSON.stringify(forbidden));
}

function extractInlineScripts(html) {
  const scripts = [];
  const regex = /<script>([\s\S]*?)<\/script>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    scripts.push(match[1]);
  }
  return scripts;
}

function checkSyntax(name, code) {
  try {
    new vm.Script(code);
  } catch (err) {
    throw new Error('Syntax error in ' + name + ': ' + err.message);
  }
}

// Minimal DOM stub sufficient for page scripts
class MockElement {
  constructor(tagName) {
    this.tagName = String(tagName).toLowerCase();
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this._classList = new Set();
    this.children = [];
    this.eventListeners = {};
    this._innerHTML = '';
    this._textContent = '';
    this._parent = null;
    this._ownerDocument = null;
    this.value = '';
    this.disabled = false;
    this.open = false;
  }
  get className() { return Array.from(this._classList).join(' '); }
  set className(value) { this._classList = new Set(value.split(/\s+/).filter(Boolean)); }
  get id() { return this.getAttribute('id') || ''; }
  set id(value) { this.setAttribute('id', value); }
  get classList() {
    const self = this;
    return {
      add: (...classes) => classes.forEach(c => self._classList.add(c)),
      remove: (...classes) => classes.forEach(c => self._classList.delete(c)),
      contains: (c) => self._classList.has(c),
      toggle: (c, force) => {
        if (force === undefined) force = !self._classList.has(c);
        if (force) self._classList.add(c); else self._classList.delete(c);
        return force;
      }
    };
  }
  get innerHTML() {
    if (this._innerHTML) return this._innerHTML;
    return this.children.map(child => child.outerHTML).join('');
  }
  get outerHTML() {
    const attrs = Object.entries(this.attributes).map(([name, value]) => ` ${name}="${value}"`).join('');
    return `<${this.tagName}${attrs}>${this.innerHTML || this.textContent}</${this.tagName}>`;
  }
  set innerHTML(value) {
    this._innerHTML = value;
    this.children = [];
    const stack = [this];
    const tokenRegex = /<\/?([a-zA-Z0-9-]+)([^>]*)>|([^<]+)/g;
    const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    let token;
    while ((token = tokenRegex.exec(value)) !== null) {
      if (token[3]) {
        const text = token[3].replace(/\s+/g, ' ').trim();
        if (text) stack[stack.length - 1]._textContent += text;
        continue;
      }
      const full = token[0];
      const tagName = token[1].toLowerCase();
      if (full.startsWith('</')) {
        if (stack.length > 1) stack.pop();
        continue;
      }
      const el = new MockElement(tagName);
      const attrRegex = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
      let attr;
      while ((attr = attrRegex.exec(token[2])) !== null) {
        const value = attr[2] !== undefined ? attr[2] : attr[3] !== undefined ? attr[3] : attr[4];
        el.setAttribute(attr[1], value === undefined ? '' : value);
      }
      stack[stack.length - 1].appendChild(el);
      if (!voidTags.has(tagName) && !full.endsWith('/>')) stack.push(el);
    }
  }
  get textContent() { return this._textContent; }
  set textContent(value) { this._textContent = value; }
  getAttribute(name) { return this.attributes[name]; }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[key] = String(value);
    }
    if (name === 'value') this.value = String(value);
    if (name === 'class') this.className = String(value);
  }
  appendChild(child) {
    this.children.push(child);
    child._parent = this;
    child._setOwnerDocument(this._ownerDocument);
    return child;
  }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  replaceChildren(...children) {
    this.children = [];
    this._innerHTML = '';
    this._textContent = '';
    this.append(...children);
  }
  showModal() { this.open = true; }
  close() { this.open = false; }
  addEventListener(type, handler) {
    this.eventListeners[type] = this.eventListeners[type] || [];
    this.eventListeners[type].push(handler);
  }
  _dispatchClick(event) {
    event.currentTarget = this;
    (this.eventListeners.click || []).slice().forEach(handler => handler.call(this, event));
    if (!event._propagationStopped && !event.cancelBubble) {
      if (this._parent) this._parent._dispatchClick(event);
      else if (this._ownerDocument) this._ownerDocument.dispatchEvent('click', event);
    }
  }
  click(event = {}) {
    if (!event || typeof event !== 'object') event = {};
    if (!event.target) event.target = this;
    if (event.defaultPrevented === undefined) event.defaultPrevented = false;
    if (!event.preventDefault) event.preventDefault = () => { event.defaultPrevented = true; };
    if (!event.stopPropagation) event.stopPropagation = () => {
      event._propagationStopped = true;
      event.cancelBubble = true;
    };
    this._dispatchClick(event);
    return !event.defaultPrevented;
  }
  closest(selector) {
    let current = this;
    while (current) {
      if (matchesSelector(current, selector)) return current;
      current = current._parent;
    }
    return null;
  }
  _setOwnerDocument(doc) {
    this._ownerDocument = doc;
    this.children.forEach(child => child._setOwnerDocument(doc));
  }
  getElementById(id) { return this.querySelector('#' + id); }
  querySelector(sel) {
    const all = this.querySelectorAll(sel);
    return all.length ? all[0] : null;
  }
  querySelectorAll(sel) {
    const parts = sel.trim().split(/\s+/);
    let roots = [this];
    parts.forEach(selector => {
      const descendants = [];
      function collect(el) { el.children.forEach(child => { descendants.push(child); collect(child); }); }
      roots.forEach(collect);
      roots = descendants.filter(el => matchesSelector(el, selector));
    });
    return roots;
  }
}

function matchesSelector(el, selector) {
  const attr = selector.match(/\[([^=\]]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+)))?\]/);
  const base = selector.replace(/\[[^\]]+\]/g, '');
  let matches = true;
  if (base.startsWith('#')) matches = el.getAttribute('id') === base.slice(1);
  else if (base.startsWith('.')) matches = el.classList.contains(base.slice(1));
  else if (base) matches = el.tagName === base.toLowerCase();
  if (!matches || !attr) return matches;
  const actual = attr[1].startsWith('data-')
    ? el.dataset[attr[1].slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())]
    : el.getAttribute(attr[1]);
  const expected = attr[2] !== undefined ? attr[2] : attr[3] !== undefined ? attr[3] : attr[4];
  return actual !== undefined && (expected === undefined || actual === expected);
}

class MockDocument {
  constructor() {
    this.body = new MockElement('body');
    this.body._setOwnerDocument(this);
    this.elements = {};
    this.eventListeners = {};
  }
  createElement(tagName) {
    const element = new MockElement(tagName);
    element._setOwnerDocument(this);
    return element;
  }
  createDocumentFragment() { return this.createElement('fragment'); }
  getElementById(id) { return this.elements[id] || null; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) {
    const parts = sel.trim().split(/\s+/);
    if (parts.length > 1 && parts[0].startsWith('#')) {
      const root = this.getElementById(parts[0].slice(1));
      return root ? root.querySelectorAll(parts.slice(1).join(' ')) : [];
    }
    const seen = new Set();
    const all = [];
    function collect(el) {
      if (!seen.has(el)) {
        seen.add(el);
        if (matchesSelector(el, sel)) all.push(el);
      }
      el.children.forEach(collect);
    }
    collect(this.body);
    Object.values(this.elements).forEach(collect);
    return all;
  }
  registerElement(id, tagName = 'div') {
    if (!this.elements[id]) {
      this.elements[id] = this.createElement(tagName);
      this.elements[id].setAttribute('id', id);
    }
    return this.elements[id];
  }
  registerElements(ids) {
    ids.forEach(id => this.registerElement(id));
  }
  addEventListener(type, handler) {
    this.eventListeners[type] = this.eventListeners[type] || [];
    this.eventListeners[type].push(handler);
  }
  dispatchEvent(type, event = {}) {
    if (!event.target) event.target = this;
    if (event.defaultPrevented === undefined) event.defaultPrevented = false;
    if (!event.preventDefault) event.preventDefault = () => { event.defaultPrevented = true; };
    if (!event.stopPropagation) event.stopPropagation = () => {
      event._propagationStopped = true;
      event.cancelBubble = true;
    };
    event.currentTarget = this;
    (this.eventListeners[type] || []).slice().forEach(handler => handler.call(this, event));
    return !event.defaultPrevented;
  }
  click(event = {}) { this.dispatchEvent('click', event); }
}

function createPageContext(overrides = {}) {
  const store = overrides.store || {};
  const localStorageStub = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const doc = new MockDocument();
  const win = {
    localStorage: localStorageStub,
    document: doc,
    location: { href: overrides.href || 'file://' + BASE_DIR + '/' + (overrides.page || ''), search: overrides.search || '', hash: '', pathname: overrides.pathname || '/' },
    parkState: undefined,
    addEventListener: () => {},
    removeEventListener: () => {},
    history: { back: () => {} },
    URL: URL,
    URLSearchParams: URLSearchParams,
    encodeURIComponent: encodeURIComponent,
    decodeURIComponent: decodeURIComponent,
    Math: Math,
    Date: overrides.Date || Date,
    String: String,
    Number: Number,
    Array: Array,
    Set: Set,
    Map: Map,
    RegExp: RegExp,
    Error: Error,
    parseFloat: parseFloat,
    parseInt: parseInt,
    isNaN: isNaN,
    isFinite: isFinite,
    console: console,
    setTimeout: setTimeout,
    setInterval: setInterval,
    clearTimeout: clearTimeout,
    clearInterval: clearInterval,
  };
  win.window = win;

  return { doc, win, store };
}

function runSharedState(ctx) {
  const code = readFile(FILES.sharedState);
  vm.runInNewContext(code, ctx.win, { filename: 'shared-state.js' });
  return ctx.win.parkState;
}

function runPageScripts(pageName, ctx, html) {
  if (!ctx.win.parkState) runSharedState(ctx);
  const scripts = extractInlineScripts(html);
  scripts.forEach((script, index) => {
    try {
      vm.runInNewContext(script, ctx.win, { filename: pageName + '-inline-' + index + '.js' });
    } catch (err) {
      throw new Error('Error in ' + pageName + ' inline script ' + index + ': ' + err.message);
    }
  });
}

function textTree(element) {
  if (!element) return '';
  return [element.textContent, element.innerHTML].concat(element.children.map(textTree)).join(' ');
}

function tableHeaders(source, tableId) {
  const tablePattern = '<table\\b[^>]*id=["\\\']' + tableId + '["\\\'][^>]*>[\\s\\S]*?<thead[^>]*>[\\s\\S]*?<tr[^>]*>([\\s\\S]*?)<\\/tr>';
  const tableMatch = source.match(new RegExp(tablePattern, 'i'));
  assert(tableMatch, 'Missing table header for #' + tableId);
  return Array.from(tableMatch[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi), match => match[1].replace(/<[^>]+>/g, '').trim());
}

// Register elements needed by merchant-home
function registerMerchantHome(doc) {
  doc.registerElements(['hero-amount', 'hero-count', 'summary-amount', 'summary-count', 'recent-orders']);
  const statusFilter = doc.registerElement('collection-status-filter');
  [['all', '全部'], ['paid', '已收款'], ['refunded', '已退款']].forEach(([status, label], index) => {
    const button = doc.createElement('button');
    button.setAttribute('data-status', status);
    button.textContent = label;
    if (index === 0) button.classList.add('active');
    statusFilter.appendChild(button);
  });
  const time = doc.registerElement('collection-time-filter', 'select');
  time.value = '7d';
  doc.registerElement('date-dialog', 'dialog');
  doc.registerElement('date-start', 'input');
  doc.registerElement('date-end', 'input');
  doc.registerElement('apply-date', 'button');
}

// Register elements needed by merchant-orders
function registerMerchantOrders(doc) {
  doc.registerElements(['screen-list', 'screen-detail', 'order-list', 'detail-card', 'back-detail', 'apply-date', 'confirm-refund']);
  doc.getElementById('screen-list').classList.add('active');
  const tabsContainer = doc.registerElement('status-filter');
  [['all', '全部'], ['paid', '已收款'], ['refunded', '已退款']].forEach(([status, label], index) => {
    const tab = doc.createElement('button');
    tab.setAttribute('data-status', status);
    if (index === 0) tab.classList.add('active');
    tab.textContent = label;
    tabsContainer.appendChild(tab);
  });
  ['user-search', 'amount-min', 'amount-max', 'date-start', 'date-end'].forEach(id => doc.registerElement(id, 'input'));
  const time = doc.registerElement('time-filter', 'select');
  time.value = '7d';
  doc.registerElement('date-dialog', 'dialog');
  doc.registerElement('refund-dialog', 'dialog');
}

// Register elements needed by merchant-settlements
function registerMerchantSettlements(doc) {
  doc.registerElements(['month-order-count', 'month-income', 'month-share', 'month-refund', 'flow-list']);
  const filter = doc.registerElement('settlement-filter');
  [['all', '全部'], ['settled', '已分账'], ['pending', '待分账']].forEach(([status, label], index) => {
    const button = doc.createElement('button');
    button.setAttribute('data-status', status);
    button.textContent = label;
    if (index === 0) button.classList.add('active');
    filter.appendChild(button);
  });
}

function addMerchantSettlementOrder(parkState, overrides = {}) {
  const order = Object.assign({
    id: 'HZKF-TEST-ORDER',
    merchant: '海智咖啡 HUB',
    merchantId: 'M002',
    amount: 18,
    time: '2026-07-20 09:00',
    status: 'paid',
    refundDeadline: '2026-07-21 09:00'
  }, overrides);
  parkState.state.orders.push(order);
  return order;
}

function addSuccessfulSettlement(parkState, orderId, paymentRecordedAt, overrides = {}) {
  const settlement = Object.assign({
    id: 'SET-' + orderId + '-' + parkState.state.pendingSettlements.length,
    status: 'success',
    orderIds: [orderId],
    paymentRecordedAt: paymentRecordedAt
  }, overrides);
  parkState.state.pendingSettlements.push(settlement);
  return settlement;
}

function resetSettlementTestState(parkState) {
  parkState.resetForTests();
  parkState.state.orders = parkState.state.orders.filter(order => order.merchantId !== 'M002');
  parkState.state.pendingSettlements = parkState.state.pendingSettlements.filter(settlement =>
    !Array.isArray(settlement.orderIds) || settlement.orderIds.every(orderId => !String(orderId).startsWith('HZKF-'))
  );
}

function registerUserInvoices(doc) {
  doc.registerElements([
    'invoice-available-amount', 'apply-list', 'applied-section', 'applied-list',
    'titles-list', 'add-title-btn', 'apply-modal', 'apply-modal-close',
    'apply-order-card', 'title-select', 'apply-title-card', 'confirm-apply',
    'apply-add-entry', 'title-modal', 'title-modal-title', 'title-modal-close',
    'title-name', 'title-tax', 'title-address', 'title-phone', 'title-bank',
    'title-account', 'title-default', 'save-title'
  ]);
  [['apply', true], ['titles', false]].forEach(([name, active]) => {
    const tab = doc.createElement('button');
    tab.classList.add('tab');
    if (active) tab.classList.add('active');
    tab.setAttribute('data-tab', name);
    doc.body.appendChild(tab);
    const panel = doc.registerElement('panel-' + name);
    panel.classList.add('panel');
    if (active) panel.classList.add('active');
  });
}

function registerUserRecharge(doc) {
  doc.registerElements(['current-balance', 'pay-amount']);
  const grid = doc.registerElement('tier-grid');
  ['100', '200', '500', '1000'].forEach(amount => {
    const card = doc.createElement('div');
    card.classList.add('tier-card');
    card.setAttribute('data-amount', amount);
    if (amount === '200') card.classList.add('active');
    grid.appendChild(card);
  });
  doc.registerElement('custom-input', 'input');
  doc.registerElement('pay-btn', 'button');
  const moreButton = doc.registerElement('more-button', 'button');
  moreButton.setAttribute('aria-expanded', 'false');
  const moreMenu = doc.registerElement('more-menu');
  moreMenu.hidden = true;
  const refundLink = doc.createElement('a');
  refundLink.setAttribute('href', 'user-refund.html');
  refundLink.textContent = '注销';
  moreMenu.appendChild(refundLink);
}

// Register elements for user-refund
function registerUserRefund(doc) {
  doc.registerElements(['page-title', 'refund-amount', 'frozen-amount', 'primary-action', 'request-list', 'confirm-dialog', 'confirm-submit', 'cancel-submit']);
  doc.registerElement('refund-reason', 'textarea');
  doc.registerElements(['refund-list-view', 'refund-apply-view', 'refund-detail-view', 'detail-content', 'detail-back']);
  doc.getElementById('refund-list-view').hidden = false;
  doc.getElementById('refund-apply-view').hidden = true;
  doc.getElementById('refund-detail-view').hidden = true;
  doc.body.append(doc.getElementById('refund-list-view'), doc.getElementById('refund-apply-view'), doc.getElementById('refund-detail-view'));
}

// Register elements for admin-refunds
function registerAdminRefunds(doc) {
  doc.registerElements(['refund-table', 'progress-modal', 'progress-body', 'notice', 'refund-status-filter', 'close-progress']);
}

function registerAdminAccounts(doc) {
  doc.registerElements(['metric-user-count', 'metric-total-recharge', 'metric-available', 'metric-frozen', 'filter-keyword', 'accounts-body', 'query-button', 'reset-button', 'export-button']);
  const toggle = doc.registerElement('view-toggle');
  ['today', 'cumulative'].forEach(mode => {
    const button = doc.createElement('button');
    button.setAttribute('data-mode', mode);
    toggle.appendChild(button);
  });
}

function registerAdminAccountDetail(doc) {
  doc.registerElements(['user-card', 'user-name', 'user-phone', 'user-enterprise', 'user-balance', 'recharges-body', 'transactions-body']);
}

function registerAdminOrders(doc) {
  doc.registerElements(['metric-count', 'metric-amount', 'metric-refund-count', 'metric-refund-amount', 'quick-filters', 'custom-range', 'filter-start', 'filter-end', 'filter-keyword', 'filter-status', 'order-table', 'order-modal', 'modal-body', 'query-button', 'reset-button', 'export-button', 'modal-close', 'modal-close-btn']);
  ['today', 'yesterday', '7d', 'custom'].forEach(range => {
    const button = doc.createElement('button');
    button.setAttribute('data-range', range);
    doc.getElementById('quick-filters').appendChild(button);
  });
}

function forbiddenWordScan() {
  const terms = ['principal', 'gift', 'bonus', 'campaign', 'remainingGift', 'remainingPrincipal'];
  const sources = Object.values(FILES).filter(file => fs.existsSync(file));
  let found = [];
  sources.forEach(file => {
    const content = readFile(file);
    terms.forEach(term => {
      if (content.includes(term)) {
        found.push(file + ' contains forbidden word: ' + term);
      }
    });
  });
  if (found.length) throw new Error(found.join('\n'));
}

function stateConsistencyCheck(parkState) {
  assert(parkState.save(), 'State should be valid and persistable');
}

// Remove a merchant's demo orders plus dependent transactions/settlements so tests own the order list
function clearMerchantOrders(parkState, merchantId) {
  parkState.state.orders = parkState.state.orders.filter(o => o.merchantId !== merchantId);
  const orderIds = new Set(parkState.state.orders.map(o => o.id));
  parkState.state.transactions = parkState.state.transactions.filter(t => !t.orderId || orderIds.has(t.orderId));
  parkState.state.pendingSettlements = parkState.state.pendingSettlements.filter(s => s.orderIds.every(id => orderIds.has(id)));
}

// ====== Tests ======

test('Mock DOM: parses all supported data attribute forms', () => {
  const root = new MockElement('div');
  root.innerHTML = '<button data-double="one" data-single=\'two\' data-unquoted=three></button>';
  const button = root.querySelector('button');
  assert(button, 'Mock parser should create the button');
  assertEqual(button.dataset.double, 'one', 'Double-quoted data attribute');
  assertEqual(button.dataset.single, 'two', 'Single-quoted data attribute');
  assertEqual(button.dataset.unquoted, 'three', 'Unquoted data attribute');
});

test('Mock DOM: click exposes targets, bubbles, and supports preventDefault', () => {
  const doc = new MockDocument();
  const parent = doc.createElement('div');
  const child = doc.createElement('button');
  doc.body.appendChild(parent);
  parent.appendChild(child);
  const seen = [];
  child.addEventListener('click', event => { seen.push([event.target, event.currentTarget]); event.preventDefault(); });
  parent.addEventListener('click', event => seen.push([event.target, event.currentTarget]));
  doc.addEventListener('click', event => seen.push([event.target, event.currentTarget]));
  const event = {};
  child.click(event);
  assertEqual(seen.length, 3, 'Click should reach child, parent, and document');
  seen.forEach(entry => assertEqual(entry[0], child, 'Event target should remain the clicked element'));
  assertEqual(seen[0][1], child, 'Child currentTarget');
  assertEqual(seen[1][1], parent, 'Parent currentTarget');
  assertEqual(seen[2][1], doc, 'Document currentTarget');
  assertEqual(event.defaultPrevented, true, 'preventDefault should mark the event');
});

test('Mock DOM: closest supports tag, id, class, and data selectors', () => {
  const root = new MockElement('section');
  root.id = 'fixture';
  root.classList.add('container');
  root.setAttribute('data-role', 'root');
  const child = new MockElement('button');
  child.classList.add('action');
  child.setAttribute('data-key', 'save');
  root.appendChild(child);
  assertEqual(child.closest('button'), child, 'Closest tag');
  assertEqual(child.closest('.container'), root, 'Closest class');
  assertEqual(child.closest('#fixture'), root, 'Closest id');
  assertEqual(child.closest('[data-role="root"]'), root, 'Closest data selector');
  assertEqual(child.closest('[data-key]'), child, 'Closest data presence selector');
});

console.log('Running verification tests...\n');

// 1. Syntax checks
Object.entries(FILES).forEach(([name, file]) => {
  test('Syntax: ' + file, () => {
    const source = readRequiredFile(file);
    if (file.endsWith('.js')) {
      checkSyntax(name, source);
    } else {
      const scripts = extractInlineScripts(source);
      assert(scripts.length > 0, 'No inline scripts found in ' + file);
      scripts.forEach((code, i) => checkSyntax(name + ' inline-' + i, code));
    }
  });
});

// 2. Static page contracts for the V2 redesign
test('landing and shared navigation expose only active phase-one entries', () => {
  const landing = readRequiredFile(FILES.index);
  const nav = readRequiredFile(FILES.sharedNav);
  assertNotContains(landing, 'user-confirm.html', 'Landing page should remove legacy consumption confirmation');
  assertContains(landing, 'merchant-settlements.html', 'Landing page should expose merchant settlement management');
  assertNotContains(nav, 'user-confirm.html', 'Shared navigation should remove legacy consumption confirmation');
  assertContains(nav, "currentPath.startsWith('merchant-')", 'Shared navigation should choose the merchant group by page prefix');
  assertContains(nav, "currentPath.startsWith('admin-')", 'Shared navigation should choose the admin group by page prefix');
});

test('user invoice pages use shared invoice state only', () => {
  [FILES.userInvoices, FILES.userRechargeDetail].forEach(file => {
    const source = readRequiredFile(file);
    assertNotContains(source, 'parkInvoicesV2', path.basename(file) + ' should not use the legacy invoice storage key');
    assertContains(source, 'parkState.actions.applyInvoice', path.basename(file) + ' should submit invoices through shared state');
    assertContains(source, 'parkState.actions.createInvoiceTitle', path.basename(file) + ' should create titles through shared state');
  });
});

 test('user-wallet: links to invoices and recharge records without legacy invoice menu classes', () => {
  const source = readRequiredFile(FILES.userWallet);
  assertContains(source, 'href="user-invoices.html"', 'Wallet should link directly to invoices');
  assertContains(source, '充值记录', 'Wallet should expose recharge records');
  assertNotContains(source, 'invoice-menu-apply', 'Wallet should remove the old invoice application entry');
  assertNotContains(source, 'invoice-menu-titles', 'Wallet should remove the old invoice title entry');
});

test('user-refund: uses a single cancellation page with complete record fields', () => {
  const source = readRequiredFile(FILES.userRefund);
  assertNotContains(source, 'data-tab=', 'Cancellation page should not use the old tabs');
  ['注销编号', '申请时间', '注销金额', '申请原因', '退款路径', '进度', '提交注销申请'].forEach(text => {
    assertContains(source, text, 'Cancellation page should include required copy');
  });
});

test('admin-orders: has exactly the approved eight columns and no detail interaction', () => {
  const source = readRequiredFile(FILES.adminOrders);
  const expected = ['订单编号', '用户信息', '商户', '交易金额', '状态', '交易时间', '退款截止时间', '收款备注'];
  const actual = tableHeaders(source, 'orders-table');
  assertEqual(actual.length, 8, 'Admin orders should have exactly eight columns');
  expected.forEach((heading, index) => assertEqual(actual[index], heading, 'Admin orders column ' + (index + 1)));
  assertNotContains(source, '<th>操作</th>', 'Admin orders should remove the operation column');
  assertNotContains(source, '>详情<', 'Admin orders should remove the detail button');
  assert(!/<tr\b[^>]*\bonclick\s*=|\.addEventListener\(\s*["']click["'][^;]*showDetail/s.test(source), 'Admin order rows should not open details');
  assertNotContains(source, 'id="order-modal"', 'Admin orders should remove the old order modal');
  assertNotContains(source, 'showDetail(', 'Admin orders should remove the old detail handler');
});

test('user-invoices: renders recharge invoice states in descending recharge time', () => {
  const source = readRequiredFile(FILES.userInvoices);
  const ctx = createPageContext({ page: 'user-invoices.html' });
  const parkState = runSharedState(ctx);
  parkState.resetForTests();
  const title = { id: 'TITLE-1', parkId: 'park-001', userId: 'U001', name: '测试企业', taxId: 'TESTTAX123456789', address: '测试地址', phone: '010-1234567', bank: '测试银行', bankAccount: '1234567890', isDefault: true, deletedAt: null };
  parkState.state.invoiceTitles = [title];
  parkState.state.invoiceRecords = [
    { id: 'IR-PENDING', parkId: 'park-001', userId: 'U001', transactionId: 'RECHARGE-MIDDLE', titleId: 'TITLE-1', titleSnapshot: title, amount: 200, status: 'pending', createdAt: '2026-07-20 10:05', requestId: 'REQ-MIDDLE' },
    { id: 'IR-DONE', parkId: 'park-001', userId: 'U001', transactionId: 'RECHARGE-OLDEST', titleId: 'TITLE-1', titleSnapshot: title, amount: 100, status: 'issued', createdAt: '2026-07-20 10:06', requestId: 'REQ-OLDEST' }
  ];
  parkState.state.transactions = parkState.state.transactions.filter(item => item.type !== 'recharge');
  parkState.state.transactions.push(
    { id: 'RECHARGE-OLDEST', parkId: 'park-001', userId: 'U001', type: 'recharge', title: '最早充值', amount: 100, time: '2026-07-18 09:00', channel: '微信支付', status: 'success' },
    { id: 'RECHARGE-NEWEST', parkId: 'park-001', userId: 'U001', type: 'recharge', title: '最新充值', amount: 300, time: '2026-07-20 09:00', channel: '微信支付', status: 'success' },
    { id: 'RECHARGE-MIDDLE', parkId: 'park-001', userId: 'U001', type: 'recharge', title: '中间充值', amount: 200, time: '2026-07-19 09:00', channel: '微信支付', status: 'success' }
  );
  registerUserInvoices(ctx.doc);
  ctx.win.formatMoney = value => Number(value).toFixed(2);
  ctx.win.alert = () => {};
  ctx.win.confirm = () => true;
  runPageScripts('user-invoices', ctx, source);

  const rows = ctx.doc.querySelectorAll('.invoice-record');
  assertEqual(rows.length, 3, 'Exactly three recharge rows should be rendered');
  const expected = [
    ['RECHARGE-NEWEST', '最新充值', '未开票', true],
    ['RECHARGE-MIDDLE', '中间充值', '开票中', false],
    ['RECHARGE-OLDEST', '最早充值', '已开票', false]
  ];
  expected.forEach(([id, title, status, hasApplyButton], index) => {
    const row = rows[index];
    const rendered = textTree(row);
    assertEqual(row.dataset.transactionId, id, 'Recharge row ' + (index + 1) + ' transaction id');
    assert(rendered.includes(title), 'Recharge row ' + (index + 1) + ' should render ' + title);
    assert(rendered.includes(status), 'Recharge row ' + (index + 1) + ' should render ' + status);
    const button = row.querySelector('button');
    assertEqual(Boolean(button), hasApplyButton, status + ' apply button visibility');
    if (button) assertEqual(button.textContent, '申请开票', 'Uninvoiced row action');
  });
});

test('user-invoices: recharge row navigates to its detail page', () => {
  const source = readRequiredFile(FILES.userInvoices);
  const ctx = createPageContext({ page: 'user-invoices.html' });
  const parkState = runSharedState(ctx);
  parkState.resetForTests();
  registerUserInvoices(ctx.doc);
  ctx.win.formatMoney = value => Number(value).toFixed(2);
  ctx.win.alert = () => {};
  ctx.win.confirm = () => true;
  runPageScripts('user-invoices', ctx, source);

  const row = ctx.doc.querySelector('.invoice-record');
  assert(row, 'Recharge row should be rendered from shared-state transactions');
  const transactionId = row.dataset.transactionId;
  assert(transactionId, 'Recharge row should identify its transaction with data-transaction-id');
  row.click();
  assertEqual(
    ctx.win.location.href,
    'user-recharge-detail.html?id=' + encodeURIComponent(transactionId),
    'Recharge row should navigate to the matching detail page'
  );
});

test('user-invoices: invoice button stops row navigation and opens application modal', () => {
  const source = readRequiredFile(FILES.userInvoices);
  const ctx = createPageContext({ page: 'user-invoices.html' });
  const parkState = runSharedState(ctx);
  parkState.resetForTests();
  registerUserInvoices(ctx.doc);
  ctx.win.formatMoney = value => Number(value).toFixed(2);
  ctx.win.alert = () => {};
  ctx.win.confirm = () => true;
  runPageScripts('user-invoices', ctx, source);

  const row = ctx.doc.querySelector('.invoice-record');
  const invoiceButton = row && row.querySelector('button');
  assert(invoiceButton, 'Invoice application button should be rendered in a recharge row');
  const hrefBefore = ctx.win.location.href;
  let stopped = 0;
  const event = {
    target: invoiceButton,
    stopPropagation: () => { stopped++; event._propagationStopped = true; }
  };
  invoiceButton.click(event);
  const failures = [];
  if (stopped !== 1) failures.push('stopPropagation expected once, got ' + stopped);
  if (!ctx.doc.getElementById('apply-modal').classList.contains('active')) failures.push('application modal did not open');
  if (ctx.win.location.href !== hrefBefore) failures.push('row navigation changed location to ' + ctx.win.location.href);
  assertEqual(failures.length, 0, 'Invoice button interaction failed: ' + failures.join('; '));
});

test('user-recharge: more menu contains clicks and closes before cancellation link navigation', () => {
  const source = readRequiredFile(FILES.userRecharge);
  const ctx = createPageContext({ page: 'user-recharge.html' });
  const parkState = runSharedState(ctx);
  parkState.resetForTests();
  registerUserRecharge(ctx.doc);
  ctx.win.formatMoney = value => Number(value).toFixed(2);
  runPageScripts('user-recharge', ctx, source);

  const button = ctx.doc.getElementById('more-button');
  const menu = ctx.doc.getElementById('more-menu');
  const refundLink = menu.querySelector('a');
  assert(refundLink, 'More menu should contain a cancellation link');
  assertEqual(refundLink.getAttribute('href'), 'user-refund.html', 'Cancellation link target');

  button.click();
  assertEqual(button.getAttribute('aria-expanded'), 'true', 'More button should expose expanded state after click');
  assertEqual(menu.hidden, false, 'More menu should be visible after click');
  menu.click();
  assertEqual(button.getAttribute('aria-expanded'), 'true', 'Menu container click should not bubble to document close handler');
  assertEqual(menu.hidden, false, 'Menu container click should keep the menu visible');

  refundLink.click();
  assertEqual(button.getAttribute('aria-expanded'), 'false', 'Cancellation link click should collapse the more button');
  assertEqual(menu.hidden, true, 'Cancellation link click should hide the menu before navigation');

  button.click();
  ctx.doc.click();
  assertEqual(button.getAttribute('aria-expanded'), 'false', 'Document click should collapse the more button');
  assertEqual(menu.hidden, true, 'Document click should hide the more menu');
});

test('merchant-scan: remark is a fixed-height multiline textarea', () => {
  const source = readRequiredFile(FILES.merchantScan);
  assert(/<textarea\b[^>]*id=["']remark-input["'][^>]*maxlength=["']60["'][^>]*>/i.test(source), 'remark-input should be a textarea with maxlength="60"');
  assert(/#remark-input|\.remark-field\s+textarea/.test(source), 'Remark textarea should have a dedicated CSS selector');
  assert(/(?:#remark-input|\.remark-field\s+textarea)[^{]*\{[^}]*height\s*:\s*[^;}]+/s.test(source), 'Remark textarea CSS should set a fixed height');
  assert(/(?:#remark-input|\.remark-field\s+textarea)[^{]*\{[^}]*resize\s*:\s*none/s.test(source), 'Remark textarea CSS should disable resizing');
});

test('admin-accounts: uses new statistics groups and removes old columns', () => {
  const source = readRequiredFile(FILES.adminAccounts);
  assertContains(source, '本月统计', 'Admin accounts should show monthly statistics');
  assertContains(source, '整体统计', 'Admin accounts should show overall statistics');
  assertNotContains(source, '<th>储值内容</th>', 'Admin accounts should remove the old 储值内容 column');
  assertNotContains(source, '<th>类型</th>', 'Admin accounts should remove the old 类型 column');
});

test('admin-account-detail: shows enterprise and removes obsolete account and transaction fields', () => {
  const source = readRequiredFile(FILES.adminAccountDetail);
  assertContains(source, '所属企业', 'Account detail should show enterprise');
  assertNotContains(source, '账户类型', 'Account detail should remove account type');
  assertNotContains(source, '<th>交易名称</th>', 'Account detail should remove transaction name column');
  assertNotContains(source, '<th>用户信息</th>', 'Account detail should remove user information column');
});

test('phone display: admin pages render the full phone from shared state', () => {
  const cases = [
    { name: 'admin-accounts', file: FILES.adminAccounts, register: registerAdminAccounts, target: 'accounts-body' },
    { name: 'admin-account-detail', file: FILES.adminAccountDetail, register: registerAdminAccountDetail, target: 'user-card' },
    { name: 'admin-orders', file: FILES.adminOrders, register: registerAdminOrders, target: 'order-table' }
  ];
  cases.forEach(page => {
    const source = readRequiredFile(page.file);
    const ctx = createPageContext({ page: path.basename(page.file) });
    const parkState = runSharedState(ctx);
    parkState.resetForTests();
    if (page.name === 'admin-orders' && parkState.state.orders[0]) {
      const now = new Date();
      const pad2 = v => String(v).padStart(2, '0');
      parkState.state.orders[0].time = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate()) + ' 12:00';
    }
    const fullPhone = '186' + String(10000000 + cases.indexOf(page));
    parkState.state.user.phone = fullPhone;
    const sharedUser = parkState.state.users.find(u => u.id === 'U001' && u.parkId === 'park-001');
    if (sharedUser) sharedUser.phone = fullPhone;
    page.register(ctx.doc);
    ctx.win.formatMoney = value => Number(value).toFixed(2);
    ctx.win.exportTableCsv = () => {};
    runPageScripts(page.name, ctx, source);
    const rendered = page.name === 'admin-account-detail'
      ? ctx.doc.getElementById('user-phone').textContent
      : textTree(ctx.doc.getElementById(page.target));
    assert(rendered.includes(fullPhone), path.basename(page.file) + ' should render the complete shared-state phone');
    assert(!rendered.includes(fullPhone.slice(0, 3) + '****' + fullPhone.slice(-4)), path.basename(page.file) + ' should not mask the shared-state phone');
  });
});

test('admin-settlements: order-dimension rows render with status filter', () => {
  const source = readRequiredFile(FILES.adminSettlements);
  const ctx = createPageContext({ page: 'admin-settlements.html' });
  const parkState = runSharedState(ctx);
  parkState.resetForTests();
  ctx.doc.registerElements(['settlement-table', 'metric-count', 'metric-amount', 'metric-settled', 'metric-pending', 'filter-keyword', 'filter-status', 'query-button', 'reset-button', 'export-button']);
  ctx.win.formatMoney = value => Number(value).toFixed(2);
  ctx.win.exportTableCsv = () => {};
  runPageScripts('admin-settlements', ctx, source);

  const table = ctx.doc.getElementById('settlement-table');
  assert(table.innerHTML.includes('DMO-HZKF-Y01'), 'Settled demo order should render');
  assert(table.innerHTML.includes('已分账'), 'Should show 已分账 status');
  assert(table.innerHTML.includes('待分账'), 'Should show 待分账 status');
  assert(table.innerHTML.includes('80%'), 'M002 ratio should render as 80%');
  assert(Number(ctx.doc.getElementById('metric-count').textContent) > 0, 'Metric count should be positive');

  ctx.doc.getElementById('filter-status').value = 'settled';
  ctx.doc.getElementById('query-button').click();
  assert(!table.innerHTML.includes('待分账'), 'Settled filter should hide pending rows');
  assert(table.innerHTML.includes('DMO-HZKF-Y01'), 'Settled filter keeps settled rows');

  ctx.doc.getElementById('filter-status').value = 'pending';
  ctx.doc.getElementById('query-button').click();
  assert(!table.innerHTML.includes('DMO-HZKF-Y01'), 'Pending filter should hide settled rows');
  assert(table.innerHTML.includes('待分账'), 'Pending filter keeps pending rows');
});

test('phone display: merchant orders safely mask phone formats in rendered detail', () => {
  const cases = [
    { phone: '13912345678', expected: '139****5678' },
    { phone: '138-0013-1234' },
    { phone: '+8613800131234' },
    { phone: '1380013123' },
    { phone: '138001312345' },
    { phone: '138****1234', expected: '138****1234', preMasked: true }
  ];
  cases.forEach(({ phone, expected, preMasked }) => {
    const source = readRequiredFile(FILES.merchantOrders);
    const ctx = createPageContext({ page: 'merchant-orders.html' });
    const parkState = runSharedState(ctx);
    parkState.resetForTests();
    parkState.state.user.phone = phone;
    const created = parkState.actions.createPendingOrder('海智咖啡 HUB', 'M002', 18.00);
    assert(created.ok, 'createPendingOrder failed for ' + phone);
    assert(parkState.actions.consume(created.data.id).ok, 'consume failed for ' + phone);
    registerMerchantOrders(ctx.doc);
    ctx.win.formatMoney = value => Number(value).toFixed(2);
    runPageScripts('merchant-orders', ctx, source);

    const orderItem = ctx.doc.querySelector('.order-item');
    assert(orderItem, 'Merchant order row should be rendered for ' + phone);
    orderItem.click();
    const rendered = textTree(ctx.doc.getElementById('detail-card'));
    if (expected) assert(rendered.includes(expected), 'Merchant order detail should preserve the default mask for ' + phone);
    if (preMasked) {
      assert(rendered.includes(phone), 'Merchant order detail should preserve the pre-masked phone ' + phone);
    } else {
      assert(!rendered.includes(phone), 'Merchant order detail should not render the complete phone value ' + phone);
    }
  });
});

test('phone display: merchant settlements render phone behavior through DOM output', () => {
  const source = readRequiredFile(FILES.merchantSettlements);
  assert(/flow-list|settlement/i.test(source), 'merchant-settlements should contain its flow rendering structure');
});

// 3. Shared-state action tests
test('shared-state: selectors isolate park data including an empty park', () => {
  const parkState = runSharedState(createPageContext());
  parkState.resetForTests();
  assertEqual(parkState.selectors.getAccountsByPark('park-001').length > 0, true, 'park-001 should have accounts');
  assertEqual(parkState.selectors.getAccountsByPark('park-002').length > 0, true, 'park-002 should have accounts');
  assertEqual(parkState.selectors.getAccountsByPark('park-003').length, 0, 'park-003 should be empty');
  assert(parkState.selectors.getOrdersByPark('park-001').every(item => item.parkId === 'park-001'), 'park-001 orders should be isolated');
  assert(parkState.selectors.getOrdersByPark('park-002').every(item => item.parkId === 'park-002'), 'park-002 orders should be isolated');
  assertEqual(parkState.selectors.getAccount('park-001', 'U001').userId, 'U001', 'getAccount should resolve within the requested park');
  assertEqual(parkState.selectors.getAccount('park-002', 'U001'), null, 'getAccount should reject a user from another park');
});

test('shared-state: validation rejects cross-park references', () => {
  const parkState = runSharedState(createPageContext());
  parkState.resetForTests();
  const order = parkState.state.orders[0];
  order.parkId = order.parkId === 'park-001' ? 'park-002' : 'park-001';
  assertEqual(parkState.save(), false, 'Order should not reference a user or merchant from another park');
});

test('shared-state: park-002 recharge updates only its account and batches', () => {
  const parkState = runSharedState(createPageContext());
  parkState.resetForTests();
  const beforePrimary = JSON.stringify(parkState.selectors.getAccount('park-001', 'U001'));
  const beforeSecondaryTotal = parkState.selectors.getAccount('park-002', 'U002').total;
  const result = parkState.actions.recharge(10, 'PARK-002-RECHARGE', { parkId: 'park-002', userId: 'U002' });
  assert(result.ok, 'park-002 recharge should succeed: ' + result.code);
  assertEqual(JSON.stringify(parkState.selectors.getAccount('park-001', 'U001')), beforePrimary, 'park-001 account must not change');
  assertApprox(parkState.selectors.getAccount('park-002', 'U002').total, beforeSecondaryTotal + 10, 'park-002 total');
  assert(parkState.state.batches.some(batch => batch.requestId === 'PARK-002-RECHARGE' && batch.parkId === 'park-002' && batch.userId === 'U002'), 'Recharge batch should belong to park-002/U002');
});

test('shared-state: validation rejects cross-park batch allocations', () => {
  const parkState = runSharedState(createPageContext());
  parkState.resetForTests();
  const order = parkState.state.orders.find(item => item.parkId === 'park-001' && item.status === 'paid');
  order.batchAllocations = [{ batchId: parkState.state.batches.find(item => item.parkId === 'park-002').id, amount: order.amount }];
  assertEqual(parkState.save(), false, 'Order should not allocate a batch from another park');
});

test('shared-state: default settlement sync writes parkId and supports park-002 merchant', () => {
  const parkState = runSharedState(createPageContext());
  parkState.resetForTests();
  const result = parkState.actions.syncSettlements();
  assert(result.ok, 'Default settlement sync should succeed: ' + result.code);
  const settlement = parkState.state.pendingSettlements.find(item => item.merchantId === 'M201');
  assert(settlement, 'park-002 M201 settlement should be created');
  assertEqual(settlement.parkId, 'park-002', 'Settlement parkId');
});

test('shared-state: validation rejects invalid settlement park and cross-park order references', () => {
  const parkState = runSharedState(createPageContext());
  parkState.resetForTests();
  parkState.state.pendingSettlements[0].parkId = 'park-002';
  assertEqual(parkState.save(), false, 'Settlement should reject a park that differs from its merchant and orders');

  parkState.resetForTests();
  parkState.state.pendingSettlements[0].orderIds = ['HCST-2026071512100001'];
  assertEqual(parkState.save(), false, 'Settlement should reject an order from another park and merchant');
});

test('shared-state: validation rejects negative account balances', () => {
  const parkState = runSharedState(createPageContext());
  parkState.resetForTests();
  parkState.state.accounts[0].available = -0.01;
  assertEqual(parkState.save(), false, 'Negative available balance should be rejected');
  parkState.resetForTests();
  parkState.state.accounts[0].frozen = -0.01;
  assertEqual(parkState.save(), false, 'Negative frozen balance should be rejected');
});

 test('shared-state: default user and reconciliation row use full phone', () => {
  const parkState = runSharedState(createPageContext());
  parkState.resetForTests();
  assertEqual(parkState.state.user.phone, '13800131234', 'Default user phone');
  assertEqual(parkState.state.user.enterpriseName, '北京海开智慧园区科技有限公司', 'Default user enterprise');
  assertEqual(parkState.state.reconciliationRows[0].subject, '13800131234', 'Default reconciliation phone');
});

test('shared-state: missing or invalid stored user falls back without migration', () => {
  const sourceContext = createPageContext();
  const sourceState = runSharedState(sourceContext);
  sourceState.resetForTests();
  ['missing', 'invalid'].forEach(kind => {
    const legacy = JSON.parse(JSON.stringify(sourceState.state));
    const order = legacy.orders.find(item => item.merchantId === 'M001' && item.status === 'paid');
    order.id = 'O1001';
    order.time = '2026-07-19 08:07';
    if (kind === 'missing') delete legacy.user;
    else legacy.user = [];
    const fallback = runSharedState(createPageContext({ store: { parkStateV2: JSON.stringify(legacy) } }));
    assertEqual(fallback.state.user.phone, '13800131234', kind + ' user should use default fallback');
    assertEqual(fallback.state.orders.find(item => item.merchantId === 'M001' && item.status === 'paid').id, 'YQST-2026071412360001', kind + ' user should not migrate legacy order');
  });
});

test('shared-state: legacy stored user without enterpriseName still loads', () => {
  const sourceContext = createPageContext();
  const sourceState = runSharedState(sourceContext);
  sourceState.resetForTests();
  const legacy = JSON.parse(JSON.stringify(sourceState.state));
  delete legacy.user.enterpriseName;
  const storedName = legacy.user.name;
  const migrated = runSharedState(createPageContext({ store: { parkStateV2: JSON.stringify(legacy), parkStateV2Version: sourceContext.store.parkStateV2Version } }));
  assertEqual(migrated.state.user.name, storedName, 'Legacy user should not be replaced by defaults');
  assertEqual(migrated.state.user.phone, legacy.user.phone, 'Legacy user phone should be preserved');
  assertEqual(migrated.state.user.enterpriseName, undefined, 'Legacy user should not receive invented enterprise authentication data');
});

test('shared-state: pending order preserves multiline collection remark', () => {
  const parkState = runSharedState(createPageContext());
  parkState.resetForTests();
  const result = parkState.actions.createPendingOrder('海智咖啡 HUB', 'M002', 25.50, '午餐套餐\n少放辣');
  assert(result.ok, 'Pending order with multiline remark should be created');
  assertEqual(result.data.remark, '午餐套餐\n少放辣', 'Multiline remark should preserve its newline');
});

 test('shared-state: markRefundManualProcessing action exists and is transactional', () => {
  const ctx = createPageContext();
  const parkState = runSharedState(ctx);
  parkState.resetForTests();
  const applied = parkState.actions.applyBalanceRefund('测试人工处理');
  if (!applied.ok) console.error('applyBalanceRefund response:', applied);
  assert(applied.ok, 'applyBalanceRefund failed: ' + applied.code);
  const id = applied.data.id;
  const approved = parkState.actions.approveParkRefund(id);
  assert(approved.ok, 'approveParkRefund failed: ' + approved.code);
  const manual = parkState.actions.markRefundManualProcessing(id);
  assert(manual.ok, 'markRefundManualProcessing failed: ' + manual.code);
  assertEqual(parkState.state.refundRequests.find(r => r.id === id).status, 'manual_processing', 'status should be manual_processing');
  const again = parkState.actions.markRefundManualProcessing(id);
  assert(again.ok && again.idempotent, 'second call should be idempotent');
  const invalid = parkState.actions.markRefundManualProcessing('non-existent');
  assert(!invalid.ok, 'invalid id should fail');
});

test('shared-state: M002 order IDs increment within a fixed minute', () => {
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : ['2026-07-20T10:03:00'])); }
    static now() { return new RealDate('2026-07-20T10:03:00').getTime(); }
  }
  const ctx = createPageContext({ Date: FixedDate });
  const parkState = runSharedState(ctx);
  parkState.resetForTests();
  const first = parkState.actions.createPendingOrder('海智咖啡 HUB', 'M002', 10);
  const second = parkState.actions.createPendingOrder('海智咖啡 HUB', 'M002', 11);
  assert(first.ok && second.ok, 'Both orders should be created');
  assertEqual(first.data.id, 'HZKF-2026072010030001', 'First fixed-minute order ID');
  assertEqual(second.data.id, 'HZKF-2026072010030002', 'Second fixed-minute order ID');
});

test('shared-state: legacy stored order IDs and references migrate on reload', () => {
  const source = createPageContext();
  const sourceState = runSharedState(source);
  sourceState.resetForTests();
  const legacy = JSON.parse(JSON.stringify(sourceState.state));
  const order = legacy.orders.find(item => item.merchantId === 'M001' && item.status === 'paid');
  const oldId = 'O1001';
  order.id = oldId;
  const transaction = legacy.transactions.find(item => item.type === 'consume');
  transaction.orderId = oldId;
  legacy.pendingSettlements[0].orderIds = [oldId];
  delete legacy.merchantConfig.M001.prefix;
  delete legacy.merchantConfig.M002.prefix;
  delete legacy.merchantConfig.M003.prefix;

  const store = { parkStateV2: JSON.stringify(legacy), parkStateV2Version: source.store.parkStateV2Version };
  const migratedContext = createPageContext({ store });
  const migrated = runSharedState(migratedContext);
  const expectedId = 'YQST-2026071412360001';
  assertEqual(migrated.state.orders.find(item => item.merchantId === 'M001' && item.status === 'paid').id, expectedId, 'Legacy order ID should migrate');
  assertEqual(migrated.state.transactions.find(item => item.type === 'consume').orderId, expectedId, 'Transaction orderId should migrate');
  assertEqual(migrated.state.pendingSettlements[0].orderIds[0], expectedId, 'Settlement orderIds should migrate');
  assertEqual(migrated.state.merchantConfig.M001.prefix, 'YQST', 'M001 prefix should be filled');
  assertEqual(migrated.state.merchantConfig.M002.prefix, 'HZKF', 'M002 prefix should be filled');
  assertEqual(migrated.state.merchantConfig.M003.prefix, 'YQBLD', 'M003 prefix should be filled');
  assert(migrated.save(), 'Migrated state should pass public validation and save');
});

// 3. merchant-home tests
test('merchant-home: filter tabs update summary and recent orders', () => {
  const ctx = createPageContext({ page: 'merchant-home.html' });
  const parkState = runSharedState(ctx);
  parkState.resetForTests();
  clearMerchantOrders(parkState, 'M002');
  const created = parkState.actions.createPendingOrder('海智咖啡 HUB', 'M002', 18.00);
  assert(created.ok, 'createPendingOrder failed');
  assert(parkState.actions.consume(created.data.id).ok, 'consume failed');
  registerMerchantHome(ctx.doc);
  const html = readFile(FILES.merchantHome);
  runPageScripts('merchant-home', ctx, html);

  const orderList = ctx.doc.getElementById('recent-orders');
  assert(orderList.innerHTML.includes(created.data.id), 'Should render recent orders');
  assert(orderList.innerHTML.includes('已收款'), 'Paid order should use 已收款 label');
  assert(!orderList.innerHTML.includes('退款中'), 'Recent orders should not show 退款中');
  assertEqual(ctx.doc.getElementById('hero-count').textContent, 1, 'Paid count initially');
  assertEqual(ctx.doc.getElementById('hero-amount').textContent, '18.00', 'Paid amount initially');

  const refundedTab = ctx.doc.querySelector('#collection-status-filter button[data-status="refunded"]');
  assert(refundedTab, 'Refunded filter button should exist');
  refundedTab.click();
  assert(!ctx.doc.getElementById('recent-orders').innerHTML.includes(created.data.id), 'Paid order hidden after refund filter');
});

test('merchant-home: clicking order navigates to merchant-orders with orderId', () => {
  const ctx = createPageContext({ page: 'merchant-home.html' });
  const parkState = runSharedState(ctx);
  parkState.resetForTests();
  const created = parkState.actions.createPendingOrder('海智咖啡 HUB', 'M002', 18.00);
  assert(created.ok, 'createPendingOrder failed');
  assert(parkState.actions.consume(created.data.id).ok, 'consume failed');
  registerMerchantHome(ctx.doc);
  const html = readFile(FILES.merchantHome);
  runPageScripts('merchant-home', ctx, html);
  const orderItem = ctx.doc.querySelector('.order-item');
  if (!orderItem) throw new Error('No order item rendered');
  orderItem.click();
  // Implementation should set window.location.href to merchant-orders.html?orderId=...
  assert(ctx.win.location.href.includes('merchant-orders.html'), 'Should navigate to merchant-orders');
  assert(ctx.win.location.href.includes('orderId='), 'Should include orderId param');
});

// 4. merchant-orders tests
test('merchant-orders: full refund via parkState.actions.refundConsume', () => {
  const ctx = createPageContext({ page: 'merchant-orders.html', search: '?status=paid' });
  const parkState = runSharedState(ctx);
  parkState.resetForTests();
  // Create a paid order for merchant M002 that can be refunded
  clearMerchantOrders(parkState, 'M002');
  const created = parkState.actions.createPendingOrder('海智咖啡 HUB', 'M002', 25.00);
  assert(created.ok, 'createPendingOrder failed');
  const consumed = parkState.actions.consume(created.data.id);
  assert(consumed.ok, 'consume failed');
  const beforeTotal = parkState.state.wallet.total;

  registerMerchantOrders(ctx.doc);
  const html = readFile(FILES.merchantOrders);
  runPageScripts('merchant-orders', ctx, html);

  // The page should render with paid filter active
  const orderList = ctx.doc.getElementById('order-list');
  assert(orderList.innerHTML.includes(created.data.id), 'Should render paid order');

  // Click order item to show detail
  const orderItem = orderList.querySelector('.order-item');
  assert(orderItem, 'No order item found');
  orderItem.click();
  const detailCard = ctx.doc.getElementById('detail-card');
  assert(detailCard.innerHTML.includes('已收款'), 'Paid order detail should use 已收款 label');
  assert(!detailCard.innerHTML.includes('退款中'), 'Paid order detail should not show 退款中');
  const refundBtn = detailCard.querySelector('button');
  assert(refundBtn && refundBtn.textContent === '退款', 'Should show refund button');

  // Click refund button (open modal) then confirm
  refundBtn.click();
  assert(ctx.doc.getElementById('refund-dialog').open, 'Refund dialog should open');
  const modalConfirm = ctx.doc.getElementById('confirm-refund');
  modalConfirm.click();

  const order = parkState.state.orders.find(o => o.id === created.data.id);
  assertEqual(order.status, 'refunded', 'Order should be refunded');
  assertApprox(parkState.state.wallet.total, beforeTotal + 25.00, 'Wallet should be restored');
});

test('merchant-orders: expired paid order shows non-refundable message', () => {
  const ctx = createPageContext({ page: 'merchant-orders.html', search: '?status=paid' });
  const parkState = runSharedState(ctx);
  parkState.resetForTests();
  // Create a paid order with past deadline
  const created = parkState.actions.createPendingOrder('海智咖啡 HUB', 'M002', 10.00);
  parkState.actions.consume(created.data.id);
  const order = parkState.state.orders.find(o => o.id === created.data.id);
  order.refundDeadline = '2020-01-01 00:00';
  parkState.save();

  registerMerchantOrders(ctx.doc);
  const html = readFile(FILES.merchantOrders);
  runPageScripts('merchant-orders', ctx, html);

  const orderList = ctx.doc.getElementById('order-list');
  const orderItem = orderList.querySelector('.order-item');
  assert(orderItem, 'No order item found');
  orderItem.click();
  const detailCard = ctx.doc.getElementById('detail-card');
  assert(detailCard.innerHTML.includes('不可退款'), 'Should show non-refundable message');
  const refundBtn = detailCard.querySelector('button');
  assert(refundBtn && refundBtn.textContent === '退款', 'Should retain refund action label');
  assert(refundBtn.disabled, 'Expired refund button should be disabled');
});

// 5. merchant-settlements tests
test('merchant-settlements: renders complete masked flow cards', () => {
  const ctx = createPageContext({ page: 'merchant-settlements.html' });
  const parkState = runSharedState(ctx);
  parkState.resetForTests();
  parkState.state.user.name = '测试用户';
  parkState.state.user.phone = '13812341234';
  parkState.state.transactions.push({
    id: 'TX-FLOW-1',
    type: 'consume',
    title: '现磨咖啡消费',
    amount: -18,
    orderId: 'HZKF-2026071414180001',
    time: '2026-07-14 14:18',
    status: 'success'
  });
  registerMerchantSettlements(ctx.doc);
  runPageScripts('merchant-settlements', ctx, readFile(FILES.merchantSettlements));

  const flowList = ctx.doc.getElementById('flow-list');
  const targetCard = flowList.querySelector('[data-order-id="HZKF-2026071414180001"]');
  assert(targetCard, 'Missing target flow card: HZKF-2026071414180001');

  const cardHtml = targetCard.innerHTML;
  [
    'HZKF-2026071414180001',
    '现磨咖啡消费',
    '测***户_138****1234',
    '¥18.00',
    '¥14.40',
    '2026-07-14 14:18',
    '待分账'
  ].forEach(text => assert(cardHtml.includes(text), 'Missing flow field in target card: ' + text));
  assert(!cardHtml.includes('测试用户'), 'Target flow card should not expose raw user name');
  assert(!cardHtml.includes('13812341234'), 'Target flow card should not expose raw phone number');
});

test('merchant-settlements: successful settlement renders settled status and recorded time', () => {
  const ctx = createPageContext({ page: 'merchant-settlements.html' });
  const parkState = runSharedState(ctx);
  resetSettlementTestState(parkState);
  const order = addMerchantSettlementOrder(parkState, { id: 'HZKF-SUCCESS-TIME' });
  addSuccessfulSettlement(parkState, order.id, '2026-07-20 09:15');
  registerMerchantSettlements(ctx.doc);
  runPageScripts('merchant-settlements', ctx, readFile(FILES.merchantSettlements));

  const card = ctx.doc.querySelector('[data-order-id="HZKF-SUCCESS-TIME"]');
  assert(card, 'Successful settlement card should exist');
  assert(card.innerHTML.includes('已分账'), 'Successful settlement card should show 已分账');
  assert(card.innerHTML.includes('2026-07-20 09:15'), 'Successful settlement card should show paymentRecordedAt');
});

test('merchant-settlements: multiple successful settlements render latest recorded time', () => {
  const ctx = createPageContext({ page: 'merchant-settlements.html' });
  const parkState = runSharedState(ctx);
  resetSettlementTestState(parkState);
  const order = addMerchantSettlementOrder(parkState, { id: 'HZKF-LATEST-TIME' });
  addSuccessfulSettlement(parkState, order.id, '2026-07-19 08:00');
  addSuccessfulSettlement(parkState, order.id, '2026-07-21 10:30');
  registerMerchantSettlements(ctx.doc);
  runPageScripts('merchant-settlements', ctx, readFile(FILES.merchantSettlements));

  const card = ctx.doc.querySelector('[data-order-id="HZKF-LATEST-TIME"]');
  assert(card, 'Multiple-settlement card should exist');
  assert(card.innerHTML.includes('2026-07-21 10:30'), 'Card should show latest successful settlement time');
  assert(!card.innerHTML.includes('2026-07-19 08:00'), 'Card should not show older successful settlement time');
});

test('merchant-settlements: successful settlement without time renders missing-time label', () => {
  const ctx = createPageContext({ page: 'merchant-settlements.html' });
  const parkState = runSharedState(ctx);
  resetSettlementTestState(parkState);
  const order = addMerchantSettlementOrder(parkState, { id: 'HZKF-MISSING-TIME' });
  addSuccessfulSettlement(parkState, order.id, null);
  registerMerchantSettlements(ctx.doc);
  runPageScripts('merchant-settlements', ctx, readFile(FILES.merchantSettlements));

  const card = ctx.doc.querySelector('[data-order-id="HZKF-MISSING-TIME"]');
  assert(card, 'Missing-time settlement card should exist');
  assert(card.innerHTML.includes('已分账'), 'Success without a time should still show 已分账');
  assert(card.innerHTML.includes('时间未记录'), 'Success without a time should show 时间未记录');
});

test('merchant-settlements: non-success settlement statuses remain pending', () => {
  const ctx = createPageContext({ page: 'merchant-settlements.html' });
  const parkState = runSharedState(ctx);
  resetSettlementTestState(parkState);
  ['pending', 'processing', 'failed'].forEach((status, index) => {
    const order = addMerchantSettlementOrder(parkState, { id: 'HZKF-NON-SUCCESS-' + status, time: '2026-07-20 09:0' + index });
    parkState.state.pendingSettlements.push({
      id: 'SET-NON-SUCCESS-' + status,
      status: status,
      orderIds: [order.id],
      paymentRecordedAt: '2026-07-20 10:0' + index
    });
  });
  registerMerchantSettlements(ctx.doc);
  runPageScripts('merchant-settlements', ctx, readFile(FILES.merchantSettlements));

  ['pending', 'processing', 'failed'].forEach(status => {
    const card = ctx.doc.querySelector('[data-order-id="HZKF-NON-SUCCESS-' + status + '"]');
    assert(card, status + ' settlement card should exist');
    assert(card.innerHTML.includes('待分账'), status + ' settlement should show 待分账');
    assert(!card.innerHTML.includes('已分账'), status + ' settlement should not show 已分账');
  });
});

test('merchant-settlements: missing consume transaction falls back to merchant consumption name', () => {
  const ctx = createPageContext({ page: 'merchant-settlements.html' });
  const parkState = runSharedState(ctx);
  resetSettlementTestState(parkState);
  addMerchantSettlementOrder(parkState, { id: 'HZKF-NAME-FALLBACK' });
  registerMerchantSettlements(ctx.doc);
  runPageScripts('merchant-settlements', ctx, readFile(FILES.merchantSettlements));

  const card = ctx.doc.querySelector('[data-order-id="HZKF-NAME-FALLBACK"]');
  assert(card, 'Fallback-name card should exist');
  assert(card.innerHTML.includes('海智咖啡 HUB 消费'), 'Card should use merchant consumption fallback name');
});

test('merchant-settlements: filters cards without changing monthly metrics', () => {
  const ctx = createPageContext({ page: 'merchant-settlements.html' });
  const parkState = runSharedState(ctx);
  resetSettlementTestState(parkState);
  const settledOrder = addMerchantSettlementOrder(parkState, { id: 'HZKF-FILTER-SETTLED', amount: 20 });
  addMerchantSettlementOrder(parkState, { id: 'HZKF-FILTER-PENDING', amount: 30, time: '2026-07-20 09:01' });
  addSuccessfulSettlement(parkState, settledOrder.id, '2026-07-20 10:00');
  registerMerchantSettlements(ctx.doc);
  runPageScripts('merchant-settlements', ctx, readFile(FILES.merchantSettlements));

  const settledButton = ctx.doc.querySelector('#settlement-filter button[data-status="settled"]');
  const pendingButton = ctx.doc.querySelector('#settlement-filter button[data-status="pending"]');
  assert(settledButton, 'Settled filter button should exist');
  assert(pendingButton, 'Pending filter button should exist');
  assert(ctx.doc.querySelector('[data-order-id="HZKF-FILTER-SETTLED"]'), 'All filter should show settled card');
  assert(ctx.doc.querySelector('[data-order-id="HZKF-FILTER-PENDING"]'), 'All filter should show pending card');
  const metricIds = ['month-order-count', 'month-income', 'month-share', 'month-refund'];
  const metricsBefore = metricIds.map(id => ctx.doc.getElementById(id).textContent);

  settledButton.click();
  assert(ctx.doc.querySelector('[data-order-id="HZKF-FILTER-SETTLED"]'), 'Settled filter should show settled card');
  assert(!ctx.doc.querySelector('[data-order-id="HZKF-FILTER-PENDING"]'), 'Settled filter should hide pending card');
  metricIds.forEach((id, index) => assertEqual(ctx.doc.getElementById(id).textContent, metricsBefore[index], id + ' after settled filter'));

  pendingButton.click();
  assert(!ctx.doc.querySelector('[data-order-id="HZKF-FILTER-SETTLED"]'), 'Pending filter should hide settled card');
  assert(ctx.doc.querySelector('[data-order-id="HZKF-FILTER-PENDING"]'), 'Pending filter should show pending card');
  metricIds.forEach((id, index) => assertEqual(ctx.doc.getElementById(id).textContent, metricsBefore[index], id + ' after pending filter'));
});

test('merchant-settlements: all filter shows empty state without paid merchant orders', () => {
  const ctx = createPageContext({ page: 'merchant-settlements.html' });
  const parkState = runSharedState(ctx);
  resetSettlementTestState(parkState);
  registerMerchantSettlements(ctx.doc);
  runPageScripts('merchant-settlements', ctx, readFile(FILES.merchantSettlements));

  const flowList = ctx.doc.getElementById('flow-list');
  assert(flowList.innerHTML.includes('暂无分账流水'), 'All filter should show empty message');
  assertEqual(flowList.querySelectorAll('.flow-card').length, 0, 'All empty state should render no flow cards');
});

test('merchant-settlements: settled filter shows empty state when no order is settled', () => {
  const ctx = createPageContext({ page: 'merchant-settlements.html' });
  const parkState = runSharedState(ctx);
  resetSettlementTestState(parkState);
  addMerchantSettlementOrder(parkState, { id: 'HZKF-EMPTY-SETTLED' });
  registerMerchantSettlements(ctx.doc);
  runPageScripts('merchant-settlements', ctx, readFile(FILES.merchantSettlements));

  const settledButton = ctx.doc.querySelector('#settlement-filter button[data-status="settled"]');
  assert(settledButton, 'Settled filter button should exist for empty-state test');
  settledButton.click();
  const flowList = ctx.doc.getElementById('flow-list');
  assert(flowList.innerHTML.includes('暂无已分账流水'), 'Settled filter should show settled empty message');
  assertEqual(flowList.querySelectorAll('.flow-card').length, 0, 'Settled empty state should render no flow cards');
});

test('merchant-settlements: pending filter shows empty state when every order is settled', () => {
  const ctx = createPageContext({ page: 'merchant-settlements.html' });
  const parkState = runSharedState(ctx);
  resetSettlementTestState(parkState);
  const order = addMerchantSettlementOrder(parkState, { id: 'HZKF-EMPTY-PENDING' });
  addSuccessfulSettlement(parkState, order.id, '2026-07-20 10:00');
  registerMerchantSettlements(ctx.doc);
  runPageScripts('merchant-settlements', ctx, readFile(FILES.merchantSettlements));

  const pendingButton = ctx.doc.querySelector('#settlement-filter button[data-status="pending"]');
  assert(pendingButton, 'Pending filter button should exist for empty-state test');
  pendingButton.click();
  const flowList = ctx.doc.getElementById('flow-list');
  assert(flowList.innerHTML.includes('暂无待分账流水'), 'Pending filter should show pending empty message');
  assertEqual(flowList.querySelectorAll('.flow-card').length, 0, 'Pending empty state should render no flow cards');
});

test('merchant-settlements: pre-masked user values remain unchanged', () => {
  const ctx = createPageContext({ page: 'merchant-settlements.html' });
  const parkState = runSharedState(ctx);
  resetSettlementTestState(parkState);
  parkState.state.user.name = '用***户';
  parkState.state.user.phone = '138****1234';
  addMerchantSettlementOrder(parkState, { id: 'HZKF-MASK-IDEMPOTENT' });
  registerMerchantSettlements(ctx.doc);
  runPageScripts('merchant-settlements', ctx, readFile(FILES.merchantSettlements));

  const card = ctx.doc.querySelector('[data-order-id="HZKF-MASK-IDEMPOTENT"]');
  assert(card, 'Pre-masked user card should exist');
  assert(card.innerHTML.includes('用***户_138****1234'), 'Card should preserve pre-masked values exactly');
  assert(!card.innerHTML.includes('用******户'), 'Card should not mask an already masked name again');
  assert(!card.innerHTML.includes('138********1234'), 'Card should not mask an already masked phone again');
});

// 6. user-refund tests
test('user-refund: renders requests by descending createdAt with refund path copy', () => {
  const ctx = createPageContext({ page: 'user-refund.html' });
  const parkState = runSharedState(ctx);
  parkState.resetForTests();
  parkState.state.refundRequests = [
    { id: 'RR-NEWER', parkId: 'park-001', userId: 'U001', amount: 88, frozenAmount: 88, batchAllocations: [], createdAt: '2026-07-20 11:00', status: 'pending_review', notes: '较新申请' },
    { id: 'RR-OLDER', parkId: 'park-001', userId: 'U001', amount: 66, frozenAmount: 66, batchAllocations: [], createdAt: '2026-07-18 09:00', status: 'rejected', notes: '较早申请' },
    { id: 'RR-OTHER-PARK', parkId: 'park-002', userId: 'U002', amount: 55, frozenAmount: 55, batchAllocations: [], createdAt: '2026-07-21 09:00', status: 'pending_review', notes: '其他园区申请' }
  ];
  registerUserRefund(ctx.doc);
  runPageScripts('user-refund', ctx, readFile(FILES.userRefund));

  const renderedRows = ctx.doc.getElementById('request-list').children;
  assertEqual(renderedRows.length, 2, 'Both preset refund requests should be rendered');
  assert(textTree(renderedRows[0]).includes('RR-NEWER'), 'Request with newer createdAt should render first');
  assert(textTree(renderedRows[0]).includes('原支付路径'), 'First request should include the fixed refund path copy');
  assert(textTree(renderedRows[1]).includes('RR-OLDER'), 'Request with older createdAt should render second');
});

test('user-refund: clicking a request opens detail view and back returns to list', () => {
  const ctx = createPageContext({ page: 'user-refund.html' });
  const parkState = runSharedState(ctx);
  parkState.resetForTests();
  parkState.state.refundRequests = [
    { id: 'RR-DETAIL', parkId: 'park-001', userId: 'U001', amount: 88, frozenAmount: 88, batchAllocations: [], createdAt: '2026-07-20 11:00', status: 'pending_review', notes: '详情查看' }
  ];
  registerUserRefund(ctx.doc);
  runPageScripts('user-refund', ctx, readFile(FILES.userRefund));

  const card = ctx.doc.getElementById('request-list').children[0];
  assert(card, 'Request card should render');
  card.click();
  assert(ctx.doc.getElementById('refund-list-view').hidden, 'List view should hide in detail');
  assert(!ctx.doc.getElementById('refund-detail-view').hidden, 'Detail view should show');
  const detailText = textTree(ctx.doc.getElementById('detail-content'));
  assert(detailText.includes('RR-DETAIL'), 'Detail should show request id');
  assert(detailText.includes('冻结金额'), 'Detail should show frozen amount row');
  assert(detailText.includes('详情查看'), 'Detail should show request notes');
  assert(ctx.doc.getElementById('primary-action').hidden, 'Primary action should hide in detail');

  ctx.doc.getElementById('detail-back').click();
  assert(!ctx.doc.getElementById('refund-list-view').hidden, 'Back should return to list view');
  assert(ctx.doc.getElementById('refund-detail-view').hidden, 'Detail view should hide after back');
  assert(!ctx.doc.getElementById('primary-action').hidden, 'Primary action should restore after back');
});

test('user-refund: submit returns to list and renders newest request first', () => {
  const ctx = createPageContext({ page: 'user-refund.html' });
  const parkState = runSharedState(ctx);
  parkState.resetForTests();
  registerUserRefund(ctx.doc);
  const html = readFile(FILES.userRefund);
  runPageScripts('user-refund', ctx, html);

  const beforeRequests = parkState.state.refundRequests.length;
  const primaryAction = ctx.doc.getElementById('primary-action');
  primaryAction.click();
  assert(ctx.doc.getElementById('refund-list-view').hidden, 'List view should hide while applying');
  assert(!ctx.doc.getElementById('refund-apply-view').hidden, 'Application view should show while applying');
  primaryAction.click();
  assert(ctx.doc.getElementById('confirm-dialog').classList.contains('active'), 'Confirmation dialog should open');
  ctx.doc.getElementById('confirm-submit').click();
  assertEqual(parkState.state.refundRequests.length, beforeRequests + 1, 'Should create one refund request');
  const submittedRequest = parkState.state.refundRequests.find(request => request.notes === '用户申请注销');
  assert(submittedRequest, 'New refund request should be present in storage');
  assertEqual(submittedRequest.status, 'pending_review', 'Status pending_review');
  assert(!ctx.doc.getElementById('refund-list-view').hidden, 'List view should be visible after successful submission');
  assert(ctx.doc.getElementById('refund-apply-view').hidden, 'Application view should be hidden after successful submission');
  const renderedRows = ctx.doc.getElementById('request-list').children;
  assert(renderedRows.length > 0, 'Request list should render submitted records');
  assert(textTree(renderedRows[0]).includes(submittedRequest.id), 'Submitted request should be first by descending createdAt');
  assert(textTree(renderedRows[0]).includes('原支付路径'), 'Submitted request should include the fixed refund path copy');
});

// 6. admin-refunds tests
test('admin-refunds: first review, reject, second review, manual processing', () => {
  const ctx = createPageContext({ page: 'admin-refunds.html' });
  const parkState = runSharedState(ctx);
  parkState.resetForTests();
  const first = parkState.actions.applyBalanceRefund('管理员审核流程');
  assert(first.ok, 'Should create pending request');
  const pendingId = first.data.id;
  const approved = parkState.actions.approveParkRefund(pendingId);
  assert(approved.ok, 'Should approve pending request');
  const manual = parkState.actions.markRefundManualProcessing(pendingId);
  assert(manual.ok, 'Should mark approved request as manual processing');
  assertEqual(parkState.state.refundRequests.find(r => r.id === pendingId).status, 'manual_processing', 'Should be manual_processing');

  registerAdminRefunds(ctx.doc);
  const html = readFile(FILES.adminRefunds);
  runPageScripts('admin-refunds', ctx, html);

  assert(ctx.doc.getElementById('refund-status-filter').children.length > 0, 'Should render refund filters');
  assert(ctx.doc.getElementById('refund-table').children.length > 0, 'Should render refund rows');
});

// 7. New core business actions
test('shared-state: collectPayment is atomic and requestId idempotent', () => {
  const parkState = runSharedState(createPageContext());
  parkState.resetForTests();
  const before = JSON.stringify(parkState.state);
  const failed = parkState.actions.collectPayment({ parkId: 'park-001', userId: 'U001', merchantId: 'M001', amount: 99999, requestId: 'PAY-FAIL' });
  assert(!failed.ok && failed.code === 'INSUFFICIENT_BALANCE', 'Insufficient collection should fail');
  assertEqual(JSON.stringify(parkState.state), before, 'Insufficient collection must not mutate state');
  const paid = parkState.actions.collectPayment({ parkId: 'park-001', userId: 'U001', merchantId: 'M001', amount: 5, remark: '测试', requestId: 'PAY-1' });
  assert(paid.ok && paid.data.order.status === 'paid', 'Collection should create paid order');
  const again = parkState.actions.collectPayment({ parkId: 'park-001', userId: 'U001', merchantId: 'M001', amount: 5, requestId: 'PAY-1' });
  assert(again.ok && again.idempotent, 'Collection should be idempotent');
  assertEqual(parkState.state.transactions.filter(item => item.requestId === 'PAY-1').length, 1, 'Only one consume transaction');
});

test('shared-state: refundConsume enforces deadline and restores account', () => {
  const parkState = runSharedState(createPageContext());
  parkState.resetForTests();
  const paid = parkState.actions.collectPayment({ parkId: 'park-001', userId: 'U001', merchantId: 'M001', amount: 6, requestId: 'PAY-REFUND' });
  assert(paid.ok, 'Collection should succeed');
  const order = paid.data.order;
  order.refundDeadline = '2020-01-01 00:00';
  assertEqual(parkState.actions.refundConsume(order.id).code, 'refund_expired', 'Expired refund code');
  order.refundDeadline = '2999-01-01 00:00';
  const refund = parkState.actions.refundConsume(order.id);
  assert(refund.ok && order.status === 'refunded', 'Refund should restore paid order');
});

test('shared-state: refund review transitions and balance accounting are valid', () => {
  const parkState = runSharedState(createPageContext());
  parkState.resetForTests();
  const applied = parkState.actions.applyBalanceRefund('核心流程测试');
  assert(applied.ok, 'Application should succeed');
  const id = applied.data.id;
  assert(parkState.actions.startRefundReview(id).ok, 'Review should start');
  assert(parkState.actions.markRefundArrived(id).ok, 'Arrival should be marked');
  const completed = parkState.actions.completeBalanceRefund(id);
  assert(completed.ok && parkState.state.refundRequests.find(item => item.id === id).status === 'completed', 'Refund should complete');
  assert(parkState.actions.completeBalanceRefund(id).idempotent, 'Completion should be idempotent');
});

test('shared-state: refundConsume rejects invalid deadline but accepts valid deadline', () => {
  const parkState = runSharedState(createPageContext());
  parkState.resetForTests();
  const paid = parkState.actions.collectPayment({ parkId: 'park-001', userId: 'U001', merchantId: 'M001', amount: 6, requestId: 'PAY-INVALID-DEADLINE' });
  assert(paid.ok, 'Collection should succeed');
  const order = paid.data.order;
  order.refundDeadline = 'not-a-date';
  const invalid = parkState.actions.refundConsume(order.id);
  assert(!invalid.ok && invalid.code === 'REFUND_DEADLINE_INVALID', 'Invalid deadline must be rejected');
  assertEqual(order.status, 'paid', 'Invalid deadline must not refund the order');
  order.refundDeadline = '2999-01-01 00:00';
  assert(parkState.actions.refundConsume(order.id).ok, 'Valid deadline should retain refund behavior');
});

test('shared-state: invoice title context isolates parks and repeated delete is idempotent', () => {
  const parkState = runSharedState(createPageContext());
  parkState.resetForTests();
  const primary = parkState.actions.createInvoiceTitle({ name: '园区一抬头', taxId: 'TAX-001', address: '地址一', phone: '电话一', bank: '银行一', bankAccount: '账号一' });
  const secondary = parkState.actions.createInvoiceTitle({ name: '园区二抬头', taxId: 'TAX-002', address: '地址二', phone: '电话二', bank: '银行二', bankAccount: '账号二', parkId: 'park-002', userId: 'U002' });
  assert(primary.ok && secondary.ok, 'Both invoice titles should be created');
  assert(!parkState.actions.updateInvoiceTitle(primary.data.id, { name: '越权修改', taxId: 'TAX-003', address: '地址', phone: '电话', bank: '银行', bankAccount: '账号' }, { parkId: 'park-002', userId: 'U002' }).ok, 'Cross-park update must fail');
  assert(!parkState.actions.setDefaultInvoiceTitle(primary.data.id, { parkId: 'park-002', userId: 'U002' }).ok, 'Cross-park default change must fail');
  assert(!parkState.actions.deleteInvoiceTitle(primary.data.id, { parkId: 'park-002', userId: 'U002' }).ok, 'Cross-park delete must fail');
  assert(parkState.actions.deleteInvoiceTitle(primary.data.id, { parkId: 'park-001', userId: 'U001' }).ok, 'Owner delete should succeed');
  const repeated = parkState.actions.deleteInvoiceTitle(primary.data.id, { parkId: 'park-001', userId: 'U001' });
  assert(repeated.ok && repeated.idempotent, 'Repeated delete should be idempotent');
});

test('shared-state: refund review context must match the application owner', () => {
  const parkState = runSharedState(createPageContext());
  parkState.resetForTests();
  const applied = parkState.actions.applyBalanceRefund('上下文校验');
  assert(applied.ok, 'Refund application should succeed');
  const id = applied.data.id;
  assert(!parkState.actions.startRefundReview(id, { parkId: 'park-001', userId: 'U002' }).ok, 'Mismatched park must fail');
  assert(!parkState.actions.startRefundReview(id, { parkId: 'park-002', userId: 'U001' }).ok, 'Mismatched user must fail');
  assert(parkState.actions.startRefundReview(id, { parkId: 'park-001', userId: 'U001', role: 'reviewer' }).ok, 'Matching context should succeed');
});

test('shared-state: statistics and invoice actions expose dynamic shared APIs', () => {
  const parkState = runSharedState(createPageContext());
  parkState.resetForTests();
  const stats = parkState.selectors.getAccountStatistics('park-001', 'all');
  assertApprox(stats.totalStored, stats.available + stats.frozen + stats.consumed, 'Account statistics formula');
  assert(parkState.selectors.getMerchantSettlementStatistics('park-001', 'M001'), 'Settlement statistics should exist');
  const title = parkState.actions.createInvoiceTitle({ name: '测试企业', taxId: '91110000000000000X', address: '测试地址', phone: '01012345678', bank: '测试银行', bankAccount: '6222000000000000000' });
  assert(title.ok, 'Invoice title should be created');
  const recharge = parkState.state.transactions.find(item => item.type === 'recharge');
  const invoice = parkState.actions.applyInvoice({ transactionId: recharge.id, titleId: title.data.id, requestId: 'INV-1' });
  assert(invoice.ok, 'Invoice should be applied');
  assert(parkState.actions.applyInvoice({ transactionId: recharge.id, titleId: title.data.id, requestId: 'INV-1' }).idempotent, 'Invoice application should be idempotent');
});

test('shared-state: manual processing transitions cover reviewing, arrived and resume', () => {
  const parkState = runSharedState(createPageContext());
  parkState.resetForTests();
  const applied = parkState.actions.applyBalanceRefund('人工处理矩阵');
  assert(applied.ok, 'Application should succeed');
  const id = applied.data.id;
  const status = () => parkState.state.refundRequests.find(item => item.id === id).status;
  assert(!parkState.actions.markRefundManualProcessing(id).ok, 'Pending request cannot go manual');
  assert(parkState.actions.startRefundReview(id).ok, 'Review should start');
  assert(parkState.actions.markRefundManualProcessing(id).ok, 'Reviewing request can go manual');
  assertEqual(status(), 'manual_processing', 'Status after manual');
  assert(parkState.actions.markRefundManualProcessing(id).idempotent, 'Repeated manual is idempotent');
  assert(parkState.actions.resumeRefundReview(id).ok, 'Manual request can resume review');
  assertEqual(status(), 'reviewing', 'Status after resume');
  assert(parkState.actions.markRefundArrived(id).ok, 'Arrival should be marked');
  assert(parkState.actions.markRefundManualProcessing(id).ok, 'Arrived request can go manual');
  assert(!parkState.actions.completeBalanceRefund(id).ok, 'Manual request cannot complete directly');
  assert(parkState.actions.markRefundArrived(id).ok, 'Manual request can be marked arrived');
  assert(parkState.actions.completeBalanceRefund(id).ok, 'Arrived request can complete');
});

test('shared-state: default demo refunds cover every review status', () => {
  const parkState = runSharedState(createPageContext());
  parkState.resetForTests();
  const statuses = new Set(parkState.state.refundRequests.filter(item => item.parkId === 'park-001').map(item => item.status));
  ['pending_review', 'reviewing', 'rejected', 'arrived', 'completed', 'manual_processing'].forEach(status => {
    assert(statuses.has(status), 'Default demo data should include ' + status);
  });
});

// 8. Checkout deployment guard
test('checkout page is tracked for static deployment', () => {
  assert(fs.existsSync(FILES.aggregatePayment), 'Checkout page must exist locally');
  const tracked = childProcess.spawnSync(
    'git',
    ['ls-files', '--error-unmatch', 'aggregate-payment.html'],
    { cwd: BASE_DIR, encoding: 'utf8' }
  );
  assertEqual(tracked.status, 0, 'Checkout page must be tracked so GitHub Pages publishes it');
});

// 9. Forbidden word scan
test('Forbidden word scan across source files', () => forbiddenWordScan());

// 8. State consistency
test('State consistency after default reset', () => {
  const ctx = createPageContext();
  const parkState = runSharedState(ctx);
  parkState.resetForTests();
  stateConsistencyCheck(parkState);
});

// Print results
console.log('Results:');
results.forEach(r => {
  if (r.status === 'PASS') {
    console.log('  PASS: ' + r.name);
  } else {
    console.log('  FAIL: ' + r.name);
    console.log('        ' + r.message);
  }
});
console.log('\nTotal: ' + passCount + ' passed, ' + failCount + ' failed');
process.exit(failCount > 0 ? 1 : 0);
