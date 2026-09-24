#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE_DIR = __dirname;
const FILES = {
  sharedState: 'shared-state.js',
  sharedNav: 'shared-nav.js',
  index: 'index.html',
  userWallet: 'user-wallet.html',
  userRecharge: 'user-recharge.html',
  userInvoices: 'user-invoices.html',
  userRefund: 'user-refund.html',
  userOrders: 'user-orders.html',
  merchantHome: 'merchant-home.html',
  merchantScan: 'merchant-scan.html',
  merchantOrders: 'merchant-orders.html',
  merchantInvoices: 'merchant-invoices.html',
  merchantSettlements: 'merchant-settlements.html',
  enterpriseOverview: 'enterprise-overview.html',
  enterpriseEmployees: 'enterprise-employees.html',
  enterpriseRecharge: 'enterprise-recharge.html',
  enterpriseBatches: 'enterprise-batches.html',
  enterpriseRefunds: 'enterprise-refunds.html',
  enterpriseReceipts: 'enterprise-receipts.html',
  adminAccounts: 'admin-accounts.html',
  adminAccountDetail: 'admin-account-detail.html',
  adminEnterprises: 'admin-enterprises.html',
  adminMerchants: 'admin-merchants.html',
  adminEnterpriseRecharge: 'admin-enterprise-recharge.html',
  adminRechargeBatches: 'admin-recharge-batches.html',
  adminOrders: 'admin-orders.html',
  adminRefunds: 'admin-refunds.html',
  adminSettlements: 'admin-settlements.html',
  adminReconciliation: 'admin-reconciliation.html'
};

const results = [];
const testFilter = process.env.TEST_FILTER || '';
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  if (testFilter && !name.includes(testFilter)) return;
  try {
    fn();
    passCount++;
    results.push({ name, status: 'PASS' });
  } catch (error) {
    failCount++;
    results.push({ name, status: 'FAIL', message: error.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error((message || 'Assertion failed') + ': expected ' + expected + ', got ' + actual);
  }
}

function assertApprox(actual, expected, message, epsilon = 0.001) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error((message || 'Assertion failed') + ': expected ' + expected + ', got ' + actual);
  }
}

function filePath(name) {
  return path.join(BASE_DIR, FILES[name]);
}

function readRequired(name) {
  const target = filePath(name);
  assert(fs.existsSync(target), '缺少页面文件：' + FILES[name]);
  return fs.readFileSync(target, 'utf8');
}

function extractInlineScripts(html) {
  const scripts = [];
  const pattern = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) scripts.push(match[1]);
  return scripts;
}

function checkSyntax(name, source) {
  try {
    new vm.Script(source);
  } catch (error) {
    throw new Error(name + ' 脚本语法错误：' + error.message);
  }
}

function createPageContext() {
  const store = {};
  const localStorage = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
    clear() { Object.keys(store).forEach(key => delete store[key]); }
  };
  const window = {
    localStorage,
    console,
    Math,
    Date,
    JSON,
    String,
    Number,
    Array,
    Object,
    Set,
    Map,
    RegExp,
    Error,
    URL,
    URLSearchParams,
    parseFloat,
    parseInt,
    isFinite,
    isNaN,
    setTimeout,
    clearTimeout
  };
  window.window = window;
  return { window, store };
}

function runSharedState(context) {
  const source = readRequired('sharedState');
  vm.runInNewContext(source, context.window, { filename: FILES.sharedState });
  assert(context.window.parkState, 'shared-state.js 未暴露 window.parkState');
  if (typeof context.window.parkState.resetForTests === 'function') {
    context.window.parkState.resetForTests();
  }
  return context.window.parkState;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function accountSnapshot(state) {
  return JSON.stringify(state.accounts);
}

function getPrimaryAccount(parkState) {
  return parkState.selectors.getAccountByUser('U001');
}

function getPrimaryEnterpriseBalance(account) {
  assert(account && Array.isArray(account.enterpriseBalances) && account.enterpriseBalances.length, 'U001 缺少企业余额');
  return account.enterpriseBalances[0];
}

function runAdminReconciliation(state) {
  const elements = new Map();
  function createElement(tagName) {
    return {
      tagName: String(tagName).toUpperCase(),
      children: [],
      textContent: '',
      className: '',
      appendChild(child) { this.children.push(child); return child; },
      replaceChildren(...children) { this.children = children; },
      addEventListener() {}
    };
  }
  ['rows', 'row-count', 'settlement-count', 'issue-count', 'settlement-total', 'sync', 'export'].forEach(id => {
    elements.set(id, createElement(id === 'rows' ? 'tbody' : 'div'));
  });
  const document = {
    createElement,
    getElementById(id) { return elements.get(id); }
  };
  const window = {
    parkState: { state, actions: { syncSettlements() { return { ok: true }; } } },
    parkV2Admin: { getCurrentParkId() { return 'park-001'; } },
    document,
    formatMoney(value) { return Number(value).toFixed(2); },
    exportTableCsv() {},
    addEventListener() {}
  };
  window.window = window;
  const script = extractInlineScripts(readRequired('adminReconciliation')).pop();
  vm.runInNewContext(script, window, { filename: FILES.adminReconciliation });
  return elements;
}

console.log('Running verification tests...\n');

Object.keys(FILES).forEach(name => {
  test('文件与脚本语法：' + FILES[name], () => {
    const source = readRequired(name);
    if (FILES[name].endsWith('.js')) checkSyntax(FILES[name], source);
    else extractInlineScripts(source).forEach((script, index) => checkSyntax(FILES[name] + '#' + index, script));
  });
});

test('所有本地页面链接均指向存在的文件', () => {
  const missingLinks = [];
  const externalProtocol = /^(?:https?:|mailto:|tel:|javascript:)/i;
  fs.readdirSync(BASE_DIR).filter(name => name.endsWith('.html')).forEach(sourceName => {
    const source = fs.readFileSync(path.join(BASE_DIR, sourceName), 'utf8');
    const hrefPattern = /href\s*=\s*["']([^"']+)["']/gi;
    let match;
    while ((match = hrefPattern.exec(source)) !== null) {
      const href = match[1].trim();
      if (!href || href.startsWith('#') || externalProtocol.test(href)) continue;
      const targetName = href.split('#')[0].split('?')[0];
      if (!targetName) continue;
      const targetPath = path.resolve(BASE_DIR, targetName);
      const staysInPrototype = targetPath === BASE_DIR || targetPath.startsWith(BASE_DIR + path.sep);
      if (!staysInPrototype || !fs.existsSync(targetPath)) {
        missingLinks.push(sourceName + ' -> ' + href);
      }
    }
  });
  assert(missingLinks.length === 0, '发现无效本地链接：\n' + missingLinks.join('\n'));
});

test('企业后台窄屏保留可横向滚动的页面导航', () => {
  const styles = fs.readFileSync(path.join(BASE_DIR, 'shared-styles.css'), 'utf8');
  const mobileBlock = styles.match(/@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*?)\n\}/);
  assert(mobileBlock, '缺少 768px 企业后台响应式规则');
  assert(!/\.admin-sidebar\s*\{[^}]*display:\s*none/.test(mobileBlock[1]), '窄屏不得隐藏企业后台导航');
  assert(/\.admin-sidebar\s+nav\s*\{[^}]*overflow-x:\s*auto/.test(mobileBlock[1]), '窄屏企业导航应支持横向滚动');
  assert(/\.admin-sidebar\s+nav\s+a\s*\{[^}]*flex:\s*0\s+0\s+auto/.test(mobileBlock[1]), '窄屏企业导航项不得被压缩为不可点击');

  ['enterpriseOverview', 'enterpriseEmployees', 'enterpriseRecharge', 'enterpriseBatches', 'enterpriseRefunds', 'enterpriseReceipts'].forEach(name => {
    const source = readRequired(name);
    assert(/<aside class="admin-sidebar">[\s\S]*?<nav>[\s\S]*?enterprise-overview\.html[\s\S]*?enterprise-employees\.html[\s\S]*?enterprise-recharge\.html[\s\S]*?enterprise-batches\.html[\s\S]*?enterprise-refunds\.html[\s\S]*?enterprise-receipts\.html[\s\S]*?<\/nav>[\s\S]*?<\/aside>/.test(source), FILES[name] + ' 缺少完整企业导航');
  });
});

test('默认四端完整列表有至少十条且空白园区不被填充', () => {
  const parkState = runSharedState(createPageContext());
  const s = parkState.state;
  const atLeast = (rows, label) => assert(rows.length >= 10, label + ' 不足十条：' + rows.length);
  atLeast(s.orders.filter(row => row.userId === 'U001'), '个人订单');
  atLeast(s.transactions.filter(row => row.type === 'personal_recharge' && row.userId === 'U001'), '个人充值');
  atLeast(s.invoiceRecords.filter(row => row.type === 'recharge_receipt' && s.transactions.some(tx => tx.id === row.sourceId && tx.type === 'personal_recharge' && tx.userId === 'U001')), '个人充值收据');
  atLeast(s.invoiceRecords.filter(row => row.type === 'consume_invoice' && row.applicantUserId === 'U001'), '个人消费发票');
  atLeast(s.rechargeBatches.filter(row => row.enterpriseId === 'E001' && row.postingStatus === 'succeeded'), '企业成功充值批次');
  atLeast(s.refundRequests.filter(row => row.enterpriseId === 'E001'), '企业退款');
  atLeast(s.enterprises.find(row => row.id === 'E001').employeeUserIds, '企业员工');
  atLeast(s.orders.filter(row => row.merchantId === 'M002' && row.paymentStatus === 'paid'), '商户已支付订单');
  atLeast(s.invoiceRecords.filter(row => row.type === 'consume_invoice' && row.merchantId === 'M002'), '商户消费发票');
  atLeast(s.pendingSettlements.filter(row => row.merchantId === 'M002'), '商户结算');
  atLeast(s.accounts.filter(row => row.homeParkId === 'park-001'), '园区账户');
  atLeast(s.enterprises.filter(row => row.parkId === 'park-001'), '园区企业');
  atLeast(s.merchants.filter(row => row.parkId === 'park-001'), '园区商户');
  atLeast(s.reconciliationRows.filter(row => row.rechargeParkId === 'park-001' || row.consumeParkId === 'park-001'), '园区对账');
  atLeast(s.refundRequests.filter(row => row.type === 'personal_balance' && row.userId === 'U001'), '个人退款');
  assert(s.accounts.every(row => row.homeParkId !== 'park-003') && s.enterprises.every(row => row.parkId !== 'park-003') && s.merchants.every(row => row.parkId !== 'park-003') && s.orders.every(row => row.consumeParkId !== 'park-003'), '空白园区应保持空白');
  assert(parkState.internals.isValidState(clone(s)), '默认种子必须通过状态校验');
});

