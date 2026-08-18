(function () {
  'use strict';

  const STORAGE_KEY = 'parkStateV2';
  const VERSION_KEY = 'parkStateV2Version';
  const DATA_VERSION = 'demo-2026-08-07-1';
  const COLLECTION_KEYS = ['parks', 'users', 'accounts', 'batches', 'transactions', 'orders', 'refundRequests', 'merchants', 'invoiceTitles', 'invoiceRecords', 'pendingSettlements', 'reconciliationRows'];
  const FORBIDDEN_KEYS = [
    ['prin', 'cipal'].join(''),
    ['gi', 'ft'].join(''),
    ['bo', 'nus'].join(''),
    ['cam', 'paign'].join(''),
    ['remaining', 'Gi', 'ft'].join(''),
    ['remaining', 'Prin', 'cipal'].join('')
  ];
  const TRANSACTION_TYPES = ['recharge', 'consume', 'consume_refund', 'balance_refund'];
  const TRANSACTION_STATUSES = ['success'];
  const ORDER_STATUSES = ['paid', 'refunding', 'refunded', 'payment_failed'];
  const BATCH_STATUSES = ['active'];
  const REFUND_STATUSES = ['pending_review', 'reviewing', 'rejected', 'arrived', 'completed', 'manual_processing'];
  const SETTLEMENT_STATUSES = ['pending', 'processing', 'success', 'failed'];
  const RECONCILIATION_TYPES = ['recharge', 'consume', 'consume_refund', 'balance_refund', 'settlement'];
  const RECONCILIATION_DIFFS = ['consistent', 'amount_mismatch', 'status_mismatch', 'missing', 'duplicate'];
  const PLATFORM_STATUSES = ['success', 'pending', 'processing', 'paid', 'refunded', 'closed', 'failed'];
  const CHANNEL_STATUSES = ['success', 'pending', 'processing', 'failed', 'amount_diff', 'none', 'duplicate'];
  const TOP_LEVEL_KEYS = ['parks', 'users', 'accounts', 'user', 'wallet', 'batches', 'transactions', 'orders', 'refundRequests', 'merchants', 'merchantConfig', 'invoiceTitles', 'invoiceRecords', 'pendingSettlements', 'reconciliationRows'];
  const MAX_ID_LENGTH = 64;
  const MAX_TEXT_LENGTH = 120;
  const MAX_NOTES_LENGTH = 500;

  function demoTime(daysAgo, hhmm) {
    const date = new Date(Date.now() - daysAgo * 86400000);
    const pad = v => String(v).padStart(2, '0');
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + hhmm;
  }

  const defaults = {
    parks: [
      { id: 'park-001', name: '海智园区' },
      { id: 'park-002', name: '海创园区' },
      { id: 'park-003', name: '空白园区' }
    ],
    users: [
      { id: 'U001', parkId: 'park-001', name: '张伟', phone: '13800131234', enterpriseName: '北京海开智慧园区科技有限公司' },
      { id: 'U003', parkId: 'park-001', name: '王强', phone: '13700139012', enterpriseName: '北京海智产业运营有限公司' },
      { id: 'U004', parkId: 'park-001', name: '赵敏', phone: '13600136012', enterpriseName: '北京海开智慧园区科技有限公司' },
      { id: 'U002', parkId: 'park-002', name: '李娜', phone: '13900139001', enterpriseName: '北京海创科技服务有限公司' }
    ],
    accounts: [
      { id: 'A001', parkId: 'park-001', userId: 'U001', total: 238.00, available: 238.00, frozen: 0.00, consumed: 62.00 },
      { id: 'A003', parkId: 'park-001', userId: 'U003', total: 120.00, available: 0.00, frozen: 80.00, consumed: 40.00 },
      { id: 'A004', parkId: 'park-001', userId: 'U004', total: 80.00, available: 0.00, frozen: 75.00, consumed: 5.00 },
      { id: 'A002', parkId: 'park-002', userId: 'U002', total: 120.00, available: 90.00, frozen: 10.00, consumed: 20.00 }
    ],
    user: { id: 'U001', parkId: 'park-001', name: '张伟', phone: '13800131234', enterpriseName: '北京海开智慧园区科技有限公司' },
    wallet: { total: 238.00, available: 238.00, frozen: 0.00 },
    batches: [
      { id: 'B20260712001', parkId: 'park-001', userId: 'U001', amount: 100.00, remaining: 100.00, createdAt: '2026-07-12 09:18', status: 'active' },
      { id: 'B20260712002', parkId: 'park-001', userId: 'U001', amount: 200.00, remaining: 138.00, createdAt: '2026-07-13 10:05', status: 'active' },
      { id: 'B20260714001', parkId: 'park-001', userId: 'U003', amount: 120.00, remaining: 80.00, createdAt: '2026-07-14 09:30', status: 'active' },
      { id: 'B20260714002', parkId: 'park-001', userId: 'U004', amount: 80.00, remaining: 75.00, createdAt: '2026-07-14 10:20', status: 'active' },
      { id: 'B20260712003', parkId: 'park-002', userId: 'U002', amount: 120.00, remaining: 100.00, createdAt: '2026-07-13 11:05', status: 'active' }
    ],
    transactions: [
      { id: 'T1001', parkId: 'park-001', userId: 'U001', type: 'recharge', title: '余额充值', amount: 200.00, time: '2026-07-12 09:18', status: 'success', channel: '微信支付' },
      { id: 'T1002', parkId: 'park-001', userId: 'U001', merchantId: 'M001', type: 'consume', title: '园区食堂消费', amount: -28.00, merchant: '园区食堂', time: '2026-07-14 12:36', status: 'success' },
      { id: 'T1003', parkId: 'park-001', userId: 'U001', merchantId: 'M002', type: 'consume', title: '海智咖啡 HUB', amount: -18.00, merchant: '海智咖啡 HUB', time: '2026-07-14 14:18', status: 'success' },
      { id: 'T1004', parkId: 'park-001', userId: 'U001', type: 'recharge', title: '余额充值', amount: 84.00, time: '2026-07-13 10:05', status: 'success', channel: '微信支付' },
      { id: 'T2001', parkId: 'park-002', userId: 'U002', type: 'recharge', title: '余额充值', amount: 120.00, time: '2026-07-13 11:05', status: 'success', channel: '支付宝' },
      { id: 'T-DMO-R1', parkId: 'park-001', userId: 'U001', type: 'recharge', title: '余额充值', amount: 100.00, time: demoTime(0, '08:15'), status: 'success', channel: '微信支付' },
      { id: 'T-DMO-R2', parkId: 'park-001', userId: 'U001', type: 'recharge', title: '余额充值', amount: 200.00, time: demoTime(6, '14:00'), status: 'success', channel: '微信支付' },
      { id: 'T-DMO-R3', parkId: 'park-001', userId: 'U003', type: 'recharge', title: '余额充值', amount: 120.00, time: demoTime(4, '09:00'), status: 'success', channel: '微信支付' },
      { id: 'T-DMO-R4', parkId: 'park-001', userId: 'U004', type: 'recharge', title: '余额充值', amount: 80.00, time: demoTime(5, '10:10'), status: 'success', channel: '支付宝' },
      { id: 'T-DMO-01', parkId: 'park-001', userId: 'U001', merchantId: 'M001', type: 'consume', title: '园区食堂消费', amount: -32.00, merchant: '园区食堂', orderId: 'DMO-YQST-T01', time: demoTime(0, '12:05'), status: 'success' },
      { id: 'T-DMO-02', parkId: 'park-001', userId: 'U001', merchantId: 'M002', type: 'consume', title: '海智咖啡 HUB 消费', amount: -25.50, merchant: '海智咖啡 HUB', orderId: 'DMO-HZKF-T01', time: demoTime(0, '09:42'), status: 'success' },
      { id: 'T-DMO-03', parkId: 'park-001', userId: 'U003', merchantId: 'M002', type: 'consume', title: '海智咖啡 HUB 消费', amount: -18.00, merchant: '海智咖啡 HUB', orderId: 'DMO-HZKF-T02', time: demoTime(0, '10:15'), status: 'success' },
      { id: 'T-DMO-04', parkId: 'park-001', userId: 'U001', merchantId: 'M002', type: 'consume', title: '海智咖啡 HUB 消费', amount: -36.00, merchant: '海智咖啡 HUB', orderId: 'DMO-HZKF-Y01', time: demoTime(1, '15:20'), status: 'success' },
      { id: 'T-DMO-05', parkId: 'park-001', userId: 'U004', merchantId: 'M001', type: 'consume', title: '园区食堂消费', amount: -24.00, merchant: '园区食堂', orderId: 'DMO-YQST-Y01', time: demoTime(1, '12:30'), status: 'success' },
      { id: 'T-DMO-06', parkId: 'park-001', userId: 'U001', merchantId: 'M002', type: 'consume', title: '海智咖啡 HUB 消费', amount: -21.00, merchant: '海智咖啡 HUB', orderId: 'DMO-HZKF-Y02', time: demoTime(2, '08:50'), status: 'success' },
      { id: 'T-DMO-07', parkId: 'park-001', userId: 'U003', merchantId: 'M001', type: 'consume', title: '园区食堂消费', amount: -28.00, merchant: '园区食堂', orderId: 'DMO-YQST-Y02', time: demoTime(3, '12:10'), status: 'success' },
      { id: 'T-DMO-08', parkId: 'park-001', userId: 'U003', merchantId: 'M001', type: 'consume_refund', title: '园区食堂消费退款', amount: 28.00, merchant: '园区食堂', orderId: 'DMO-YQST-Y02', time: demoTime(2, '09:30'), status: 'success' },
      { id: 'T-DMO-09', parkId: 'park-002', userId: 'U002', merchantId: 'M201', type: 'consume', title: '海创食堂消费', amount: -22.00, merchant: '海创食堂', orderId: 'DMO-HCST-T01', time: demoTime(0, '12:20'), status: 'success' }
    ],
    orders: [
      { id: 'YQST-2026071412360001', parkId: 'park-001', userId: 'U001', merchant: '园区食堂', merchantId: 'M001', amount: 28.00, time: '2026-07-14 12:36', status: 'paid', refundDeadline: '2026-07-15 23:59' },
      { id: 'HZKF-2026071414180001', parkId: 'park-001', userId: 'U001', merchant: '海智咖啡 HUB', merchantId: 'M002', amount: 18.00, time: '2026-07-14 14:18', status: 'paid', refundDeadline: '2026-07-15 23:59' },
      { id: 'YQBLD-2026071509100001', parkId: 'park-001', userId: 'U001', merchant: '园区便利店', merchantId: 'M003', amount: 12.00, time: '2026-07-15 09:10', status: 'payment_failed', refundDeadline: '2026-07-16 23:59' },
      { id: 'YQST-2026071318200001', parkId: 'park-001', userId: 'U001', merchant: '园区食堂', merchantId: 'M001', amount: 16.00, time: '2026-07-13 18:20', status: 'refunded', refundDeadline: '2026-07-14 23:59' },
      { id: 'HCST-2026071512100001', parkId: 'park-002', userId: 'U002', merchant: '海创食堂', merchantId: 'M201', amount: 20.00, time: '2026-07-15 12:10', status: 'paid', refundDeadline: '2026-07-16 23:59' },
      { id: 'DMO-YQST-T01', parkId: 'park-001', userId: 'U001', merchant: '园区食堂', merchantId: 'M001', amount: 32.00, time: demoTime(0, '12:05'), status: 'paid', refundDeadline: demoTime(-1, '23:59') },
      { id: 'DMO-HZKF-T01', parkId: 'park-001', userId: 'U001', merchant: '海智咖啡 HUB', merchantId: 'M002', amount: 25.50, time: demoTime(0, '09:42'), status: 'paid', refundDeadline: demoTime(-1, '23:59'), remark: '两杯拿铁' },
      { id: 'DMO-HZKF-T02', parkId: 'park-001', userId: 'U003', merchant: '海智咖啡 HUB', merchantId: 'M002', amount: 18.00, time: demoTime(0, '10:15'), status: 'paid', refundDeadline: demoTime(-1, '23:59') },
      { id: 'DMO-HZKF-Y01', parkId: 'park-001', userId: 'U001', merchant: '海智咖啡 HUB', merchantId: 'M002', amount: 36.00, time: demoTime(1, '15:20'), status: 'paid', refundDeadline: demoTime(0, '23:59') },
      { id: 'DMO-YQST-Y01', parkId: 'park-001', userId: 'U004', merchant: '园区食堂', merchantId: 'M001', amount: 24.00, time: demoTime(1, '12:30'), status: 'paid', refundDeadline: demoTime(0, '23:59') },
      { id: 'DMO-HZKF-Y02', parkId: 'park-001', userId: 'U001', merchant: '海智咖啡 HUB', merchantId: 'M002', amount: 21.00, time: demoTime(2, '08:50'), status: 'refunding', refundDeadline: demoTime(1, '23:59') },
      { id: 'DMO-YQST-Y02', parkId: 'park-001', userId: 'U003', merchant: '园区食堂', merchantId: 'M001', amount: 28.00, time: demoTime(3, '12:10'), status: 'refunded', refundDeadline: demoTime(2, '23:59') },
      { id: 'DMO-YQBLD-T01', parkId: 'park-001', userId: 'U001', merchant: '园区便利店', merchantId: 'M003', amount: 15.80, time: demoTime(0, '08:20'), status: 'payment_failed', refundDeadline: demoTime(-1, '23:59') },
      { id: 'DMO-HCST-T01', parkId: 'park-002', userId: 'U002', merchant: '海创食堂', merchantId: 'M201', amount: 22.00, time: demoTime(0, '12:20'), status: 'paid', refundDeadline: demoTime(-1, '23:59') }
    ],
    refundRequests: [
      { id: 'RR9101', parkId: 'park-001', userId: 'U003', amount: 60.00, frozenAmount: 60.00, batchAllocations: [{ batchId: 'B20260714001', amount: 60.00 }], createdAt: '2026-07-18 10:00', status: 'pending_review', notes: '离职退余额' },
      { id: 'RR9102', parkId: 'park-001', userId: 'U004', amount: 30.00, frozenAmount: 30.00, batchAllocations: [{ batchId: 'B20260714002', amount: 30.00 }], createdAt: '2026-07-17 15:30', status: 'reviewing', notes: '搬离园区，申请注销' },
      { id: 'RR9103', parkId: 'park-001', userId: 'U004', amount: 45.00, frozenAmount: 45.00, batchAllocations: [{ batchId: 'B20260714002', amount: 45.00 }], createdAt: '2026-07-16 11:20', status: 'arrived', notes: '退款已原路到账，待确认完成' },
      { id: 'RR9104', parkId: 'park-001', userId: 'U003', amount: 20.00, frozenAmount: 20.00, batchAllocations: [{ batchId: 'B20260714001', amount: 20.00 }], createdAt: '2026-07-15 14:10', status: 'manual_processing', notes: '渠道退款失败，转人工处理' },
      { id: 'RR9105', parkId: 'park-001', userId: 'U001', amount: 66.00, frozenAmount: 66.00, batchAllocations: [{ batchId: 'B20260712001', amount: 66.00 }], createdAt: '2026-07-13 09:40', status: 'rejected', notes: '资料不全，已驳回' },
      { id: 'RR9106', parkId: 'park-001', userId: 'U001', amount: 50.00, frozenAmount: 50.00, batchAllocations: [{ batchId: 'B20260712002', amount: 50.00 }], createdAt: '2026-07-12 16:25', status: 'completed', notes: '退款已完成' }
    ],
    invoiceTitles: [
      { id: 'TITLE-DMO-1', parkId: 'park-001', userId: 'U001', name: '北京海开智慧园区科技有限公司', taxId: '91110108MA01C8X2B', address: '北京市海淀区中关村大街 1 号', phone: '010-88886666', bank: '中国工商银行北京中关村支行', bankAccount: '0200048809100012345', isDefault: true, deletedAt: null }
    ],
    invoiceRecords: [
      { id: 'INV-DMO-01', parkId: 'park-001', userId: 'U001', transactionId: 'T1004', titleId: 'TITLE-DMO-1', titleSnapshot: { name: '北京海开智慧园区科技有限公司', taxId: '91110108MA01C8X2B' }, amount: 84.00, status: 'issued', createdAt: demoTime(5, '16:00'), requestId: 'REQ-INV-DMO-01' },
      { id: 'INV-DMO-02', parkId: 'park-001', userId: 'U001', transactionId: 'T-DMO-R2', titleId: 'TITLE-DMO-1', titleSnapshot: { name: '北京海开智慧园区科技有限公司', taxId: '91110108MA01C8X2B' }, amount: 200.00, status: 'pending', createdAt: demoTime(0, '09:00'), requestId: 'REQ-INV-DMO-02' }
    ],
    merchants: [
      { id: 'M001', parkId: 'park-001', name: '园区食堂' },
      { id: 'M002', parkId: 'park-001', name: '海智咖啡 HUB' },
      { id: 'M003', parkId: 'park-001', name: '园区便利店' },
      { id: 'M201', parkId: 'park-002', name: '海创食堂' }
    ],
    merchantConfig: {
      'M001': { name: '园区食堂', ratio: 0.85, cycle: 'T+1', refundWindowHours: 24, prefix: 'YQST' },
      'M002': { name: '海智咖啡 HUB', ratio: 0.80, cycle: '周结', refundWindowHours: 24, prefix: 'HZKF' },
      'M003': { name: '园区便利店', ratio: 0.82, cycle: 'T+1', refundWindowHours: 24, prefix: 'YQBLD' },
      'M201': { name: '海创食堂', ratio: 0.85, cycle: 'T+1', refundWindowHours: 24, prefix: 'HCST' }
    },
    pendingSettlements: [
      { id: 'S3001', parkId: 'park-001', merchantId: 'M001', orderIds: ['YQST-2026071412360001'], total: 28.00, merchantShare: 23.80, parkShare: 4.20, ratio: 0.85, cycle: 'T+1', status: 'pending', paymentReference: null, paymentRecordedAt: null, failReason: null },
      { id: 'S-DMO-01', parkId: 'park-001', merchantId: 'M002', orderIds: ['DMO-HZKF-Y01'], total: 36.00, merchantShare: 28.80, parkShare: 7.20, ratio: 0.80, cycle: '周结', status: 'success', paymentReference: 'SPAY-20260721-001', paymentRecordedAt: demoTime(1, '18:00'), failReason: null },
      { id: 'S-DMO-02', parkId: 'park-001', merchantId: 'M001', orderIds: ['DMO-YQST-Y01'], total: 24.00, merchantShare: 20.40, parkShare: 3.60, ratio: 0.85, cycle: 'T+1', status: 'success', paymentReference: 'SPAY-20260722-002', paymentRecordedAt: demoTime(0, '09:00'), failReason: null }
    ],
    reconciliationRows: [
      { id: 'T1001', type: 'recharge', subject: '13800131234', amount: 200.00, platformStatus: 'success', channelStatus: 'success', diff: 'consistent', checked: false, checkedAt: null },
      { id: 'T1002', type: 'consume', subject: '园区食堂', amount: -28.00, platformStatus: 'success', channelStatus: 'success', diff: 'consistent', checked: false, checkedAt: null }
    ]
  };

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isPlainObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function hasExactKeys(value, required, optional) {
    const keys = Object.keys(value);
    const allowed = required.concat(optional || []);
    return required.every(key => Object.prototype.hasOwnProperty.call(value, key)) && keys.every(key => allowed.includes(key));
  }

  function isSafeString(value, maxLength, allowEmpty) {
    return typeof value === 'string' && value.length <= maxLength && (allowEmpty || Boolean(value.trim())) && !/[<>]/.test(value);
  }

  function isSafeId(value) {
    return isSafeString(value, MAX_ID_LENGTH, false);
  }

  function isSafeText(value) {
    return isSafeString(value, MAX_TEXT_LENGTH, false);
  }

  function isSafeTime(value) {
    return isSafeString(value, MAX_TEXT_LENGTH, false);
  }

  function containsForbiddenKey(value) {
    if (!value || typeof value !== 'object') return false;
    return Object.keys(value).some(key => FORBIDDEN_KEYS.includes(key) || containsForbiddenKey(value[key]));
  }

  function toCents(value) {
    return Math.round(value * 100);
  }

  function fromCents(value) {
    return value / 100;
  }

  function formatDateTime(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}`;
  }

  function now() {
    return formatDateTime(new Date());
  }

  function refundDeadlineAt(hours) {
    const d = new Date();
    d.setHours(d.getHours() + (hours || 24));
    return formatDateTime(d);
  }

  function isMoney(value, allowZero) {
    return typeof value === 'number' && Number.isFinite(value) && (allowZero ? value >= 0 : value > 0) && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
  }

  function hasId(item) {
    return isSafeId(item.id);
  }

  function hasUniqueIds(collection) {
    return collection.every(hasId) && new Set(collection.map(item => item.id)).size === collection.length;
  }

  function validAllocations(allocations, batchIds, expectedCents, owner) {
    if (!Array.isArray(allocations) || !allocations.every(item => isPlainObject(item) && hasExactKeys(item, ['batchId', 'amount']) && isSafeId(item.batchId) && batchIds.has(item.batchId) && isMoney(item.amount, false))) return false;
    if (owner && !allocations.every(item => {
      const batch = batchIds instanceof Map ? batchIds.get(item.batchId) : null;
      return batch && batch.parkId === owner.parkId && batch.userId === owner.userId;
    })) return false;
    return allocations.reduce((sum, item) => sum + toCents(item.amount), 0) === expectedCents;
  }

  function validMerchantConfig(config) {
    return Object.keys(config).every(id => {
      const item = config[id];
      return isSafeId(id) && isPlainObject(item) && hasExactKeys(item, ['name', 'ratio', 'cycle', 'refundWindowHours'], ['prefix']) &&
        isSafeText(item.name) && typeof item.ratio === 'number' && Number.isFinite(item.ratio) && item.ratio >= 0 && item.ratio <= 1 &&
        isSafeText(item.cycle) && Number.isInteger(item.refundWindowHours) && item.refundWindowHours >= 0 &&
        (item.prefix === undefined || (typeof item.prefix === 'string' && /^[A-Z0-9]{2,8}$/.test(item.prefix)));
    });
  }

  function isValidState(value) {
    if (!isPlainObject(value) || !TOP_LEVEL_KEYS.every(key => Object.prototype.hasOwnProperty.call(value, key))) return false;
    if (!COLLECTION_KEYS.every(key => Array.isArray(value[key]) && value[key].every(isPlainObject))) return false;
    if (!isPlainObject(value.user) || !isPlainObject(value.wallet) || !isPlainObject(value.merchantConfig)) return false;
    if (containsForbiddenKey(value) || !hasUniqueIds(value.parks) || !hasUniqueIds(value.users) || !hasUniqueIds(value.accounts) || !hasUniqueIds(value.batches) || !hasUniqueIds(value.transactions) || !hasUniqueIds(value.orders) || !hasUniqueIds(value.refundRequests) || !hasUniqueIds(value.merchants) || !hasUniqueIds(value.invoiceTitles) || !hasUniqueIds(value.invoiceRecords) || !hasUniqueIds(value.pendingSettlements) || !hasUniqueIds(value.reconciliationRows)) return false;
    const parks = new Set(value.parks.map(item => item.id));
    const users = new Map(value.users.map(item => [item.parkId + '|' + item.id, item]));
    const merchants = new Map(value.merchants.map(item => [item.parkId + '|' + item.id, item]));
    const accounts = new Map(value.accounts.map(item => [item.parkId + '|' + item.userId, item]));
    const batches = new Map(value.batches.map(item => [item.id, item]));
    const orders = new Map(value.orders.map(item => [item.id, item]));
    const refunds = new Map(value.refundRequests.map(item => [item.id, item]));
    const validOwner = item => isSafeId(item.parkId) && parks.has(item.parkId) && isSafeId(item.userId) && users.has(item.parkId + '|' + item.userId);
    const validBatchReferences = (allocations, owner, expectedCents) => validAllocations(allocations, batches, expectedCents, owner);
    if (!value.parks.every(item => hasExactKeys(item, ['id', 'name']) && hasId(item) && isSafeText(item.name))) return false;
    if (!value.users.every(item => hasExactKeys(item, ['id', 'parkId', 'name', 'phone'], ['enterpriseName']) && hasId(item) && parks.has(item.parkId) && isSafeText(item.name) && isSafeText(item.phone) && (item.enterpriseName === undefined || isSafeText(item.enterpriseName)))) return false;
    if (!value.accounts.every(item => hasExactKeys(item, ['id', 'parkId', 'userId', 'total', 'available', 'frozen', 'consumed']) && hasId(item) && validOwner(item) && isMoney(item.total, true) && isMoney(item.available, true) && isMoney(item.frozen, true) && isMoney(item.consumed, true))) return false;
    if (!value.batches.every(item => hasExactKeys(item, ['id', 'parkId', 'userId', 'amount', 'remaining', 'createdAt', 'status'], ['requestId']) && hasId(item) && validOwner(item) && isMoney(item.amount, true) && isMoney(item.remaining, true) && toCents(item.remaining) <= toCents(item.amount) && isSafeTime(item.createdAt) && BATCH_STATUSES.includes(item.status))) return false;
    if (!value.orders.every(item => hasExactKeys(item, ['id', 'parkId', 'userId', 'merchant', 'merchantId', 'amount', 'time', 'status', 'refundDeadline'], ['batchAllocations', 'remark', 'compatStatus', 'requestId', 'userSnapshot', 'merchantSnapshot', 'settlementAmount']) && hasId(item) && validOwner(item) && merchants.has(item.parkId + '|' + item.merchantId) && isSafeText(item.merchant) && isMoney(item.amount, true) && isSafeTime(item.time) && isSafeTime(item.refundDeadline) && ORDER_STATUSES.includes(item.status) && (item.batchAllocations === undefined || validBatchReferences(item.batchAllocations, item, toCents(item.amount))) && (item.remark === undefined || isSafeString(item.remark, MAX_NOTES_LENGTH, false)) && (item.requestId === undefined || isSafeId(item.requestId)) && (item.settlementAmount === undefined || isMoney(item.settlementAmount, true)) && (item.userSnapshot === undefined || isPlainObject(item.userSnapshot)) && (item.merchantSnapshot === undefined || isPlainObject(item.merchantSnapshot)))) return false;
    if (!value.refundRequests.every(item => hasExactKeys(item, ['id', 'parkId', 'userId', 'amount', 'frozenAmount', 'batchAllocations', 'createdAt', 'status', 'notes'], ['compatStatus']) && hasId(item) && validOwner(item) && isMoney(item.amount, true) && isMoney(item.frozenAmount, true) && isSafeTime(item.createdAt) && isSafeString(item.notes, MAX_NOTES_LENGTH, false) && REFUND_STATUSES.includes(item.status) && validBatchReferences(item.batchAllocations, item, toCents(item.frozenAmount)))) return false;
    if (!value.transactions.every(item => hasExactKeys(item, ['id', 'parkId', 'userId', 'type', 'title', 'amount', 'time', 'status'], ['merchantId', 'merchant', 'orderId', 'refundId', 'requestId', 'batchId', 'channel']) && hasId(item) && validOwner(item) && TRANSACTION_TYPES.includes(item.type) && TRANSACTION_STATUSES.includes(item.status) && isSafeText(item.title) && isSafeTime(item.time) && isMoney(Math.abs(item.amount), false) && (item.orderId === undefined || (orders.has(item.orderId) && orders.get(item.orderId).parkId === item.parkId && orders.get(item.orderId).userId === item.userId)) && (item.refundId === undefined || (refunds.has(item.refundId) && refunds.get(item.refundId).parkId === item.parkId && refunds.get(item.refundId).userId === item.userId)) && (item.batchId === undefined || (batches.has(item.batchId) && batches.get(item.batchId).parkId === item.parkId && batches.get(item.batchId).userId === item.userId)) && (item.merchantId === undefined || merchants.has(item.parkId + '|' + item.merchantId)))) return false;
    if (!value.merchants.every(item => hasExactKeys(item, ['id', 'parkId', 'name']) && hasId(item) && parks.has(item.parkId) && isSafeText(item.name))) return false;
    if (!value.pendingSettlements.every(item => {
      if (!hasExactKeys(item, ['id', 'parkId', 'merchantId', 'orderIds', 'total', 'merchantShare', 'parkShare', 'ratio', 'cycle', 'status', 'paymentReference', 'paymentRecordedAt', 'failReason'])) return false;
      if (!hasId(item) || !isSafeId(item.parkId) || !parks.has(item.parkId) || !isSafeId(item.merchantId) || !merchants.has(item.parkId + '|' + item.merchantId)) return false;
      if (!Array.isArray(item.orderIds) || !item.orderIds.every(orderId => {
        if (!isSafeId(orderId) || !orders.has(orderId)) return false;
        const order = orders.get(orderId);
        return order.parkId === item.parkId && order.merchantId === item.merchantId;
      })) return false;
      return isMoney(item.total, true) && isMoney(item.merchantShare, true) && isMoney(item.parkShare, true) &&
        typeof item.ratio === 'number' && Number.isFinite(item.ratio) && item.ratio >= 0 && item.ratio <= 1 &&
        isSafeText(item.cycle) && SETTLEMENT_STATUSES.includes(item.status) &&
        (item.paymentReference === null || isSafeText(item.paymentReference)) &&
        (item.paymentRecordedAt === null || isSafeTime(item.paymentRecordedAt)) &&
        (item.failReason === null || isSafeString(item.failReason, MAX_NOTES_LENGTH, false));
    })) return false;
    if (!value.invoiceTitles.every(item => hasExactKeys(item, ['id', 'parkId', 'userId', 'name', 'taxId', 'address', 'phone', 'bank', 'bankAccount', 'isDefault', 'deletedAt']) && hasId(item) && isSafeId(item.parkId) && parks.has(item.parkId) && isSafeId(item.userId) && users.has(item.parkId + '|' + item.userId) && isSafeText(item.name) && isSafeString(item.taxId, MAX_TEXT_LENGTH, false) && isSafeString(item.address, MAX_TEXT_LENGTH, false) && isSafeString(item.phone, MAX_TEXT_LENGTH, false) && isSafeString(item.bank, MAX_TEXT_LENGTH, false) && isSafeString(item.bankAccount, MAX_TEXT_LENGTH, false) && typeof item.isDefault === 'boolean' && (item.deletedAt === null || isSafeTime(item.deletedAt)))) return false;
    if (!value.invoiceRecords.every(item => hasExactKeys(item, ['id', 'parkId', 'userId', 'transactionId', 'titleId', 'titleSnapshot', 'amount', 'status', 'createdAt', 'requestId']) && hasId(item) && isSafeId(item.parkId) && parks.has(item.parkId) && isSafeId(item.userId) && users.has(item.parkId + '|' + item.userId) && isMoney(item.amount, false) && isSafeTime(item.createdAt) && isSafeId(item.requestId))) return false;
    if (!value.batches.every(batch => accounts.has(batch.parkId + '|' + batch.userId))) return false;
    return true;
  }
  function normalizeEntities(target) {
    const owner = item => { item.parkId = item.parkId || 'park-001'; item.userId = item.userId || 'U001'; return item; };
    (target.batches || []).forEach(owner);
    (target.transactions || []).forEach(owner);
    (target.orders || []).forEach(owner);
    (target.refundRequests || []).forEach(owner);
    (target.orders || []).forEach(item => { item.merchantId = item.merchantId || 'M001'; });
    (target.batches || []).forEach(item => { if (!item.createdAt) item.createdAt = '2026-07-16 10:00'; });
    (target.orders || []).forEach(item => { if (item.status === 'pending_confirm') { item.compatStatus = item.status; item.status = 'payment_failed'; } });
    (target.refundRequests || []).forEach(item => { if (item.status === 'park_approved') { item.compatStatus = item.status; item.status = 'manual_processing'; } });
    return target;
  }

  normalizeEntities(defaults);
  let state = deepClone(defaults);

  function save() {
    if (!isValidState(state)) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.error('parkStateV2 save failed:', error);
      return false;
    }
  }

  function replaceState(nextState) {
    Object.keys(state).forEach(key => delete state[key]);
    Object.assign(state, deepClone(nextState));
  }

  function migrateState(parsed) {
    if (!isPlainObject(parsed)) return parsed;
    const migrated = normalizeEntities(deepClone(parsed));
    migrated.invoiceTitles = Array.isArray(migrated.invoiceTitles) ? migrated.invoiceTitles : [];
    migrated.invoiceRecords = Array.isArray(migrated.invoiceRecords) ? migrated.invoiceRecords : [];
    migrated.parks = Array.isArray(migrated.parks) ? migrated.parks : deepClone(defaults.parks);
    migrated.users = Array.isArray(migrated.users) ? migrated.users : [deepClone(migrated.user || defaults.user)];
    migrated.accounts = Array.isArray(migrated.accounts) ? migrated.accounts : [Object.assign({ id: 'A001', parkId: 'park-001', userId: 'U001', consumed: 0 }, migrated.wallet || defaults.wallet)];
    migrated.merchants = Array.isArray(migrated.merchants) ? migrated.merchants : deepClone(defaults.merchants);
    migrated.batches = Array.isArray(migrated.batches) ? migrated.batches : [];
    migrated.refundRequests = Array.isArray(migrated.refundRequests) ? migrated.refundRequests : [];
    migrated.orders = Array.isArray(migrated.orders) ? migrated.orders : [];
    migrated.transactions = Array.isArray(migrated.transactions) ? migrated.transactions : [];
    migrated.pendingSettlements = Array.isArray(migrated.pendingSettlements) ? migrated.pendingSettlements : [];
    migrated.reconciliationRows = Array.isArray(migrated.reconciliationRows) ? migrated.reconciliationRows : [];
    migrated.users.forEach(user => { user.parkId = user.parkId || 'park-001'; });
    migrated.accounts.forEach(account => { account.parkId = account.parkId || 'park-001'; account.userId = account.userId || 'U001'; });
    migrated.batches.forEach(batch => { batch.parkId = batch.parkId || 'park-001'; batch.userId = batch.userId || 'U001'; });
    migrated.orders.forEach(order => { order.parkId = order.parkId || 'park-001'; order.userId = order.userId || 'U001'; });
    migrated.transactions.forEach(transaction => { transaction.parkId = transaction.parkId || 'park-001'; transaction.userId = transaction.userId || 'U001'; });
    migrated.refundRequests.forEach(request => { request.parkId = request.parkId || 'park-001'; request.userId = request.userId || 'U001'; });
    const defaultPrefixes = { M001: 'YQST', M002: 'HZKF', M003: 'YQBLD' };
    migrated.merchantConfig = migrated.merchantConfig || deepClone(defaults.merchantConfig);
    Object.keys(defaultPrefixes).forEach(id => { if (migrated.merchantConfig[id] && !migrated.merchantConfig[id].prefix) migrated.merchantConfig[id].prefix = defaultPrefixes[id]; });
    const used = new Set(migrated.orders.map(order => order.id));
    const ids = new Map();
    migrated.orders.forEach(order => {
      if (!isSafeId(order.id) || /^[A-Z0-9]{2,8}-\d{16}$/.test(order.id)) return;
      const prefix = migrated.merchantConfig[order.merchantId] && migrated.merchantConfig[order.merchantId].prefix || 'SHOP';
      const stamp = String(order.time || '').replace(/[^0-9]/g, '').slice(0, 12);
      if (stamp.length !== 12) return;
      let id; let sequence = 1;
      do { id = prefix + '-' + stamp + String(sequence++).padStart(4, '0'); } while (used.has(id));
      used.add(id); ids.set(order.id, id); order.id = id;
    });
    migrated.transactions.forEach(item => { if (ids.has(item.orderId)) item.orderId = ids.get(item.orderId); });
    migrated.pendingSettlements.forEach(item => {
      if (Array.isArray(item.orderIds)) item.orderIds = item.orderIds.map(id => ids.get(id) || id);
      if (item.parkId) return;
      const linkedOrders = Array.isArray(item.orderIds) ? item.orderIds.map(id => migrated.orders.find(order => order.id === id)).filter(Boolean) : [];
      const linkedParks = new Set(linkedOrders.filter(order => order.merchantId === item.merchantId).map(order => order.parkId));
      if (linkedParks.size === 1 && linkedOrders.length === item.orderIds.length) {
        item.parkId = linkedParks.values().next().value;
        return;
      }
      const merchantParks = new Set(migrated.merchants.filter(merchant => merchant.id === item.merchantId).map(merchant => merchant.parkId));
      if (linkedOrders.length === 0 && merchantParks.size === 1) item.parkId = merchantParks.values().next().value;
    });
    return migrated;
  }
  function load() {
    let loaded = false;
    try {
      if (localStorage.getItem(VERSION_KEY) === DATA_VERSION) {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = migrateState(JSON.parse(raw));
          if (isValidState(parsed)) {
            replaceState(parsed);
            loaded = true;
          }
        }
      }
    } catch (error) {
      console.error('parkStateV2 load failed:', error);
    }
    if (!loaded) {
      replaceState(defaults);
      save();
      try { localStorage.setItem(VERSION_KEY, DATA_VERSION); } catch (error) { /* ignore */ }
    }
  }

  function result(ok, code, data, idempotent) {
    return { ok, code, data: data || null, idempotent: Boolean(idempotent) };
  }

  function successful(code, data, idempotent) {
    return result(true, code, data, idempotent);
  }

  function transactional(action) {
    return function () {
      const snapshot = deepClone(state);
      const response = action.apply(null, arguments);
      if (!response.ok || response.idempotent) return response;
      if (!isValidState(state) || !save()) {
        replaceState(snapshot);
        return result(false, 'PERSIST_FAILED');
      }
      response.persisted = true;
      return response;
    };
  }

  function nextId(prefix, collection) {
    const used = new Set(collection.map(item => item.id));
    let counter = 1;
    let candidate;
    do {
      candidate = prefix + String(counter++).padStart(4, '0');
    } while (used.has(candidate));
    return candidate;
  }

  function accountFor(parkId, userId) {
    return state.accounts.find(item => item.parkId === parkId && item.userId === userId) || null;
  }

  function ownerFrom(input, fallbackParkId = 'park-001', fallbackUserId = 'U001') {
    const entity = input && typeof input === 'object' ? input : {};
    const parkId = entity.parkId || fallbackParkId;
    const userId = entity.userId || fallbackUserId;
    return { parkId, userId, account: accountFor(parkId, userId) };
  }

  function refreshLegacyWallet(owner) {
    if (owner.parkId !== 'park-001' || owner.userId !== 'U001' || !owner.account) return;
    state.wallet.total = owner.account.total;
    state.wallet.available = owner.account.available;
    state.wallet.frozen = owner.account.frozen;
  }

  function allocateBatches(amountCents, owner) {
    let needed = amountCents;
    const allocations = [];
    state.batches.filter(batch => batch.parkId === owner.parkId && batch.userId === owner.userId).forEach(batch => {
      if (needed <= 0) return;
      const allocated = Math.min(toCents(batch.remaining), needed);
      if (allocated > 0) allocations.push({ batchId: batch.id, amount: fromCents(allocated) });
      needed -= allocated;
    });
    return needed === 0 ? allocations : null;
  }

  function changeBatchBalances(allocations, direction) {
    allocations.forEach(allocation => {
      const batch = state.batches.find(item => item.id === allocation.batchId);
      batch.remaining = fromCents(toCents(batch.remaining) + direction * toCents(allocation.amount));
    });
  }

  function recharge(amount, requestId, ownerInput) {
    const owner = ownerFrom(ownerInput);
    if (!owner.account) return result(false, 'ACCOUNT_NOT_FOUND');
    if (!isMoney(amount, false)) return result(false, 'INVALID_AMOUNT');
    if (typeof requestId !== 'string' || !requestId.trim()) return result(false, 'INVALID_REQUEST_ID');
    const normalizedRequestId = requestId.trim();
    const existing = state.transactions.find(item => item.type === 'recharge' && item.requestId === normalizedRequestId && item.parkId === owner.parkId && item.userId === owner.userId);
    if (existing) return successful('ALREADY_RECHARGED', existing, true);
    const amountCents = toCents(amount);
    owner.account.total = fromCents(toCents(owner.account.total) + amountCents);
    owner.account.available = fromCents(toCents(owner.account.available) + amountCents);
    const batch = { id: nextId('BA', state.batches), parkId: owner.parkId, userId: owner.userId, amount, remaining: amount, createdAt: now(), status: 'active', requestId: normalizedRequestId };
    const transaction = { id: nextId('TR', state.transactions), parkId: owner.parkId, userId: owner.userId, type: 'recharge', title: '余额充值', amount, time: now(), status: 'success', channel: '微信支付', requestId: normalizedRequestId, batchId: batch.id };
    state.batches.push(batch);
    state.transactions.push(transaction);
    refreshLegacyWallet(owner);
    return successful('RECHARGED', transaction);
  }

  function orderPrefix(merchantId, merchant) {
    const config = state.merchantConfig[merchantId];
    if (config && config.prefix) return config.prefix;
    return String(merchant || '').replace(/[^\u4e00-\u9fa5A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'SHOP';
  }

  function nextOrderId(merchantId, merchant, time) {
    const prefix = orderPrefix(merchantId, merchant);
    const stamp = String(time).replace(/[^0-9]/g, '').slice(0, 12);
    const base = prefix + '-' + stamp;
    let sequence = 1;
    let candidate;
    do {
      candidate = base + String(sequence++).padStart(4, '0');
    } while (state.orders.some(item => item.id === candidate));
    return candidate;
  }

  function createPendingOrder(merchant, merchantId, amount, remark, ownerInput) {
    const merchantEntity = state.merchants.find(item => item.id === merchantId && (!ownerInput || !ownerInput.parkId || item.parkId === ownerInput.parkId));
    const owner = ownerFrom(ownerInput, merchantEntity ? merchantEntity.parkId : 'park-001', ownerInput && ownerInput.userId || 'U001');
    if (!owner.account) return result(false, 'ACCOUNT_NOT_FOUND');
    if (!merchantEntity || merchantEntity.parkId !== owner.parkId) return result(false, 'MERCHANT_NOT_FOUND');
    if (typeof merchant !== 'string' || !isSafeText(merchant)) return result(false, 'INVALID_MERCHANT');
    if (typeof merchantId !== 'string' || !isSafeId(merchantId)) return result(false, 'INVALID_MERCHANT_ID');
    if (!isMoney(amount, false)) return result(false, 'INVALID_AMOUNT');
    if (remark !== undefined && (typeof remark !== 'string' || !isSafeString(remark, MAX_NOTES_LENGTH, false))) return result(false, 'INVALID_REMARK');
    const config = state.merchantConfig[merchantId] || { refundWindowHours: 24 };
    const orderTime = now();
    const order = {
      id: nextOrderId(merchantId, merchant, orderTime),
      parkId: owner.parkId,
      userId: owner.userId,
      merchant,
      merchantId,
      amount,
      time: orderTime,
      status: 'payment_failed',
      compatStatus: 'pending_confirm',
      refundDeadline: refundDeadlineAt(config.refundWindowHours)
    };
    if (remark !== undefined) order.remark = remark;
    state.orders.push(order);
    return successful('PENDING_ORDER_CREATED', order);
  }

  function consume(orderId) {
    if (typeof orderId !== 'string' || !orderId) return result(false, 'INVALID_ORDER_ID');
    const order = state.orders.find(item => item.id === orderId);
    if (!order) return result(false, 'ORDER_NOT_FOUND');
    const existing = state.transactions.find(item => item.type === 'consume' && item.orderId === orderId);
    if (order.status === 'paid' && existing) return successful('ALREADY_CONSUMED', existing, true);
    if (!(order.status === 'payment_failed' && order.compatStatus === 'pending_confirm' && !existing)) return result(false, 'ORDER_NOT_CONSUMABLE');
    if (!isMoney(order.amount, false)) return result(false, 'INVALID_ORDER_AMOUNT');
    const owner = ownerFrom(order);
    const amountCents = toCents(order.amount);
    if (!owner.account || toCents(owner.account.available) < amountCents) return result(false, 'INSUFFICIENT_BALANCE');
    const allocations = allocateBatches(amountCents, owner);
    if (!allocations) return result(false, 'INCONSISTENT_BATCH_BALANCE');

    changeBatchBalances(allocations, -1);
    owner.account.total = fromCents(toCents(owner.account.total) - amountCents);
    owner.account.available = fromCents(toCents(owner.account.available) - amountCents);
    order.status = 'paid';
    delete order.compatStatus;
    order.batchAllocations = allocations;
    const transaction = { id: nextId('TC', state.transactions), parkId: owner.parkId, userId: owner.userId, merchantId: order.merchantId, type: 'consume', title: order.merchant + '消费', amount: -order.amount, merchant: order.merchant, orderId, time: now(), status: 'success' };
    state.transactions.push(transaction);
    refreshLegacyWallet(owner);
    return successful('CONSUMED', transaction);
  }

  function collectPayment(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return result(false, 'INVALID_PAYMENT');
    const owner = ownerFrom(input);
    const merchant = state.merchants.find(item => item.id === input.merchantId && item.parkId === input.parkId);
    if (!owner.account) return result(false, 'ACCOUNT_NOT_FOUND');
    if (!merchant) return result(false, 'MERCHANT_NOT_FOUND');
    if (!isMoney(input.amount, false)) return result(false, 'INVALID_AMOUNT');
    if (!isSafeId(input.requestId)) return result(false, 'INVALID_REQUEST_ID');
    if (input.remark !== undefined && !isSafeString(input.remark, MAX_NOTES_LENGTH, false)) return result(false, 'INVALID_REMARK');
    const existing = state.orders.find(item => item.requestId === input.requestId && item.parkId === input.parkId);
    if (existing) return successful('ALREADY_COLLECTED', { order: existing, transaction: state.transactions.find(item => item.orderId === existing.id) || null }, true);
    const cents = toCents(input.amount);
    if (toCents(owner.account.available) < cents) return result(false, 'INSUFFICIENT_BALANCE');
    const allocations = allocateBatches(cents, owner);
    if (!allocations) return result(false, 'INCONSISTENT_BATCH_BALANCE');
    const config = state.merchantConfig[merchant.id] || { ratio: 1, refundWindowHours: 24 };
    const time = now();
    const user = state.users.find(item => item.id === input.userId && item.parkId === input.parkId);
    const order = {
      id: nextOrderId(merchant.id, merchant.name, time), parkId: input.parkId, userId: input.userId,
      merchant: merchant.name, merchantId: merchant.id, amount: input.amount, time, status: 'paid',
      refundDeadline: refundDeadlineAt(config.refundWindowHours), batchAllocations: allocations,
      requestId: input.requestId, userSnapshot: deepClone(user), merchantSnapshot: deepClone(merchant),
      settlementAmount: fromCents(Math.round(cents * config.ratio))
    };
    if (input.remark !== undefined) order.remark = input.remark;
    changeBatchBalances(allocations, -1);
    owner.account.available = fromCents(toCents(owner.account.available) - cents);
    owner.account.total = fromCents(toCents(owner.account.total) - cents);
    owner.account.consumed = fromCents(toCents(owner.account.consumed) + cents);
    const transaction = { id: nextId('TC', state.transactions), parkId: input.parkId, userId: input.userId, merchantId: merchant.id, type: 'consume', title: merchant.name + '消费', amount: -input.amount, merchant: merchant.name, orderId: order.id, requestId: input.requestId, time, status: 'success' };
    state.orders.push(order);
    state.transactions.push(transaction);
    refreshLegacyWallet(owner);
    return successful('PAYMENT_COLLECTED', { order, transaction });
  }

  function recordPaymentFailure(input) {
    if (!isPlainObject(input) || !isSafeId(input.requestId) || !isMoney(input.amount, false)) return result(false, 'INVALID_PAYMENT');
    const existing = state.orders.find(item => item.requestId === input.requestId && item.parkId === input.parkId);
    if (existing) return successful('PAYMENT_FAILURE_ALREADY_RECORDED', existing, true);
    const merchant = state.merchants.find(item => item.id === input.merchantId && item.parkId === input.parkId);
    const user = state.users.find(item => item.id === input.userId && item.parkId === input.parkId);
    if (!merchant || !user) return result(false, 'PAYMENT_PARTY_NOT_FOUND');
    const time = now();
    const order = { id: nextOrderId(merchant.id, merchant.name, time), parkId: input.parkId, userId: input.userId, merchant: merchant.name, merchantId: merchant.id, amount: input.amount, time, status: 'payment_failed', refundDeadline: refundDeadlineAt(0), requestId: input.requestId, userSnapshot: deepClone(user), merchantSnapshot: deepClone(merchant), settlementAmount: 0 };
    if (input.remark !== undefined) order.remark = input.remark;
    state.orders.push(order);
    return successful('PAYMENT_FAILURE_RECORDED', order);
  }

  function refundConsume(orderId) {
    if (typeof orderId !== 'string' || !orderId) return result(false, 'INVALID_ORDER_ID');
    const order = state.orders.find(item => item.id === orderId);
    if (!order) return result(false, 'ORDER_NOT_FOUND');
    const existing = state.transactions.find(item => item.type === 'consume_refund' && item.orderId === orderId);
    if (order.status === 'refunded' && existing) return successful('ALREADY_REFUNDED', existing, true);
    if (order.status !== 'paid') return result(false, 'ORDER_NOT_REFUNDABLE');
    const deadlineTime = typeof order.refundDeadline === 'string' ? new Date(order.refundDeadline.replace(' ', 'T')).getTime() : NaN;
    if (!Number.isFinite(deadlineTime)) return result(false, 'REFUND_DEADLINE_INVALID');
    if (deadlineTime < new Date().getTime()) return result(false, 'refund_expired');
    const owner = ownerFrom(order);
    if (!owner.account) return result(false, 'ACCOUNT_NOT_FOUND');
    if (!isMoney(order.amount, false) || !validAllocations(order.batchAllocations, new Set(state.batches.map(item => item.id)), toCents(order.amount))) return result(false, 'INVALID_BATCH_ALLOCATIONS');
    const canRestore = order.batchAllocations.every(allocation => {
      const batch = state.batches.find(item => item.id === allocation.batchId);
      return toCents(batch.remaining) + toCents(allocation.amount) <= toCents(batch.amount);
    });
    if (!canRestore) return result(false, 'INVALID_BATCH_BALANCE');

    changeBatchBalances(order.batchAllocations, 1);
    const amountCents = toCents(order.amount);
    owner.account.total = fromCents(toCents(owner.account.total) + amountCents);
    owner.account.available = fromCents(toCents(owner.account.available) + amountCents);
    owner.account.consumed = fromCents(Math.max(0, toCents(owner.account.consumed) - amountCents));
    order.status = 'refunded';
    const transaction = { id: nextId('TF', state.transactions), parkId: owner.parkId, userId: owner.userId, merchantId: order.merchantId, type: 'consume_refund', title: '消费退款', amount: order.amount, merchant: order.merchant, orderId, time: now(), status: 'success' };
    state.transactions.push(transaction);
    refreshLegacyWallet(owner);
    return successful('CONSUME_REFUNDED', transaction);
  }

  function applyBalanceRefund(notes, ownerInput) {
    if (typeof notes !== 'string' || !notes.trim()) return result(false, 'INVALID_NOTES');
    const normalizedNotes = notes.trim();
    const owner = ownerFrom(ownerInput);
    if (!owner.account) return result(false, 'ACCOUNT_NOT_FOUND');
    const existing = state.refundRequests.find(item => item.notes === normalizedNotes && item.parkId === owner.parkId && item.userId === owner.userId);
    if (existing) return successful('ALREADY_APPLIED', existing, true);
    if (state.refundRequests.some(item => item.parkId === owner.parkId && item.userId === owner.userId && ['pending_review', 'reviewing', 'arrived', 'manual_processing'].includes(item.status))) return result(false, 'ACTIVE_REFUND_EXISTS');
    const amountCents = toCents(owner.account.available);
    if (amountCents <= 0 || toCents(owner.account.frozen) !== 0) return result(false, 'NO_REFUNDABLE_BALANCE');
    const allocations = allocateBatches(amountCents, owner);
    if (!allocations) return result(false, 'INCONSISTENT_BATCH_BALANCE');
    owner.account.available = 0;
    owner.account.frozen = fromCents(amountCents);
    const request = { id: nextId('RR', state.refundRequests), parkId: owner.parkId, userId: owner.userId, amount: fromCents(amountCents), frozenAmount: fromCents(amountCents), batchAllocations: allocations, createdAt: now(), status: 'pending_review', notes: normalizedNotes };
    state.refundRequests.push(request);
    refreshLegacyWallet(owner);
    return successful('BALANCE_REFUND_APPLIED', request);
  }

  function startRefundReview(id, context) {
    const request = state.refundRequests.find(item => item.id === id);
    if (!request) return result(false, 'REFUND_NOT_FOUND');
    if (!reviewOwnerContext(request, context)) return result(false, 'REFUND_OWNER_MISMATCH');
    if (request.status === 'reviewing') return successful('ALREADY_REVIEWING', request, true);
    if (request.status !== 'pending_review') return result(false, 'INVALID_REFUND_TRANSITION');
    request.status = 'reviewing';
    return successful('REFUND_REVIEW_STARTED', request);
  }

  function markRefundArrived(id, context) {
    const request = state.refundRequests.find(item => item.id === id);
    if (!request) return result(false, 'REFUND_NOT_FOUND');
    if (!reviewOwnerContext(request, context)) return result(false, 'REFUND_OWNER_MISMATCH');
    if (request.status === 'arrived') return successful('ALREADY_ARRIVED', request, true);
    if (request.status === 'manual_processing' && request.compatStatus !== undefined) return result(false, 'INVALID_REFUND_TRANSITION');
    if (request.status !== 'reviewing' && request.status !== 'manual_processing') return result(false, 'INVALID_REFUND_TRANSITION');
    request.status = 'arrived';
    return successful('REFUND_ARRIVED', request);
  }

  function approveParkRefund(id, context) {
    const request = state.refundRequests.find(item => item.id === id);
    if (!request) return result(false, 'REFUND_NOT_FOUND');
    if (!reviewOwnerContext(request, context)) return result(false, 'REFUND_OWNER_MISMATCH');
    if (request.status === 'manual_processing' && request.compatStatus === 'park_approved' || request.status === 'completed') return successful('ALREADY_APPROVED', request, true);
    if (request.status !== 'pending_review') return result(false, 'REFUND_NOT_APPROVABLE');
    request.status = 'manual_processing';
    request.compatStatus = 'park_approved';
    return successful('PARK_REFUND_APPROVED', request);
  }

  function rejectParkRefund(id, context) {
    const request = state.refundRequests.find(item => item.id === id);
    if (!request) return result(false, 'REFUND_NOT_FOUND');
    if (!reviewOwnerContext(request, context)) return result(false, 'REFUND_OWNER_MISMATCH');
    const owner = ownerFrom(request);
    if (!owner.account) return result(false, 'ACCOUNT_NOT_FOUND');
    if (request.status === 'rejected') return successful('ALREADY_REJECTED', request, true);
    if (request.status !== 'pending_review' && request.status !== 'reviewing') return result(false, 'REFUND_NOT_REJECTABLE');
    const frozenCents = toCents(request.frozenAmount);
    if (toCents(owner.account.frozen) < frozenCents) return result(false, 'INVALID_FROZEN_BALANCE');
    owner.account.frozen = fromCents(toCents(owner.account.frozen) - frozenCents);
    owner.account.available = fromCents(toCents(owner.account.available) + frozenCents);
    request.status = 'rejected';
    refreshLegacyWallet(owner);
    return successful('PARK_REFUND_REJECTED', request);
  }

  function completeBalanceRefund(id, context) {
    const request = state.refundRequests.find(item => item.id === id);
    if (!request) return result(false, 'REFUND_NOT_FOUND');
    if (!reviewOwnerContext(request, context)) return result(false, 'REFUND_OWNER_MISMATCH');
    const existing = state.transactions.find(item => item.type === 'balance_refund' && item.refundId === id);
    if (request.status === 'completed' && existing) return successful('ALREADY_COMPLETED', existing, true);
    if (request.status !== 'arrived' && !(request.status === 'manual_processing' && request.compatStatus === 'park_approved')) return result(false, 'REFUND_NOT_COMPLETABLE');
    const owner = ownerFrom(request);
    if (!owner.account) return result(false, 'ACCOUNT_NOT_FOUND');
    const frozenCents = toCents(request.frozenAmount);
    if (frozenCents <= 0 || toCents(owner.account.frozen) < frozenCents || toCents(owner.account.total) < frozenCents) return result(false, 'INVALID_FROZEN_BALANCE');
    const allocationsValid = validAllocations(request.batchAllocations, new Set(state.batches.map(item => item.id)), frozenCents);
    const balancesValid = allocationsValid && request.batchAllocations.every(allocation => {
      const batch = state.batches.find(item => item.id === allocation.batchId);
      return toCents(batch.remaining) >= toCents(allocation.amount);
    });
    if (!balancesValid) return result(false, 'INVALID_BATCH_ALLOCATIONS');

    changeBatchBalances(request.batchAllocations, -1);
    owner.account.total = fromCents(toCents(owner.account.total) - frozenCents);
    owner.account.frozen = fromCents(toCents(owner.account.frozen) - frozenCents);
    request.status = 'completed';
    const transaction = { id: nextId('TB', state.transactions), parkId: owner.parkId, userId: owner.userId, type: 'balance_refund', title: '余额退款', amount: -request.frozenAmount, refundId: id, time: now(), status: 'success' };
    state.transactions.push(transaction);
    refreshLegacyWallet(owner);
    return successful('BALANCE_REFUND_COMPLETED', transaction);
  }

  function markRefundManualProcessing(id, context) {
    const request = state.refundRequests.find(item => item.id === id);
    if (!request) return result(false, 'REFUND_NOT_FOUND');
    if (!reviewOwnerContext(request, context)) return result(false, 'REFUND_OWNER_MISMATCH');
    if (request.status === 'manual_processing' && request.compatStatus === undefined) return successful('ALREADY_MANUAL', request, true);
    if (request.status === 'manual_processing' && request.compatStatus === 'park_approved') {
      delete request.compatStatus;
      return successful('REFUND_MARKED_MANUAL', request);
    }
    if (request.status !== 'reviewing' && request.status !== 'arrived') return result(false, 'REFUND_NOT_MANUALABLE');
    request.status = 'manual_processing';
    return successful('REFUND_MARKED_MANUAL', request);
  }

  function resumeRefundReview(id, context) {
    const request = state.refundRequests.find(item => item.id === id);
    if (!request) return result(false, 'REFUND_NOT_FOUND');
    if (!reviewOwnerContext(request, context)) return result(false, 'REFUND_OWNER_MISMATCH');
    if (request.status === 'reviewing') return successful('ALREADY_REVIEWING', request, true);
    if (request.status !== 'manual_processing' || request.compatStatus !== undefined) return result(false, 'INVALID_REFUND_TRANSITION');
    request.status = 'reviewing';
    return successful('REFUND_REVIEW_RESUMED', request);
  }

  function syncSettlements() {
    const allocated = new Set();
    state.pendingSettlements.forEach(item => item.orderIds.forEach(id => allocated.add(item.parkId + '|' + id)));
    const candidates = state.orders.filter(order => order.status === 'paid' && !allocated.has(order.parkId + '|' + order.id));
    const missingConfig = candidates.find(order => !state.merchantConfig[order.merchantId]);
    if (missingConfig) return result(false, 'MERCHANT_CONFIG_NOT_FOUND', missingConfig);
    if (candidates.length === 0) return successful('SETTLEMENTS_ALREADY_SYNCED', state.pendingSettlements, true);

    const groups = new Map();
    candidates.forEach(order => {
      const config = state.merchantConfig[order.merchantId];
      const key = order.parkId + '|' + order.merchantId + '|' + config.ratio;
      if (!groups.has(key)) groups.set(key, { parkId: order.parkId, merchantId: order.merchantId, config, orders: [] });
      groups.get(key).orders.push(order);
    });
    groups.forEach(group => {
      let settlement = state.pendingSettlements.find(item => item.parkId === group.parkId && item.merchantId === group.merchantId && item.ratio === group.config.ratio && item.status === 'pending');
      if (!settlement) {
        settlement = { id: nextId('S', state.pendingSettlements), parkId: group.parkId, merchantId: group.merchantId, orderIds: [], total: 0, merchantShare: 0, parkShare: 0, ratio: group.config.ratio, cycle: group.config.cycle, status: 'pending', paymentReference: null, paymentRecordedAt: null, failReason: null };
        state.pendingSettlements.push(settlement);
      }
      const addedCents = group.orders.reduce((sum, order) => sum + toCents(order.amount), 0);
      const totalCents = toCents(settlement.total) + addedCents;
      const merchantCents = Math.round(totalCents * settlement.ratio);
      settlement.orderIds.push.apply(settlement.orderIds, group.orders.map(order => order.id));
      settlement.total = fromCents(totalCents);
      settlement.merchantShare = fromCents(merchantCents);
      settlement.parkShare = fromCents(totalCents - merchantCents);
    });
    return successful('SETTLEMENTS_SYNCED', state.pendingSettlements);
  }

  function recordSettlementPaymentResult(settlementId, outcome, paymentReference, failReason) {
    const settlement = state.pendingSettlements.find(item => item.id === settlementId);
    if (!settlement) return result(false, 'SETTLEMENT_NOT_FOUND');
    if (outcome !== 'success' && outcome !== 'failed') return result(false, 'INVALID_SETTLEMENT_OUTCOME');
    const normalizedReference = typeof paymentReference === 'string' && paymentReference.trim() ? paymentReference.trim() : null;
    const normalizedReason = typeof failReason === 'string' && failReason.trim() ? failReason.trim() : null;
    if (outcome === 'success' && (!normalizedReference || !isSafeText(normalizedReference))) return result(false, 'PAYMENT_REFERENCE_REQUIRED');
    if (outcome === 'failed' && (!normalizedReason || !isSafeString(normalizedReason, MAX_NOTES_LENGTH, false))) return result(false, 'FAIL_REASON_REQUIRED');
    const expectedReference = outcome === 'success' ? normalizedReference : null;
    const expectedReason = outcome === 'failed' ? normalizedReason : null;
    if (settlement.status === 'success' || settlement.status === 'failed') {
      if (settlement.status === outcome && settlement.paymentReference === expectedReference && settlement.failReason === expectedReason) return successful('SETTLEMENT_RESULT_ALREADY_RECORDED', settlement, true);
      return result(false, 'SETTLEMENT_RESULT_CONFLICT');
    }
    if (settlement.status !== 'pending' && settlement.status !== 'processing') return result(false, 'SETTLEMENT_RESULT_CONFLICT');
    settlement.status = outcome;
    settlement.paymentReference = expectedReference;
    settlement.failReason = expectedReason;
    settlement.paymentRecordedAt = now();
    return successful('SETTLEMENT_RESULT_RECORDED', settlement);
  }

  function markReconciliationChecked(rowId) {
    const row = state.reconciliationRows.find(item => item.id === rowId);
    if (!row) return result(false, 'RECONCILIATION_NOT_FOUND');
    if (row.checked) return successful('RECONCILIATION_ALREADY_CHECKED', row, true);
    row.checked = true;
    row.checkedAt = now();
    return successful('RECONCILIATION_CHECKED', row);
  }

  function invoiceOwner(input) {
    return ownerFrom(input, 'park-001', 'U001');
  }

  function matchesOptionalOwner(entity, context) {
    if (context === undefined) return true;
    if (!context || typeof context !== 'object' || Array.isArray(context)) return false;
    return (context.parkId === undefined || context.parkId === entity.parkId) &&
      (context.userId === undefined || context.userId === entity.userId);
  }

  function reviewOwnerContext(request, context) {
    if (context === undefined) return true;
    if (!context || typeof context !== 'object' || Array.isArray(context)) return false;
    return (context.parkId === undefined || context.parkId === request.parkId) &&
      (context.userId === undefined || context.userId === request.userId);
  }

  function validateInvoiceTitle(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
    return ['name', 'taxId', 'address', 'phone', 'bank', 'bankAccount'].every(key => typeof input[key] === 'string' && input[key].length <= MAX_TEXT_LENGTH && input[key].trim() && !/[<>]/.test(input[key]));
  }

  function createInvoiceTitle(input) {
    if (!validateInvoiceTitle(input)) return result(false, 'INVALID_INVOICE_TITLE');
    const owner = invoiceOwner(input);
    if (!owner.account) return result(false, 'ACCOUNT_NOT_FOUND');
    const title = { id: nextId('IT', state.invoiceTitles), parkId: owner.parkId, userId: owner.userId, name: input.name.trim(), taxId: input.taxId.trim(), address: input.address.trim(), phone: input.phone.trim(), bank: input.bank.trim(), bankAccount: input.bankAccount.trim(), isDefault: Boolean(input.isDefault), deletedAt: null };
    if (title.isDefault || !state.invoiceTitles.some(item => item.parkId === owner.parkId && item.userId === owner.userId && !item.deletedAt)) state.invoiceTitles.forEach(item => { if (item.parkId === owner.parkId && item.userId === owner.userId) item.isDefault = false; });
    if (!state.invoiceTitles.some(item => item.parkId === owner.parkId && item.userId === owner.userId && !item.deletedAt)) title.isDefault = true;
    state.invoiceTitles.push(title);
    return successful('INVOICE_TITLE_CREATED', title);
  }

  function updateInvoiceTitle(id, changes, context) {
    const title = state.invoiceTitles.find(item => item.id === id && !item.deletedAt);
    if (!title) return result(false, 'INVOICE_TITLE_NOT_FOUND');
    if (!matchesOptionalOwner(title, context)) return result(false, 'INVOICE_TITLE_OWNER_MISMATCH');
    const merged = Object.assign({}, title, changes);
    if (!validateInvoiceTitle(merged)) return result(false, 'INVALID_INVOICE_TITLE');
    ['name', 'taxId', 'address', 'phone', 'bank', 'bankAccount'].forEach(key => { title[key] = merged[key].trim(); });
    if (changes.isDefault) setDefaultInvoiceTitle(id, context);
    return successful('INVOICE_TITLE_UPDATED', title);
  }

  function deleteInvoiceTitle(id, context) {
    const title = state.invoiceTitles.find(item => item.id === id);
    if (!title) return result(false, 'INVOICE_TITLE_NOT_FOUND');
    if (!matchesOptionalOwner(title, context)) return result(false, 'INVOICE_TITLE_OWNER_MISMATCH');
    if (title.deletedAt) return successful('INVOICE_TITLE_ALREADY_DELETED', title, true);
    title.deletedAt = now();
    title.isDefault = false;
    const replacement = state.invoiceTitles.find(item => item.parkId === title.parkId && item.userId === title.userId && !item.deletedAt);
    if (replacement) replacement.isDefault = true;
    return successful('INVOICE_TITLE_DELETED', title);
  }

  function setDefaultInvoiceTitle(id, context) {
    const title = state.invoiceTitles.find(item => item.id === id && !item.deletedAt);
    if (!title) return result(false, 'INVOICE_TITLE_NOT_FOUND');
    if (!matchesOptionalOwner(title, context)) return result(false, 'INVOICE_TITLE_OWNER_MISMATCH');
    state.invoiceTitles.forEach(item => { if (item.parkId === title.parkId && item.userId === title.userId) item.isDefault = item.id === id; });
    return successful('DEFAULT_INVOICE_TITLE_SET', title);
  }

  function applyInvoice(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || !isSafeId(input.transactionId) || !isSafeId(input.titleId) || !isSafeId(input.requestId)) return result(false, 'INVALID_INVOICE_APPLICATION');
    const existing = state.invoiceRecords.find(item => item.requestId === input.requestId);
    if (existing) return successful('INVOICE_ALREADY_APPLIED', existing, true);
    const transaction = state.transactions.find(item => item.id === input.transactionId && item.type === 'recharge');
    const title = state.invoiceTitles.find(item => item.id === input.titleId && !item.deletedAt);
    if (!transaction) return result(false, 'RECHARGE_NOT_FOUND');
    if (!title || title.parkId !== transaction.parkId || title.userId !== transaction.userId) return result(false, 'INVOICE_TITLE_NOT_FOUND');
    if (state.invoiceRecords.some(item => item.transactionId === transaction.id)) return result(false, 'INVOICE_ALREADY_EXISTS');
    const record = { id: nextId('IR', state.invoiceRecords), parkId: transaction.parkId, userId: transaction.userId, transactionId: transaction.id, titleId: title.id, titleSnapshot: deepClone(title), amount: transaction.amount, status: 'pending', createdAt: now(), requestId: input.requestId };
    state.invoiceRecords.push(record);
    return successful('INVOICE_APPLIED', record);
  }

  function getInvoiceStatus(id) {
    const record = state.invoiceRecords.find(item => item.id === id || item.transactionId === id || item.requestId === id);
    return record ? successful('INVOICE_STATUS', record) : result(false, 'INVOICE_NOT_FOUND');
  }

  function reset() {
    replaceState(defaults);
    return save();
  }

  function resetForTests() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('parkStateV2 reset failed:', error);
    }
    replaceState(defaults);
    save();
    return state;
  }

  const selectors = {
    getParkById: id => state.parks.find(item => item.id === id) || null,
    getUserById: (parkId, userId) => state.users.find(item => item.parkId === parkId && item.id === userId) || null,
    getAccount: (parkId, userId) => state.accounts.find(item => item.parkId === parkId && item.userId === userId) || null,
    getAccountsByPark: parkId => state.accounts.filter(item => item.parkId === parkId),
    getOrdersByPark: parkId => state.orders.filter(item => item.parkId === parkId),
    getRefundsByPark: parkId => state.refundRequests.filter(item => item.parkId === parkId),
    getTransactionsByPark: parkId => state.transactions.filter(item => item.parkId === parkId),
    getMerchantsByPark: parkId => state.merchants.filter(item => item.parkId === parkId),
    getAccountStatistics: (parkId, range) => {
      const month = formatDateTime(new Date()).slice(0, 7);
      const accounts = state.accounts.filter(item => item.parkId === parkId);
      const scoped = range === 'month' ? state.transactions.filter(item => item.parkId === parkId && item.time.slice(0, 7) === month) : state.transactions.filter(item => item.parkId === parkId);
      const available = fromCents(accounts.reduce((sum, item) => sum + toCents(item.available), 0));
      const frozen = fromCents(accounts.reduce((sum, item) => sum + toCents(item.frozen), 0));
      const consumed = range === 'month'
        ? fromCents(scoped.filter(item => item.type === 'consume').reduce((sum, item) => sum + Math.abs(toCents(item.amount)), 0) - scoped.filter(item => item.type === 'consume_refund').reduce((sum, item) => sum + toCents(item.amount), 0))
        : fromCents(accounts.reduce((sum, item) => sum + toCents(item.consumed), 0));
      return { accountCount: accounts.length, available, frozen, consumed, totalStored: fromCents(toCents(available) + toCents(frozen) + toCents(consumed)) };
    },
    getMerchantSettlementStatistics: (parkId, merchantId) => {
      const month = formatDateTime(new Date()).slice(0, 7);
      const orders = state.orders.filter(item => item.parkId === parkId && (!merchantId || item.merchantId === merchantId) && item.time.slice(0, 7) === month);
      const paid = orders.filter(item => item.status === 'paid' || item.status === 'refunded');
      const refunded = orders.filter(item => item.status === 'refunded');
      const income = fromCents(paid.reduce((sum, item) => sum + toCents(item.amount), 0));
      const refundAmount = fromCents(refunded.reduce((sum, item) => sum + toCents(item.amount), 0));
      const settlementAmount = fromCents(paid.reduce((sum, item) => sum + toCents(item.settlementAmount === undefined ? item.amount * ((state.merchantConfig[item.merchantId] || { ratio: 1 }).ratio) : item.settlementAmount), 0));
      return { orderCount: paid.length, income, settlementAmount, refundCount: refunded.length, refundAmount };
    }
  };

  load();

  window.parkState = {
    state,
    selectors,
    save,
    reset,
    resetForTests,
    reloadForTests: load,
    actions: {
      collectPayment: transactional(collectPayment),
      recordPaymentFailure: transactional(recordPaymentFailure),
      createPendingOrder: transactional(createPendingOrder),
      recharge: transactional(recharge),
      consume: transactional(consume),
      refundConsume: transactional(refundConsume),
      applyBalanceRefund: transactional(applyBalanceRefund),
      startRefundReview: transactional(startRefundReview),
      approveParkRefund: transactional(approveParkRefund),
      rejectParkRefund: transactional(rejectParkRefund),
      markRefundArrived: transactional(markRefundArrived),
      completeBalanceRefund: transactional(completeBalanceRefund),
      markRefundManualProcessing: transactional(markRefundManualProcessing),
      resumeRefundReview: transactional(resumeRefundReview),
      createInvoiceTitle: transactional(createInvoiceTitle),
      updateInvoiceTitle: transactional(updateInvoiceTitle),
      deleteInvoiceTitle: transactional(deleteInvoiceTitle),
      setDefaultInvoiceTitle: transactional(setDefaultInvoiceTitle),
      applyInvoice: transactional(applyInvoice),
      getInvoiceStatus,
      syncSettlements: transactional(syncSettlements),
      recordSettlementPaymentResult: transactional(recordSettlementPaymentResult),
      markReconciliationChecked: transactional(markReconciliationChecked)
    }
  };
})();

function formatMoney(n) {
  return (n ?? 0).toFixed(2);
}