test('默认充值、退款、消费发票与结算均有有效关联和近期日期', () => {
  const s = runSharedState(createPageContext()).state;
  const today = new Date().toLocaleDateString('en-CA');
  const recent = row => Date.now() - Date.parse(row.createdAt) <= 7 * 86400000 && Date.parse(row.createdAt) <= Date.now();
  s.rechargeBatches.filter(row => row.enterpriseId === 'E001' && row.postingStatus === 'succeeded').forEach(batch => {
    const items = s.rechargeBatchItems.filter(row => row.batchId === batch.id);
    assert(items.length > 0 && items.every(row => row.postingStatus === 'succeeded' && s.transactions.some(tx => tx.type === 'enterprise_recharge' && tx.batchId === batch.id && tx.userId === row.userId && tx.amount === row.amount)), '企业批次明细或流水缺失');
    assert(s.invoiceRecords.some(row => row.type === 'recharge_receipt' && row.sourceId === batch.id), '企业批次收据缺失');
  });
  s.refundRequests.filter(row => row.enterpriseId === 'E001').forEach(refund => assert(refund.items.every(item => s.rechargeBatchItems.some(source => source.batchId === item.rechargeBatchId && source.userId === item.userId && source.amount >= item.amount)), '退款无可追溯来源'));
  s.pendingSettlements.filter(row => row.merchantId === 'M002').forEach(settlement => assert(settlement.orderIds.every(id => s.orders.some(order => order.id === id && order.merchantId === 'M002')), '结算无订单'));
  assert(s.orders.filter(row => row.merchantId === 'M002').every(recent), '商户订单需位于近七天');
  assert(s.orders.filter(row => row.consumeParkId === 'park-001').some(row => new Date(row.createdAt).toLocaleDateString('en-CA') === today), '园区后台需有今日订单');
});

test('新版状态包含企业、双余额和充值批次', () => {
  const parkState = runSharedState(createPageContext());
  assert(Array.isArray(parkState.state.enterprises), '缺少 enterprises 集合');
  assert(Array.isArray(parkState.state.rechargeBatches), '缺少 rechargeBatches 集合');
  assert(Array.isArray(parkState.state.rechargeBatchItems), '缺少 rechargeBatchItems 集合');
  const account = getPrimaryAccount(parkState);
  assert(account.personal && Array.isArray(account.enterpriseBalances), '账户未拆分个人余额与企业余额');
});

test('新版状态顶层集合固定且数据版本已升级', () => {
  const context = createPageContext();
  const parkState = runSharedState(context);
  const required = ['parks', 'enterprises', 'users', 'accounts', 'rechargeBatches', 'rechargeBatchItems', 'transactions', 'orders', 'refundRequests', 'merchants', 'invoiceTitles', 'invoiceRecords', 'pendingSettlements', 'reconciliationRows', 'user', 'merchantConfig'];
  required.forEach(key => assert(Object.prototype.hasOwnProperty.call(parkState.state, key), '缺少顶层状态：' + key));
  assertEqual(context.store.parkStateV2Version, parkState.internals.DATA_VERSION, '数据版本');
});

test('新版选择器覆盖企业、账户、批次和消费园区', () => {
  const parkState = runSharedState(createPageContext());
  ['getAccountByUser', 'getEnterpriseById', 'getEnterpriseBalance', 'getOrdersByConsumePark', 'getRechargeBatchesByEnterprise'].forEach(name => {
    assert(typeof parkState.selectors[name] === 'function', '缺少选择器：' + name);
  });
  assert(parkState.selectors.getAccountByUser('U001'), '无法按用户查询账户');
  assert(parkState.selectors.getEnterpriseById('E001'), '无法查询默认企业');
});

test('个人充值只增加个人余额并自动生成收据', () => {
  const parkState = runSharedState(createPageContext());
  const account = getPrimaryAccount(parkState);
  const enterprise = getPrimaryEnterpriseBalance(account);
  const personalBefore = account.personal.available;
  const enterpriseBefore = enterprise.available;
  const response = parkState.actions.rechargePersonal({ userId: 'U001', parkId: 'park-001', amount: 50, requestId: 'PR-TEST-1' });
  assert(response.ok, '个人充值失败：' + response.code);
  assertApprox(account.personal.available, personalBefore + 50, '个人余额');
  assertApprox(enterprise.available, enterpriseBefore, '企业余额不得变化');
  assert(parkState.state.invoiceRecords.some(item => item.type === 'recharge_receipt' && item.sourceId === response.data.id), '个人充值未生成充值收据');
});

test('个人充值重复请求幂等', () => {
  const parkState = runSharedState(createPageContext());
  const account = getPrimaryAccount(parkState);
  const before = account.personal.available;
  const input = { userId: 'U001', parkId: 'park-001', amount: 20, requestId: 'PR-IDEMPOTENT' };
  const first = parkState.actions.rechargePersonal(input);
  const replay = parkState.actions.rechargePersonal(input);
  assert(first.ok && replay.ok && replay.idempotent, '重复个人充值应幂等');
  assertApprox(account.personal.available, before + 20, '重复请求不得重复入账');
});

test('个人充值幂等重试在收据缺失时拒绝', () => {
  const parkState = runSharedState(createPageContext());
  const input = { userId: 'U001', parkId: 'park-001', amount: 20, requestId: 'PR-IDEMPOTENT-TAMPER' };
  const first = parkState.actions.rechargePersonal(input);
  assert(first.ok, '个人充值准备失败');
  const legalReplay = parkState.actions.rechargePersonal(input);
  assert(legalReplay.ok && legalReplay.idempotent, '未篡改个人充值重试应保持幂等');
  parkState.state.invoiceRecords = parkState.state.invoiceRecords.filter(item => item.sourceId !== first.data.id);
  assert(!parkState.internals.isValidState(clone(parkState.state)), '缺失收据的状态应无效');
  const tamperedReplay = parkState.actions.rechargePersonal(input);
  assert(!tamperedReplay.ok && !tamperedReplay.idempotent, '收据缺失后不得返回幂等成功');
});

test('企业批次任一明细错误时记录 validation_failed 批次和全部明细且不入账', () => {
  const parkState = runSharedState(createPageContext());
  const before = accountSnapshot(parkState.state);
  const response = parkState.actions.createEnterpriseRecharge({
    enterpriseId: 'E001', rechargeParkId: 'park-001', method: 'online', requestId: 'ER-INVALID',
    items: [{ userId: 'U001', amount: 100 }, { userId: 'UNKNOWN', amount: 50 }, { userId: 'U001', amount: -1 }]
  });
  assert(!response.ok && response.code === 'BATCH_VALIDATION_FAILED', '非法批次应返回 BATCH_VALIDATION_FAILED');
  const batch = parkState.state.rechargeBatches.find(item => item.requestId === 'ER-INVALID');
  assert(batch, '非法批次应持久化');
  assertEqual(batch.status, 'validation_failed', '失败批次状态');
  assertEqual(batch.validationStatus, 'failed', '失败批次校验状态');
  assertEqual(batch.paymentStatus, 'pending', '失败批次支付状态');
  assertEqual(batch.postingStatus, 'pending', '失败批次入账状态');
  const items = parkState.state.rechargeBatchItems.filter(item => item.batchId === batch.id);
  assertEqual(items.length, 3, '失败批次应记录全部原始明细');
  assert(items.every(item => Array.isArray(item.validationResult) && item.validationResult.length > 0), '每行应记录校验结果');
  assert(items.some(item => item.userId === 'UNKNOWN' && item.amount === 50), '应保留未知员工的合法金额');
  assert(items.some(item => item.userId === 'U001' && item.amount === null && item.rawItem && item.rawItem.amount === -1 && item.validationResult.includes('invalid_amount')), '非法金额应规范化并保留在 rawItem');
  assertEqual(accountSnapshot(parkState.state), before, '失败批次不得改变余额');
  assert(parkState.internals.isValidState(clone(parkState.state)), 'validation_failed 状态应可持久化且通过严格校验');
});

test('畸形企业充值行仍持久化 validation_failed 批次、原始行和逐行结果', () => {
  [null, 'bad', { amount: 10 }].forEach((malformedItem, index) => {
    const context = createPageContext();
    const parkState = runSharedState(context);
    const before = accountSnapshot(parkState.state);
    const requestId = 'ER-MALFORMED-' + index;
    const response = parkState.actions.createEnterpriseRecharge({
      enterpriseId: 'E001', rechargeParkId: 'park-001', method: 'online', requestId,
      items: [malformedItem]
    });
    assert(!response.ok && response.code === 'BATCH_VALIDATION_FAILED', '畸形行应返回 BATCH_VALIDATION_FAILED 而非 ' + response.code);
    const batch = parkState.state.rechargeBatches.find(item => item.requestId === requestId);
    assert(batch && batch.status === 'validation_failed', '畸形行失败批次应持久化');
    const items = parkState.state.rechargeBatchItems.filter(item => item.batchId === batch.id);
    assertEqual(items.length, 1, '畸形行应逐行持久化');
    assertEqual(JSON.stringify(items[0].rawItem), JSON.stringify(malformedItem), '应保存原始畸形行');
    assert(items[0].userId === null, '畸形行不得伪造有效 userId');
    assert(Array.isArray(items[0].validationResult) && items[0].validationResult.length > 0 && items[0].validationResult[0] !== 'valid', '畸形行应保存错误结果');
    assertEqual(accountSnapshot(parkState.state), before, '畸形行不得改变余额');
    parkState.reloadForTests();
    const reloadedBatch = parkState.state.rechargeBatches.find(item => item.requestId === requestId);
    assert(reloadedBatch, '重载后应保留失败批次');
    const reloadedItems = parkState.state.rechargeBatchItems.filter(item => item.batchId === reloadedBatch.id);
    assertEqual(reloadedItems.length, 1, '重载后应保留畸形行');
    assertEqual(JSON.stringify(reloadedItems[0].rawItem), JSON.stringify(malformedItem), '重载后应保留原始畸形行');
  });
});

test('字段非法的企业充值明细规范化后可持久化并保持逐行错误', () => {
  [
    { item: { userId: '', amount: 10 }, error: 'invalid_user_id', userId: null, amount: 10, totalAmount: 10 },
    { item: { userId: '<x>', amount: 10 }, error: 'invalid_user_id', userId: null, amount: 10, totalAmount: 10 },
    { item: { userId: 'U001', amount: 10.001 }, error: 'invalid_amount', userId: 'U001', amount: null, totalAmount: 0 }
  ].forEach((scenario, index) => {
    const context = createPageContext();
    const parkState = runSharedState(context);
    const beforeAccounts = accountSnapshot(parkState.state);
    const beforeTransactions = JSON.stringify(parkState.state.transactions);
    const beforeInvoices = JSON.stringify(parkState.state.invoiceRecords);
    const requestId = 'ER-INVALID-FIELD-' + index;
    const response = parkState.actions.createEnterpriseRecharge({
      enterpriseId: 'E001', rechargeParkId: 'park-001', method: 'online', requestId,
      items: [scenario.item]
    });
    assert(!response.ok && response.code === 'BATCH_VALIDATION_FAILED', '字段非法时应返回 BATCH_VALIDATION_FAILED 而非 ' + response.code);
    const batch = parkState.state.rechargeBatches.find(item => item.requestId === requestId);
    assert(batch && batch.status === 'validation_failed', '字段非法时应持久化 validation_failed 批次');
    assertEqual(batch.totalAmount, scenario.totalAmount, '失败批次总额应与规范化明细金额一致');
    const items = parkState.state.rechargeBatchItems.filter(item => item.batchId === batch.id);
    assertEqual(items.length, 1, '字段非法时应保留一条明细');
    assertEqual(items[0].userId, scenario.userId, '非法 userId 必须规范化为 null');
    assertEqual(items[0].amount, scenario.amount, '明细金额必须使用状态模型允许的值');
    assertEqual(items[0].postingStatus, 'not_posted', '失败明细必须为 not_posted');
    assertEqual(JSON.stringify(items[0].rawItem), JSON.stringify(scenario.item), 'rawItem 应保留可序列化原始输入');
    assertEqual(items[0].validationResult.length, 1, '应记录逐行错误');
    assertEqual(items[0].validationResult[0], scenario.error, '逐行错误应准确');
    assertEqual(JSON.stringify(parkState.state.accounts), beforeAccounts, '字段非法不得改变余额');
    assertEqual(JSON.stringify(parkState.state.transactions), beforeTransactions, '字段非法不得生成流水');
    assertEqual(JSON.stringify(parkState.state.invoiceRecords), beforeInvoices, '字段非法不得生成收据');
    assert(parkState.internals.isValidState(JSON.parse(JSON.stringify(parkState.state))), '规范化失败状态应通过完整状态校验');
    parkState.reloadForTests();
    const reloadedBatch = parkState.state.rechargeBatches.find(item => item.requestId === requestId);
    assert(reloadedBatch && reloadedBatch.status === 'validation_failed', '重载后应保留失败批次');
    const reloadedItems = parkState.state.rechargeBatchItems.filter(item => item.batchId === reloadedBatch.id);
    assertEqual(reloadedItems.length, 1, '重载后应保留一条失败明细');
    assertEqual(reloadedItems[0].userId, scenario.userId, '重载后非法 userId 仍应为规范化值');
    assertEqual(reloadedItems[0].amount, scenario.amount, '重载后明细金额仍应符合状态模型');
  });
});

test('企业在线批次支付前逐行待入账，支付后逐行成功', () => {
  const parkState = runSharedState(createPageContext());
  const account = getPrimaryAccount(parkState);
  const balance = getPrimaryEnterpriseBalance(account);
  const before = balance.available;
  const created = parkState.actions.createEnterpriseRecharge({
    enterpriseId: balance.enterpriseId, rechargeParkId: 'park-001', method: 'online', requestId: 'ER-ONLINE',
    items: [{ userId: 'U001', amount: 100 }, { userId: 'U004', amount: 50 }]
  });
  assert(created.ok, '在线批次创建失败：' + created.code);
  const pendingItems = parkState.state.rechargeBatchItems.filter(item => item.batchId === created.data.id);
  assertEqual(pendingItems.length, 2, '在线批次明细数');
  assert(pendingItems.every(item => item.postingStatus === 'pending'), '支付前有效明细应为 pending');
  assertApprox(balance.available, before, '支付前不得入账');
  const confirmed = parkState.actions.confirmEnterpriseOnlinePayment(created.data.id, 'PAY-ONLINE-1');
  assert(confirmed.ok, '在线支付确认失败：' + confirmed.code);
  assert(pendingItems.every(item => item.postingStatus === 'succeeded'), '支付后有效明细应全部 succeeded');
  assertApprox(balance.available, before + 100, '支付后企业余额');
  assert(parkState.state.invoiceRecords.some(item => item.type === 'recharge_receipt' && item.sourceId === created.data.id), '企业充值未生成收据');

  const tampered = clone(parkState.state);
  tampered.rechargeBatchItems.find(item => item.batchId === created.data.id).postingStatus = 'pending';
  assert(!parkState.internals.isValidState(tampered), '成功批次明细入账状态被篡改时应拒绝');
});

test('validation_failed 企业批次明细明确未入账且不得篡改为成功', () => {
  const parkState = runSharedState(createPageContext());
  const response = parkState.actions.createEnterpriseRecharge({
    enterpriseId: 'E001', rechargeParkId: 'park-001', method: 'online', requestId: 'ER-FAILED-POSTING-STATUS',
    items: [{ userId: 'UNKNOWN', amount: 10 }]
  });
  assert(!response.ok && response.code === 'BATCH_VALIDATION_FAILED', '非法批次应校验失败');
  const item = parkState.state.rechargeBatchItems.find(candidate => candidate.batchId === response.data.id);
  assertEqual(item.postingStatus, 'not_posted', '校验失败明细入账状态');
  const tampered = clone(parkState.state);
  tampered.rechargeBatchItems.find(candidate => candidate.id === item.id).postingStatus = 'succeeded';
  assert(!parkState.internals.isValidState(tampered), '校验失败明细不得标记为 succeeded');
});

test('企业在线支付重复回调不重复入账', () => {
  const parkState = runSharedState(createPageContext());
  const balance = getPrimaryEnterpriseBalance(getPrimaryAccount(parkState));
  const created = parkState.actions.createEnterpriseRecharge({ enterpriseId: balance.enterpriseId, rechargeParkId: 'park-001', method: 'online', requestId: 'ER-CALLBACK', items: [{ userId: 'U001', amount: 30 }] });
  const first = parkState.actions.confirmEnterpriseOnlinePayment(created.data.id, 'PAY-CALLBACK');
  const afterFirst = balance.available;
  const replay = parkState.actions.confirmEnterpriseOnlinePayment(created.data.id, 'PAY-CALLBACK');
  assert(first.ok && replay.ok && replay.idempotent, '重复支付回调应幂等');
  assertApprox(balance.available, afterFirst, '重复回调不得重复入账');
});

test('在线支付确认入口在成功批次被篡改后拒绝原支付流水重试', () => {
  const parkState = runSharedState(createPageContext());
  const created = parkState.actions.createEnterpriseRecharge({
    enterpriseId: 'E001', rechargeParkId: 'park-001', method: 'online', requestId: 'ER-ONLINE-CONFIRM-TAMPER',
    items: [{ userId: 'U001', amount: 31 }]
  });
  assert(parkState.actions.confirmEnterpriseOnlinePayment(created.data.id, 'PAY-ONLINE-CONFIRM-TAMPER').ok, '在线批次入账失败');
  const legalReplay = parkState.actions.confirmEnterpriseOnlinePayment(created.data.id, 'PAY-ONLINE-CONFIRM-TAMPER');
  assert(legalReplay.ok && legalReplay.idempotent, '未篡改在线重试应保持幂等');
  const item = parkState.state.rechargeBatchItems.find(candidate => candidate.batchId === created.data.id);
  item.enterpriseId = 'E002';
  const tamperedReplay = parkState.actions.confirmEnterpriseOnlinePayment(created.data.id, 'PAY-ONLINE-CONFIRM-TAMPER');
  assert(!tamperedReplay.ok && tamperedReplay.code === 'BATCH_VALIDATION_FAILED', '在线确认入口不得绕过成功批次完整性校验');
});

test('园区代充值缺凭证不入账，有凭证后整批入账', () => {
  const parkState = runSharedState(createPageContext());
  const balance = getPrimaryEnterpriseBalance(getPrimaryAccount(parkState));
  const before = balance.available;
  const created = parkState.actions.createEnterpriseRecharge({ enterpriseId: balance.enterpriseId, rechargeParkId: 'park-001', method: 'offline', requestId: 'ER-OFFLINE', items: [{ userId: 'U001', amount: 40 }] });
  assert(created.ok, '线下批次创建失败：' + created.code);
  const missing = parkState.actions.confirmOfflineRecharge(created.data.id, '');
  assert(!missing.ok && missing.code === 'VOUCHER_REQUIRED', '无凭证应返回 VOUCHER_REQUIRED');
  assertApprox(balance.available, before, '无凭证不得入账');
  const confirmed = parkState.actions.confirmOfflineRecharge(created.data.id, 'voucher-demo.pdf');
  assert(confirmed.ok, '线下到账确认失败：' + confirmed.code);
  assertApprox(balance.available, before + 40, '线下批次企业余额');
});

test('线下确认入口在成功批次被篡改后拒绝原凭证重试', () => {
  const parkState = runSharedState(createPageContext());
  const created = parkState.actions.createEnterpriseRecharge({
    enterpriseId: 'E001', rechargeParkId: 'park-001', method: 'offline', requestId: 'ER-OFFLINE-CONFIRM-TAMPER',
    items: [{ userId: 'U001', amount: 41 }]
  });
  assert(parkState.actions.confirmOfflineRecharge(created.data.id, 'voucher-confirm-tamper.pdf').ok, '线下批次入账失败');
  const legalReplay = parkState.actions.confirmOfflineRecharge(created.data.id, 'voucher-confirm-tamper.pdf');
  assert(legalReplay.ok && legalReplay.idempotent, '未篡改线下重试应保持幂等');
  const item = parkState.state.rechargeBatchItems.find(candidate => candidate.batchId === created.data.id);
  item.enterpriseId = 'E002';
  const tamperedReplay = parkState.actions.confirmOfflineRecharge(created.data.id, 'voucher-confirm-tamper.pdf');
  assert(!tamperedReplay.ok && tamperedReplay.code === 'BATCH_VALIDATION_FAILED', '线下确认入口不得绕过成功批次完整性校验');
});

test('统一入账拒绝仅伪造支付成功但缺少支付依据的批次', () => {
  ['online', 'offline'].forEach(method => {
    const parkState = runSharedState(createPageContext());
    const balance = getPrimaryEnterpriseBalance(getPrimaryAccount(parkState));
    const before = balance.available;
    const created = parkState.actions.createEnterpriseRecharge({
      enterpriseId: balance.enterpriseId,
      rechargeParkId: 'park-001',
      method,
      requestId: 'ER-FORGED-' + method.toUpperCase(),
      items: [{ userId: 'U001', amount: 18 }]
    });
    assert(created.ok, method + ' 批次创建失败');
    created.data.paymentStatus = 'succeeded';
    const posted = parkState.actions.postRechargeBatch(created.data.id);
    assert(!posted.ok, method + ' 缺少支付依据时不得直接入账');
    assertApprox(balance.available, before, method + ' 伪造支付状态后余额');
  });
});

test('统一入账拒绝企业归属被篡改的批次明细', () => {
  const parkState = runSharedState(createPageContext());
  const balance = getPrimaryEnterpriseBalance(getPrimaryAccount(parkState));
  const before = balance.available;
  const created = parkState.actions.createEnterpriseRecharge({
    enterpriseId: 'E001', rechargeParkId: 'park-001', method: 'online', requestId: 'ER-TAMPER-ENTERPRISE',
    items: [{ userId: 'U001', amount: 19 }]
  });
  const item = parkState.state.rechargeBatchItems.find(candidate => candidate.batchId === created.data.id);
  item.enterpriseId = 'E002';
  created.data.paymentStatus = 'succeeded';
  created.data.paymentReference = 'PAY-TAMPER-ENTERPRISE';
  const posted = parkState.actions.postRechargeBatch(created.data.id);
  assert(!posted.ok && posted.code === 'BATCH_VALIDATION_FAILED', '跨企业明细应返回 BATCH_VALIDATION_FAILED');
  assertApprox(balance.available, before, '跨企业明细不得入账');
});

test('成功企业批次被篡改后所有批次幂等入口均拒绝', () => {
  const parkState = runSharedState(createPageContext());
  const input = {
    enterpriseId: 'E001', rechargeParkId: 'park-001', method: 'online', requestId: 'ER-SUCCEEDED-TAMPER',
    items: [{ userId: 'U001', amount: 19 }]
  };
  const created = parkState.actions.createEnterpriseRecharge(input);
  assert(created.ok, '批次创建失败');
  assert(parkState.actions.confirmEnterpriseOnlinePayment(created.data.id, 'PAY-SUCCEEDED-TAMPER').ok, '批次入账失败');
  const item = parkState.state.rechargeBatchItems.find(candidate => candidate.batchId === created.data.id);
  item.enterpriseId = 'E002';
  const postingReplay = parkState.actions.postRechargeBatch(created.data.id);
  assert(!postingReplay.ok && postingReplay.code === 'BATCH_VALIDATION_FAILED', '成功批次篡改后入账重试应拒绝');
  const creationReplay = parkState.actions.createEnterpriseRecharge(input);
  assert(!creationReplay.ok && creationReplay.code === 'BATCH_VALIDATION_FAILED', '成功批次篡改后创建重试应拒绝');
});

test('充值批次状态、依据和时间必须一致', () => {
  ['online', 'offline'].forEach(method => {
    const parkState = runSharedState(createPageContext());
    const created = parkState.actions.createEnterpriseRecharge({
      enterpriseId: 'E001', rechargeParkId: 'park-001', method, requestId: 'ER-CONSISTENCY-' + method,
      items: [{ userId: 'U001', amount: 22 }]
    });
    assert(created.ok, method + ' 批次创建失败');
    const valid = clone(parkState.state);
    assert(parkState.internals.isValidState(valid), method + ' pending 基线应有效');

    const earlyEvidence = clone(valid);
    const pendingBatch = earlyEvidence.rechargeBatches.find(item => item.id === created.data.id);
    if (method === 'online') pendingBatch.paymentReference = 'PAY-EARLY';
    else pendingBatch.voucher = 'voucher-early.pdf';
    assert(!parkState.internals.isValidState(earlyEvidence), method + ' pending 不得提前有支付依据');

    const wrongEvidence = clone(valid);
    const pendingWrongEvidence = wrongEvidence.rechargeBatches.find(item => item.id === created.data.id);
    if (method === 'online') pendingWrongEvidence.voucher = 'voucher-wrong.pdf';
    else pendingWrongEvidence.paymentReference = 'PAY-WRONG';
    assert(!parkState.internals.isValidState(wrongEvidence), method + ' 不得携带另一方式依据');

    const invalidCreatedAt = clone(valid);
    invalidCreatedAt.rechargeBatches.find(item => item.id === created.data.id).createdAt = 'not-a-date';
    assert(!parkState.internals.isValidState(invalidCreatedAt), '批次 createdAt 无效应拒绝');

    const earlyPostedAt = clone(valid);
    earlyPostedAt.rechargeBatches.find(item => item.id === created.data.id).postedAt = new Date().toISOString();
    assert(!parkState.internals.isValidState(earlyPostedAt), '未成功入账不得有 postedAt');
  });

  const parkState = runSharedState(createPageContext());
  const created = parkState.actions.createEnterpriseRecharge({ enterpriseId: 'E001', rechargeParkId: 'park-001', method: 'online', requestId: 'ER-POSTED-TIME', items: [{ userId: 'U001', amount: 23 }] });
  assert(parkState.actions.confirmEnterpriseOnlinePayment(created.data.id, 'PAY-POSTED-TIME').ok, '成功批次准备失败');
  const invalidPostedAt = clone(parkState.state);
  invalidPostedAt.rechargeBatches.find(item => item.id === created.data.id).postedAt = 'not-a-date';
  assert(!parkState.internals.isValidState(invalidPostedAt), '成功批次 postedAt 无效应拒绝');
});

test('每个成功充值来源必须恰好存在一张收据且失败或待支付批次不得有收据', () => {
  const parkState = runSharedState(createPageContext());
  const personal = parkState.actions.rechargePersonal({ userId: 'U001', parkId: 'park-001', amount: 14, requestId: 'PR-MISSING-RECEIPT' });
  const succeeded = parkState.actions.createEnterpriseRecharge({ enterpriseId: 'E001', rechargeParkId: 'park-001', method: 'online', requestId: 'ER-MISSING-RECEIPT', items: [{ userId: 'U001', amount: 24 }] });
  assert(personal.ok && succeeded.ok && parkState.actions.confirmEnterpriseOnlinePayment(succeeded.data.id, 'PAY-MISSING-RECEIPT').ok, '成功充值准备失败');

  const missingPersonalReceipt = clone(parkState.state);
  missingPersonalReceipt.invoiceRecords = missingPersonalReceipt.invoiceRecords.filter(item => item.sourceId !== personal.data.id);
  assert(!parkState.internals.isValidState(missingPersonalReceipt), '个人充值缺失收据应拒绝');

  const missingBatchReceipt = clone(parkState.state);
  missingBatchReceipt.invoiceRecords = missingBatchReceipt.invoiceRecords.filter(item => item.sourceId !== succeeded.data.id);
  assert(!parkState.internals.isValidState(missingBatchReceipt), '成功企业批次缺失收据应拒绝');

  const pendingState = runSharedState(createPageContext());
  const pending = pendingState.actions.createEnterpriseRecharge({ enterpriseId: 'E001', rechargeParkId: 'park-001', method: 'online', requestId: 'ER-PENDING-RECEIPT', items: [{ userId: 'U001', amount: 25 }] });
  pendingState.state.invoiceRecords.push({ id: 'INV-RC-PENDING', type: 'recharge_receipt', sourceId: pending.data.id, userId: null, enterpriseId: 'E001', amount: 25, createdAt: new Date().toISOString() });
  assert(!pendingState.internals.isValidState(clone(pendingState.state)), 'pending 企业批次不得有收据');
});

test('持久化第二次写入失败时同时恢复内存和 localStorage', () => {
  const context = createPageContext();
  const parkState = runSharedState(context);
  const memoryBefore = JSON.stringify(parkState.state);
  const storedStateBefore = context.store.parkStateV2;
  const storedVersionBefore = context.store.parkStateV2Version;
  const originalSetItem = context.window.localStorage.setItem;
  let writes = 0;
  context.window.localStorage.setItem = function (key, value) {
    writes++;
    if (writes === 2) throw new Error('version write failed');
    originalSetItem.call(this, key, value);
  };

  const response = parkState.actions.rechargePersonal({ userId: 'U001', parkId: 'park-001', amount: 11, requestId: 'PR-PERSIST-ROLLBACK' });
  assert(!response.ok && response.code === 'PERSIST_FAILED', '持久化失败应返回 PERSIST_FAILED');
  assertEqual(JSON.stringify(parkState.state), memoryBefore, '持久化失败后内存状态');
  assertEqual(context.store.parkStateV2, storedStateBefore, '持久化失败后状态存储');
  assertEqual(context.store.parkStateV2Version, storedVersionBefore, '持久化失败后版本存储');
  parkState.reloadForTests();
  assertEqual(JSON.stringify(parkState.state), memoryBefore, '重载不得读回失败事务');
});

test('充值跨集合关系、状态和收据约束由 isValidState 拒绝', () => {
  const parkState = runSharedState(createPageContext());
  const personal = parkState.actions.rechargePersonal({ userId: 'U001', parkId: 'park-001', amount: 13, requestId: 'PR-STATE-VALIDATION' });
  const batch = parkState.actions.createEnterpriseRecharge({
    enterpriseId: 'E001', rechargeParkId: 'park-001', method: 'online', requestId: 'ER-STATE-VALIDATION',
    items: [{ userId: 'U001', amount: 21 }]
  });
  assert(personal.ok && batch.ok, '状态校验基线数据准备失败');
  assert(parkState.actions.confirmEnterpriseOnlinePayment(batch.data.id, 'PAY-STATE-VALIDATION').ok, '企业充值基线入账失败');
  const valid = clone(parkState.state);
  assert(parkState.internals.isValidState(valid), '合法充值状态应通过校验');

  const invalidStates = [];

  const duplicateBatchRequest = clone(valid);
  duplicateBatchRequest.rechargeBatches.push(Object.assign({}, duplicateBatchRequest.rechargeBatches[0], { id: 'RB-DUPLICATE' }));
  invalidStates.push(['批次 requestId 重复', duplicateBatchRequest]);

  const wrongBatchTotal = clone(valid);
  wrongBatchTotal.rechargeBatches[0].totalAmount += 1;
  invalidStates.push(['批次总额与明细不符', wrongBatchTotal]);

  const duplicateEmployee = clone(valid);
  const duplicatedItem = Object.assign({}, duplicateEmployee.rechargeBatchItems[0], { id: 'RBI-DUPLICATE' });
  duplicateEmployee.rechargeBatchItems.push(duplicatedItem);
  duplicateEmployee.rechargeBatches[0].totalAmount += duplicatedItem.amount;
  invalidStates.push(['同批次员工重复', duplicateEmployee]);

  const wrongItemEnterprise = clone(valid);
  wrongItemEnterprise.rechargeBatchItems[0].enterpriseId = 'E002';
  invalidStates.push(['批次明细企业不一致', wrongItemEnterprise]);

  const missingPaymentEvidence = clone(valid);
  missingPaymentEvidence.rechargeBatches[0].paymentReference = null;
  invalidStates.push(['成功在线批次缺支付流水号', missingPaymentEvidence]);

  const wrongPaymentEvidence = clone(valid);
  wrongPaymentEvidence.rechargeBatches[0].voucher = 'unexpected-voucher.pdf';
  invalidStates.push(['在线批次携带线下凭证', wrongPaymentEvidence]);

  const wrongPostingState = clone(valid);
  wrongPostingState.rechargeBatches[0].status = 'pending_payment';
  invalidStates.push(['批次业务状态与入账状态不一致', wrongPostingState]);

  const wrongPersonalTransaction = clone(valid);
  wrongPersonalTransaction.transactions.find(item => item.id === personal.data.id).enterpriseId = 'E001';
  invalidStates.push(['个人充值流水关联企业', wrongPersonalTransaction]);

  const wrongEnterpriseTransaction = clone(valid);
  wrongEnterpriseTransaction.transactions.find(item => item.type === 'enterprise_recharge').amount += 1;
  invalidStates.push(['企业充值流水与明细金额不符', wrongEnterpriseTransaction]);

  const invalidTransactionMetadata = clone(valid);
  invalidTransactionMetadata.transactions[0].createdAt = 'not-a-date';
  invalidStates.push(['充值流水 createdAt 无效', invalidTransactionMetadata]);

  const duplicateReceipt = clone(valid);
  duplicateReceipt.invoiceRecords.push(Object.assign({}, duplicateReceipt.invoiceRecords[0], { id: 'INV-RC-DUPLICATE' }));
  invalidStates.push(['同来源收据重复', duplicateReceipt]);

  const mismatchedReceipt = clone(valid);
  mismatchedReceipt.invoiceRecords[0].amount += 1;
  invalidStates.push(['收据金额与来源不符', mismatchedReceipt]);

  invalidStates.forEach(([label, candidate]) => {
    assert(!parkState.internals.isValidState(candidate), label + ' 应被拒绝');
  });
});

function prepareMixedBalance(parkState, enterpriseAmount, personalAmount) {
  const account = getPrimaryAccount(parkState);
  const balance = getPrimaryEnterpriseBalance(account);
  balance.available = enterpriseAmount;
  account.personal.available = personalAmount;
  return { account, balance };
}

test('跨园区消费先扣企业余额再由个人余额补足', () => {
  const parkState = runSharedState(createPageContext());
  const prepared = prepareMixedBalance(parkState, 60, 50);
  const merchant = parkState.state.merchants.find(item => item.parkId === 'park-002');
  assert(merchant, '缺少园区二商户演示数据');
  const paid = parkState.actions.collectPayment({ userId: 'U001', merchantId: merchant.id, amount: 80, requestId: 'CROSS-PAY-1' });
  assert(paid.ok, '跨园区消费失败：' + paid.code);
  assertApprox(prepared.balance.available, 0, '企业余额扣款');
  assertApprox(prepared.account.personal.available, 30, '个人余额补足');
  assertEqual(paid.data.order.consumeParkId, 'park-002', '订单消费园区');
  assertApprox(paid.data.order.enterpriseDeductions[0].amount, 60, '订单企业扣款构成');
  assertApprox(paid.data.order.personalAmount, 20, '订单个人扣款构成');
});

test('跨园区消费重复请求返回原订单且不重复扣款', () => {
  const parkState = runSharedState(createPageContext());
  const prepared = prepareMixedBalance(parkState, 60, 50);
  const merchant = parkState.state.merchants.find(item => item.parkId === 'park-002');
  const input = { userId: 'U001', merchantId: merchant.id, amount: 80, requestId: 'CROSS-IDEMPOTENT' };
  const first = parkState.actions.collectPayment(input);
  assert(first.ok, '首次消费失败：' + first.code);
  const afterFirst = JSON.stringify(parkState.state);
  const replay = parkState.actions.collectPayment(input);
  assert(replay.ok && replay.idempotent, '重复消费应幂等返回');
  assertEqual(replay.data.order.id, first.data.order.id, '重复消费应返回原订单');
  assertEqual(JSON.stringify(parkState.state), afterFirst, '重复消费不得改变状态');
  assertApprox(prepared.balance.available, 0, '重复消费后企业余额');
  assertApprox(prepared.account.personal.available, 30, '重复消费后个人余额');
});

test('双余额合计不足时状态完全不变', () => {
  const parkState = runSharedState(createPageContext());
  prepareMixedBalance(parkState, 10, 5);
  const merchant = parkState.state.merchants.find(item => item.parkId === 'park-002');
  const before = JSON.stringify(parkState.state);
  const response = parkState.actions.collectPayment({ userId: 'U001', merchantId: merchant.id, amount: 80, requestId: 'CROSS-FAIL' });
  assert(!response.ok && response.code === 'INSUFFICIENT_BALANCE', '余额不足应失败');
  assertEqual(JSON.stringify(parkState.state), before, '余额不足不得改变状态');
});

test('消费退款仅原商户可发起并按原构成恢复', () => {
  const parkState = runSharedState(createPageContext());
  const prepared = prepareMixedBalance(parkState, 60, 50);
  const merchant = parkState.state.merchants.find(item => item.parkId === 'park-002');
  const otherMerchant = parkState.state.merchants.find(item => item.id !== merchant.id);
  const paid = parkState.actions.collectPayment({ userId: 'U001', merchantId: merchant.id, amount: 80, requestId: 'REFUND-PAY' });
  assert(paid.ok, '消费准备失败');
  const denied = parkState.actions.refundConsume(paid.data.order.id, { merchantId: otherMerchant.id });
  assert(!denied.ok, '非原商户不得退款');
  assertApprox(prepared.balance.available, 0, '拒绝退款后企业余额');
  const refunded = parkState.actions.refundConsume(paid.data.order.id, { merchantId: merchant.id });
  assert(refunded.ok, '原商户退款失败：' + refunded.code);
  assertApprox(prepared.balance.available, 60, '恢复企业余额');
  assertApprox(prepared.account.personal.available, 50, '恢复个人余额');
  const replay = parkState.actions.refundConsume(paid.data.order.id, { merchantId: merchant.id });
  assert(replay.ok && replay.idempotent, '重复退款应幂等');
  assertApprox(prepared.balance.available, 60, '重复退款不得重复恢复');
});

test('个人退款只冻结个人余额', () => {
  const parkState = runSharedState(createPageContext());
  assert(parkState.actions.rechargePersonal({ userId: 'U001', parkId: 'park-001', amount: 20, requestId: 'PR-FOR-PERSONAL-REFUND' }).ok, '个人退款来源充值准备失败');
  const account = getPrimaryAccount(parkState);
  const enterprise = getPrimaryEnterpriseBalance(account);
  const enterpriseBefore = clone(enterprise);
  const personalBefore = account.personal.available;
  const response = parkState.actions.applyPersonalRefund({ userId: 'U001', amount: 20, requestId: 'PERSONAL-REFUND' });
  assert(response.ok, '个人余额退款申请失败：' + response.code);
  assertApprox(account.personal.available, personalBefore - 20, '个人可用余额');
  assertApprox(account.personal.frozen, 20, '个人冻结余额');
  assertEqual(JSON.stringify(enterprise), JSON.stringify(enterpriseBefore), '个人退款不得触碰企业余额');
});

test('个人退款渠道由成功充值来源推导且调用方不能覆盖', () => {
  const parkState = runSharedState(createPageContext());
  const recharged = parkState.actions.rechargePersonal({ userId: 'U001', parkId: 'park-001', amount: 30, requestId: 'PR-REFUND-CHANNEL' });
  assert(recharged.ok, '个人充值来源准备失败');
  const transaction = parkState.state.transactions.find(item => item.id === recharged.data.id);
  const receipt = parkState.state.invoiceRecords.find(item => item.type === 'recharge_receipt' && item.sourceId === recharged.data.id);
  assertEqual(transaction.paymentChannel, 'online', '个人充值流水应记录支付渠道');
  assertEqual(receipt.paymentChannel, 'online', '个人充值收据应记录支付渠道');

  const first = parkState.actions.applyPersonalRefund({
    userId: 'U001', amount: 10, requestId: 'PERSONAL-REFUND-CHANNEL', originalPaymentChannel: 'offline'
  });
  assert(first.ok, '个人退款申请失败：' + first.code);
  assertEqual(first.data.originalPaymentChannel, 'online', '伪造渠道不得覆盖充值来源渠道');

  const replay = parkState.actions.applyPersonalRefund({
    userId: 'U001', amount: 10, requestId: 'PERSONAL-REFUND-CHANNEL', originalPaymentChannel: 'forged'
  });
  assert(replay.ok && replay.idempotent, '个人退款重复请求应幂等');
  assertEqual(replay.data.originalPaymentChannel, 'online', '幂等重试应返回原退款渠道');
});

test('无可追溯个人充值来源时退款被拒绝且状态不变', () => {
  const parkState = runSharedState(createPageContext());
  parkState.state.transactions = parkState.state.transactions.filter(item => item.type !== 'personal_recharge' || item.userId !== 'U001');
  parkState.state.invoiceRecords = parkState.state.invoiceRecords.filter(item => !item.id.startsWith('INV-DEMO-PR-'));
  const before = JSON.stringify(parkState.state);
  const response = parkState.actions.applyPersonalRefund({ userId: 'U001', amount: 10, requestId: 'PERSONAL-REFUND-NO-SOURCE' });
  assert(!response.ok && response.code === 'PERSONAL_RECHARGE_SOURCE_NOT_FOUND', '无来源应返回 PERSONAL_RECHARGE_SOURCE_NOT_FOUND');
  assertEqual(JSON.stringify(parkState.state), before, '无来源退款不得改变状态');
});

test('企业退款记录原批次和退款去向', () => {
  const parkState = runSharedState(createPageContext());
  const balance = getPrimaryEnterpriseBalance(getPrimaryAccount(parkState));
  const created = parkState.actions.createEnterpriseRecharge({ enterpriseId: balance.enterpriseId, rechargeParkId: 'park-001', method: 'online', requestId: 'ER-FOR-REFUND', items: [{ userId: 'U001', amount: 25 }] });
  parkState.actions.confirmEnterpriseOnlinePayment(created.data.id, 'PAY-REFUND-SOURCE');
  const response = parkState.actions.applyEnterpriseRefund({ enterpriseId: balance.enterpriseId, adminUserId: 'U003', items: [{ userId: 'U001', amount: 20, rechargeBatchId: created.data.id }], requestId: 'ENTERPRISE-REFUND' });
  assert(response.ok, '企业退款申请失败：' + response.code);
  assertEqual(response.data.refundDestination, 'original_payer', '在线企业充值退款去向');
  assert(response.data.items.some(item => item.rechargeBatchId === created.data.id), '企业退款未记录原充值批次');
});

test('统一 invoiceRecords 支持严格 service_fee_invoice 记录', () => {
  const parkState = runSharedState(createPageContext());
  const valid = clone(parkState.state);
  valid.invoiceRecords.push({
    id: 'INV-SF-VALID', type: 'service_fee_invoice', merchantId: 'M001', consumeParkId: 'park-001',
    sourceId: 'SET-001', amount: 1.5, status: 'pending', createdAt: new Date().toISOString()
  });
  assert(parkState.internals.isValidState(valid), '合法服务费发票应通过状态校验');

  ['merchantId', 'consumeParkId', 'sourceId', 'amount', 'status', 'createdAt'].forEach(field => {
    const invalid = clone(valid);
    if (field === 'amount') invalid.invoiceRecords.find(item => item.id === 'INV-SF-VALID')[field] = 0;
    else if (field === 'createdAt') invalid.invoiceRecords.find(item => item.id === 'INV-SF-VALID')[field] = 'not-a-date';
    else invalid.invoiceRecords.find(item => item.id === 'INV-SF-VALID')[field] = null;
    assert(!parkState.internals.isValidState(invalid), '缺少或非法 ' + field + ' 的服务费发票应被拒绝');
  });
  const mismatchedPark = clone(valid);
  mismatchedPark.invoiceRecords.find(item => item.id === 'INV-SF-VALID').consumeParkId = 'park-002';
  assert(!parkState.internals.isValidState(mismatchedPark), '服务费发票消费园区必须与商户归属一致');
});

test('不同 requestId 的企业退款累计超过原批次额度时拒绝且整单不变', () => {
  const parkState = runSharedState(createPageContext());
  const created = parkState.actions.createEnterpriseRecharge({ enterpriseId: 'E001', rechargeParkId: 'park-001', method: 'online', requestId: 'ER-CUMULATIVE-REFUND', items: [{ userId: 'U001', amount: 25 }] });
  assert(created.ok && parkState.actions.confirmEnterpriseOnlinePayment(created.data.id, 'PAY-CUMULATIVE-REFUND').ok, '累计退款来源批次准备失败');
  const first = parkState.actions.applyEnterpriseRefund({ enterpriseId: 'E001', adminUserId: 'U003', items: [{ userId: 'U001', amount: 15, rechargeBatchId: created.data.id }], requestId: 'ER-CUMULATIVE-REFUND-1' });
  assert(first.ok, '首次企业退款申请失败：' + first.code);
  const before = JSON.stringify(parkState.state);
  const second = parkState.actions.applyEnterpriseRefund({ enterpriseId: 'E001', adminUserId: 'U003', items: [{ userId: 'U001', amount: 11, rechargeBatchId: created.data.id }], requestId: 'ER-CUMULATIVE-REFUND-2' });
  assert(!second.ok && second.code === 'RECHARGE_BATCH_NOT_REFUNDABLE', '累计超过原批次额度应拒绝');
  assertEqual(JSON.stringify(parkState.state), before, '超额企业退款整单状态必须不变');
});

test('消费发票必须关联已支付消费订单并保存抬头快照', () => {
  const parkState = runSharedState(createPageContext());
  const merchant = parkState.state.merchants.find(item => item.parkId === 'park-002');
  const paid = parkState.actions.collectPayment({ userId: 'U001', merchantId: merchant.id, amount: 10, requestId: 'INVOICE-PAY' });
  assert(paid.ok, '消费准备失败');
  const title = { name: '北京测试企业', taxId: '911100000000000001' };
  const applied = parkState.actions.applyConsumeInvoice({ orderId: paid.data.order.id, applicantUserId: 'U001', title, requestId: 'CONSUME-INVOICE' });
  assert(applied.ok, '消费发票申请失败：' + applied.code);
  assertEqual(applied.data.type, 'consume_invoice', '票据类型');
  assertEqual(applied.data.sourceId, paid.data.order.id, '发票来源订单');
  assertEqual(applied.data.titleSnapshot.name, title.name, '抬头快照');
  title.name = '被篡改的抬头';
  assertEqual(applied.data.titleSnapshot.name, '北京测试企业', '抬头必须深拷贝');
});

test('个人退款校验余额并按 requestId 幂等', () => {
  const parkState = runSharedState(createPageContext());
  assert(parkState.actions.rechargePersonal({ userId: 'U001', parkId: 'park-001', amount: 20, requestId: 'PR-FOR-PERSONAL-IDEMPOTENT' }).ok, '个人退款幂等来源准备失败');
  const account = getPrimaryAccount(parkState);
  const before = JSON.stringify(parkState.state);
  const invalid = parkState.actions.applyPersonalRefund({ userId: 'U001', amount: account.personal.available + 1, requestId: 'PERSONAL-OVERDRAW' });
  assert(!invalid.ok && invalid.code === 'INSUFFICIENT_PERSONAL_BALANCE', '个人退款超额应失败');
  assertEqual(JSON.stringify(parkState.state), before, '失败退款不得改变状态');
  const input = { userId: 'U001', amount: 12.34, requestId: 'PERSONAL-IDEMPOTENT' };
  const first = parkState.actions.applyPersonalRefund(input);
  assert(first.ok, '首次个人退款申请失败');
  const afterFirst = JSON.stringify(parkState.state);
  const replay = parkState.actions.applyPersonalRefund(input);
  assert(replay.ok && replay.idempotent, '重复个人退款应幂等');
  assertEqual(replay.data.id, first.data.id, '重复个人退款应返回原申请');
  assertEqual(JSON.stringify(parkState.state), afterFirst, '重复个人退款不得再次冻结');
});

test('企业退款校验管理员、余额和原充值批次', () => {
  const parkState = runSharedState(createPageContext());
  const created = parkState.actions.createEnterpriseRecharge({ enterpriseId: 'E001', rechargeParkId: 'park-001', method: 'online', requestId: 'ER-REFUND-GUARDS', items: [{ userId: 'U001', amount: 15 }] });
  assert(created.ok, '企业退款准备批次失败');
  assert(parkState.actions.confirmEnterpriseOnlinePayment(created.data.id, 'PAY-REFUND-GUARDS').ok, '企业退款准备入账失败');
  const before = JSON.stringify(parkState.state);
  const denied = parkState.actions.applyEnterpriseRefund({ enterpriseId: 'E001', adminUserId: 'U001', items: [{ userId: 'U001', amount: 5, rechargeBatchId: created.data.id }], requestId: 'ER-REFUND-DENIED' });
  assert(!denied.ok && denied.code === 'ADMIN_FORBIDDEN', '非企业管理员应被拒绝');
  const missingBatch = parkState.actions.applyEnterpriseRefund({ enterpriseId: 'E001', adminUserId: 'U003', items: [{ userId: 'U001', amount: 5, rechargeBatchId: 'RB-UNKNOWN' }], requestId: 'ER-REFUND-MISSING' });
  assert(!missingBatch.ok && missingBatch.code === 'RECHARGE_BATCH_NOT_REFUNDABLE', '无效原批次应被拒绝');
  assertEqual(JSON.stringify(parkState.state), before, '企业退款校验失败不得改变状态');
});

test('线下企业退款退回企业付款账户且重复请求不重复冻结', () => {
  const parkState = runSharedState(createPageContext());
  const balance = getPrimaryEnterpriseBalance(getPrimaryAccount(parkState));
  const created = parkState.actions.createEnterpriseRecharge({ enterpriseId: 'E001', rechargeParkId: 'park-001', method: 'offline', requestId: 'ER-OFFLINE-REFUND', items: [{ userId: 'U001', amount: 30 }] });
  assert(created.ok && parkState.actions.confirmOfflineRecharge(created.data.id, 'voucher.pdf').ok, '线下充值准备失败');
  const input = { enterpriseId: 'E001', adminUserId: 'U003', items: [{ userId: 'U001', amount: 20, rechargeBatchId: created.data.id }], requestId: 'ER-OFFLINE-REFUND-APPLY' };
  const first = parkState.actions.applyEnterpriseRefund(input);
  assert(first.ok, '线下企业退款申请失败：' + first.code);
  assertEqual(first.data.refundDestination, 'enterprise_payer_account', '线下企业退款去向');
  const availableAfterFirst = balance.available;
  const replay = parkState.actions.applyEnterpriseRefund(input);
  assert(replay.ok && replay.idempotent, '重复企业退款应幂等');
  assertApprox(balance.available, availableAfterFirst, '重复企业退款不得再次冻结');
});

test('消费发票拒绝非订单用户和已退款订单并按请求幂等', () => {
  const parkState = runSharedState(createPageContext());
  const merchant = parkState.state.merchants.find(item => item.parkId === 'park-002');
  const paid = parkState.actions.collectPayment({ userId: 'U001', merchantId: merchant.id, amount: 10, requestId: 'INVOICE-GUARDS-PAY' });
  assert(paid.ok, '消费准备失败');
  const title = { name: '测试企业', taxId: '911100000000000001' };
  const denied = parkState.actions.applyConsumeInvoice({ orderId: paid.data.order.id, applicantUserId: 'U002', title, requestId: 'INVOICE-DENIED' });
  assert(!denied.ok && denied.code === 'APPLICANT_FORBIDDEN', '非订单用户应被拒绝');
  const input = { orderId: paid.data.order.id, applicantUserId: 'U001', title, requestId: 'INVOICE-IDEMPOTENT' };
  const first = parkState.actions.applyConsumeInvoice(input);
  assert(first.ok, '消费发票申请失败');
  const replay = parkState.actions.applyConsumeInvoice(input);
  assert(replay.ok && replay.idempotent && replay.data.id === first.data.id, '消费发票重复请求应幂等');
  const second = parkState.actions.applyConsumeInvoice({ orderId: paid.data.order.id, applicantUserId: 'U001', title, requestId: 'INVOICE-SECOND' });
  assert(!second.ok && second.code === 'INVOICE_ALREADY_APPLIED', '同一订单不得重复申请发票');

  const refundedPayment = parkState.actions.collectPayment({ userId: 'U001', merchantId: merchant.id, amount: 8, requestId: 'INVOICE-REFUNDED-PAY' });
  assert(refundedPayment.ok, '退款订单准备失败');
  assert(parkState.actions.refundConsume(refundedPayment.data.order.id, { merchantId: merchant.id }).ok, '订单退款准备失败');
  const refundedInvoice = parkState.actions.applyConsumeInvoice({ orderId: refundedPayment.data.order.id, applicantUserId: 'U001', title, requestId: 'INVOICE-REFUNDED' });
  assert(!refundedInvoice.ok && refundedInvoice.code === 'ORDER_NOT_INVOICEABLE', '已退款订单不得申请发票');
});

test('已结算消费订单退款转入冲正流程且状态不变', () => {
  const parkState = runSharedState(createPageContext());
  const prepared = prepareMixedBalance(parkState, 60, 50);
  const merchant = parkState.state.merchants.find(item => item.parkId === 'park-002');
  const paid = parkState.actions.collectPayment({ userId: 'U001', merchantId: merchant.id, amount: 80, requestId: 'SETTLED-REFUND-PAY' });
  assert(paid.ok, '消费准备失败');
  paid.data.order.settlementStatus = 'settled';
  const before = JSON.stringify(parkState.state);
  const response = parkState.actions.refundConsume(paid.data.order.id, { merchantId: merchant.id });
  assert(!response.ok && response.code === 'SETTLED_REFUND_REQUIRES_REVERSAL', '已结算订单应转入冲正流程');
  assertEqual(JSON.stringify(parkState.state), before, '已结算退款不得直接改变状态');
  assertApprox(prepared.balance.available, 0, '已结算退款不得恢复企业余额');
  assertApprox(prepared.account.personal.available, 30, '已结算退款不得恢复个人余额');
});

test('进入待结算记录的消费订单退款转入冲正流程且状态不变', () => {
  const parkState = runSharedState(createPageContext());
  const prepared = prepareMixedBalance(parkState, 60, 50);
  const merchant = parkState.state.merchants.find(item => item.parkId === 'park-002');
  const paid = parkState.actions.collectPayment({ userId: 'U001', merchantId: merchant.id, amount: 80, requestId: 'SETTLING-REFUND-PAY' });
  assert(paid.ok, '消费准备失败');
  const synced = parkState.actions.syncSettlements();
  assert(synced.ok && paid.data.order.settlementStatus === 'settling', '订单应已进入待结算记录');
  const before = JSON.stringify(parkState.state);
  const response = parkState.actions.refundConsume(paid.data.order.id, { merchantId: merchant.id });
  assert(!response.ok && response.code === 'SETTLED_REFUND_REQUIRES_REVERSAL', '已进入结算的订单应转入冲正流程');
  assertEqual(JSON.stringify(parkState.state), before, '待结算订单退款不得直接改变状态');
  assertApprox(prepared.balance.available, 0, '待结算订单退款不得恢复企业余额');
  assertApprox(prepared.account.personal.available, 30, '待结算订单退款不得恢复个人余额');
});

test('结算按消费园区和商户归组并更新订单状态', () => {
  const parkState = runSharedState(createPageContext());
  const merchant = parkState.state.merchants.find(item => item.parkId === 'park-002');
  const paid = parkState.actions.collectPayment({ userId: 'U001', merchantId: merchant.id, amount: 12, requestId: 'SETTLEMENT-PAY' });
  assert(paid.ok, '消费准备失败');
  const synced = parkState.actions.syncSettlements();
  assert(synced.ok, '结算同步失败：' + synced.code);
  const settlement = parkState.state.pendingSettlements.find(item => Array.isArray(item.orderIds) && item.orderIds.includes(paid.data.order.id));
  assert(settlement, '消费订单未进入结算');
  assertEqual(settlement.consumeParkId, 'park-002', '结算归属消费园区');
  assertEqual(settlement.merchantId, merchant.id, '结算归属原商户');
  assertEqual(paid.data.order.settlementStatus, 'settling', '进入待结算记录后订单状态');
});

test('重复同步结算不重复纳入订单', () => {
  const parkState = runSharedState(createPageContext());
  const merchant = parkState.state.merchants.find(item => item.parkId === 'park-002');
  const paid = parkState.actions.collectPayment({ userId: 'U001', merchantId: merchant.id, amount: 12, requestId: 'SETTLEMENT-IDEMPOTENT' });
  assert(paid.ok, '消费准备失败');
  const first = parkState.actions.syncSettlements();
  assert(first.ok && first.data.length === 1, '首次结算同步应创建一条记录');
  const afterFirst = JSON.stringify(parkState.state);
  const replay = parkState.actions.syncSettlements();
  assert(replay.ok && replay.data.length === 0, '重复同步不得创建结算记录');
  assertEqual(JSON.stringify(parkState.state), afterFirst, '重复同步不得改变状态');
  const occurrences = parkState.state.pendingSettlements.reduce((count, settlement) => {
    return count + (settlement.orderIds.includes(paid.data.order.id) ? 1 : 0);
  }, 0);
  assertEqual(occurrences, 1, '同一订单只能进入一条结算记录');
});

test('对账原始消费记录已覆盖订单时不再添加派生订单行', () => {
  const parkState = runSharedState(createPageContext());
  const order = {
    id: 'ORD-COVERED-01',
    requestId: 'REQ-COVERED-01',
    userId: 'U001',
    merchantId: 'M001',
    amount: 28,
    enterpriseDeductions: [],
    personalAmount: 28,
    rechargeParkIds: ['park-001'],
    consumeParkId: 'park-001',
    paymentStatus: 'paid',
    invoiceStatus: 'not_applied',
    refundStatus: 'none',
    settlementStatus: 'pending',
    createdAt: '2026-09-21 10:00'
  };
  parkState.state.orders.push(order);
  parkState.state.reconciliationRows.push({
    id: 'RC-COVERED-01',
    type: 'consume',
    subject: order.id,
    rechargeParkId: 'park-001',
    consumeParkId: 'park-001',
    amount: order.amount,
    platformStatus: order.paymentStatus,
    channelStatus: order.settlementStatus,
    diff: 'consistent',
    checked: false,
    checkedAt: null
  });

  const elements = runAdminReconciliation(parkState.state);
  const renderedIds = elements.get('rows').children.map(row => row.children[0].textContent);
  assertEqual(renderedIds.filter(id => id === 'RC-COVERED-01').length, 1, '原始消费对账行应保留一次');
  assert(!renderedIds.includes('ORDER-' + order.id), '已有 type=consume、subject=order.id 的对账行时不得再派生订单行');
});

test('首页和共享导航提供四端入口', () => {
  const landing = readRequired('index');
  const nav = readRequired('sharedNav');
  ['个人与企业双余额', '跨园区消费', '企业批量充值', '多方结算对账', 'enterprise-overview.html'].forEach(text => assert(landing.includes(text), '首页缺少：' + text));
  assert(nav.includes("currentPath.startsWith('enterprise-')"), '共享导航未识别 enterprise- 前缀');
  ['enterprise-overview.html', 'enterprise-employees.html', 'enterprise-recharge.html', 'enterprise-batches.html', 'enterprise-refunds.html', 'enterprise-receipts.html'].forEach(page => assert(nav.includes(page), '企业导航缺少：' + page));
});

test('后台企业页面真实字段：管理员和员工均使用数组字段', () => {
  const source = readRequired('adminEnterprises');
  assert(source.includes('ent.adminUserIds'), '企业管理员未使用 adminUserIds');
  assert(source.includes('ent.employeeUserIds'), '关联员工未使用 employeeUserIds');
  assert(!/ent\.adminUserId\b/.test(source), '企业页面仍在读取旧字段 adminUserId');
  assert(!/ent\.employeeIds\b/.test(source), '企业页面仍在读取旧字段 employeeIds');
});

test('后台企业页面真实字段：代充值员工使用数组字段且提交前拦截空值', () => {
  const source = readRequired('adminEnterpriseRecharge');
  assert(source.includes('found.employeeUserIds'), '代充值员工未使用 employeeUserIds');
  assert(!/found\.employeeIds\b/.test(source), '代充值页面仍在读取旧字段 employeeIds');
  assert(source.includes("if(!enterprise.value||!employee.value||!Number.isFinite(value)||value<=0)"), '创建批次前未校验企业、员工和金额');
});

const PAGE_CONTRACTS = {
  enterpriseOverview: ['累计充值', '员工企业余额', '可退金额', '待支付批次'],
  enterpriseEmployees: ['员工', '企业余额', '累计充值', '累计消费'],
  enterpriseRecharge: ['选择员工', '核对充值清单', '在线支付', '批量'],
  enterpriseBatches: ['批次编号', '支付状态', '入账状态'],
  enterpriseRefunds: ['未消费企业余额', '原充值批次', '退款去向'],
  enterpriseReceipts: ['充值收据', '退款凭据'],
  userOrders: ['企业余额扣款', '个人余额扣款', '消费园区'],
  merchantInvoices: ['消费发票', '抬头', '税号'],
  adminEnterprises: ['企业管理员', '关联员工', '充值', '退款'],
  adminEnterpriseRecharge: ['支付凭证', '到账确认', '错误明细'],
  adminRechargeBatches: ['个人在线充值', '企业在线充值', '园区代企业充值'],
  adminReconciliation: ['充值园区', '消费园区', '重复请求', '退款结算冲突']
};

Object.entries(PAGE_CONTRACTS).forEach(([name, fields]) => {
  test('页面关键字段：' + FILES[name], () => {
    const source = readRequired(name);
    fields.forEach(field => assert(source.includes(field), FILES[name] + ' 缺少关键字段：' + field));
  });
});

// Execute the actual inline page scripts against the real V2 seed, not a stand-in model.
function renderDemoPage(name) {
  const html = readRequired(name);
  const context = createPageContext();
  const parkState = runSharedState(context);
  const nodes = new Map();
  function element(tag = 'div') {
    const handlers = {};
    const node = {
      tagName: tag.toUpperCase(), children: [], dataset: {}, style: {}, value: '', hidden: false,
      textContent: '', innerHTML: '', className: '',
      classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
      get firstChild() { return this.children[0] || null; },
      appendChild(child) { this.children.push(child); return child; },
      prepend(child) { this.children.unshift(child); },
      removeChild(child) { this.children.splice(this.children.indexOf(child), 1); return child; },
      append(...children) { children.forEach(child => this.appendChild(child)); },
      replaceChildren(...children) { this.children = children; this.innerHTML = ''; },
      setAttribute(key, value) { if (key === 'data-order-id') this.dataset.orderId = value; },
      addEventListener(type, fn) { (handlers[type] ||= []).push(fn); },
      click() { (handlers.click || []).forEach(fn => fn({ target: this, preventDefault() {}, stopPropagation() {} })); },
      querySelector() { return element(); },
      querySelectorAll(selector) { return selector === 'tr' ? this.children.filter(child => child.tagName === 'TR') : []; },
      showModal() {}, closest() { return this; }
    };
    return node;
  }
  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) nodes.set(id, element());
  const buttons = new Map();
  for (const [, group, attrs] of html.matchAll(/<div[^>]+id="([^"]+)"[^>]*>([\s\S]*?)<\/div>/g)) {
    const groupButtons = [...attrs.matchAll(/<button\b([^>]*)>/g)].map(([, attributes]) => {
      const button = element('button');
      const status = attributes.match(/data-status="([^"]+)"/);
      const range = attributes.match(/data-range="([^"]+)"/);
      button.dataset = { status: status && status[1], range: range && range[1] };
      return button;
    });
    if (groupButtons.length) buttons.set(group, groupButtons);
  }
  const document = {
    createElement: element,
    getElementById(id) { return nodes.get(id) || null; },
    querySelectorAll(selector) {
      const group = selector.match(/^#([\w-]+) button$/);
      if (group) return buttons.get(group[1]) || [];
      if (selector === '.chip') return [];
      if (selector === '#view-toggle button') return [];
      if (selector === '[data-export]') return [];
      return [];
    },
    addEventListener() {}
  };
  Object.assign(context.window, { document, parkState, location: { search: '' },
    parkV2Admin: { getCurrentParkId() { return 'park-001'; } },
    formatMoney(value) { return Number(value).toFixed(2); }, alert() {}, addEventListener() {} });
  const script = extractInlineScripts(html).filter(source => source.trim()).pop();
  vm.runInNewContext(script, context.window, { filename: FILES[name] });
  return { nodes, buttons, parkState };
}

const DEMO_LISTS = [
  ['userWallet', 'list-modal-body', '.tx-item', 'all-transactions'],
  ['userInvoices', 'apply-list', '.invoice-record'],
  ['userRefund', 'request-list', '.request-card'],
  ['enterpriseEmployees', 'employeeRows', '<tr'],
  ['merchantOrders', 'order-list', '.order-item'],
  ['merchantSettlements', 'flow-list', '.flow-card'],
  ['adminAccounts', 'accounts-body', '<tr'],
  ['adminOrders', 'order-table', '<tr'],
  ['adminSettlements', 'settlement-table', '<tr'],
  ['adminRefunds', 'refund-table', '<tr']
];
DEMO_LISTS.forEach(([page, id, marker, openId]) => {
  test('默认角色完整列表渲染至少十条：' + FILES[page], () => {
    const { nodes } = renderDemoPage(page);
    if (openId) nodes.get(openId).click();
    const list = nodes.get(id);
    const count = marker === '<tr' ? list.children.length + (list.innerHTML.match(/<tr\b/g) || []).length
      : marker === '.tx-item' || marker === '.order-item' || marker === '.flow-card' || marker === '.request-card'
        ? list.children.filter(item => item.className === marker.slice(1)).length
        : (list.innerHTML.match(/class="invoice-record"/g) || []).length + list.children.filter(item => item.className === marker.slice(1)).length;
    assert(count >= 10, FILES[page] + ' ' + id + ' 仅渲染 ' + count + ' 条，预期至少 10 条');
  });
});

const ADDITIONAL_DEMO_LISTS = [
  ['userOrders', 'order-list', 'order-card'],
  ['merchantInvoices', 'invoice-list', 'invoice-card'],
  ['enterpriseBatches', 'batchRows', 'batch-row'],
  ['enterpriseReceipts', 'receiptList', 'record-card'],
  ['enterpriseReceipts', 'refundList', 'record-card'],
  ['adminEnterprises', 'enterprise-table', 'tr'],
  ['adminMerchants', 'merchantTable', 'tr'],
  ['adminRechargeBatches', 'rows', 'tr'],
  ['adminReconciliation', 'rows', 'tr'],
  ['enterpriseRefunds', 'sourceList', 'source-row']
];
ADDITIONAL_DEMO_LISTS.forEach(([page, id, className]) => {
  test('默认角色完整列表渲染至少十条：' + FILES[page] + ' #' + id, () => {
    const { nodes } = renderDemoPage(page);
    const list = nodes.get(id);
    assert(list, FILES[page] + ' 缺少真实列表节点 #' + id);
    const count = list.children.filter(item => className === 'tr' ? item.tagName === 'TR' && !item.children.some(cell => cell.className === 'empty') : item.className === className).length;
    assert(count >= 10, FILES[page] + ' ' + id + ' 仅渲染 ' + count + ' 条，预期至少 10 条');
  });
});

test('商户首页近期收款按真实订单日期和退款状态渲染', () => {
  const { nodes, buttons, parkState } = renderDemoPage('merchantHome');
  const recent = nodes.get('recent-orders');
  const expected = parkState.state.orders.filter(order => order.merchantId === 'M002' && new Date(String(order.createdAt).replace(/-/g, '/')) >= new Date(Date.now() - 7 * 86400000));
  assert(expected.length > 0, '种子数据应包含近七天商户订单');
  assertEqual(Number(nodes.get('hero-count').textContent), expected.length, '近七天汇总应按 createdAt 计算');
  assert(recent.children.some(item => item.className === 'order-item'), '近期收款应显示真实订单');
  const refunded = buttons.get('collection-status-filter').find(button => button.dataset.status === 'refunded');
  assert(refunded, '缺少已退款筛选按钮');
  refunded.click();
  const expectedRefunded = expected.filter(order => order.refundStatus === 'refunded');
  assertEqual(Number(nodes.get('hero-count').textContent), expectedRefunded.length, '已退款筛选应读取 refundStatus');
});

console.log('Results:');
results.forEach(result => {
  console.log('  ' + result.status + ': ' + result.name);
  if (result.status === 'FAIL') console.log('        ' + result.message);
});
console.log('\nTotal: ' + passCount + ' passed, ' + failCount + ' failed');
process.exit(failCount > 0 ? 1 : 0);
