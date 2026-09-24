(function () {
  'use strict';

  const STORAGE_KEY = 'parkStateV2';
  const VERSION_KEY = 'parkStateV2Version';
  const DATA_VERSION = 'demo-2026-09-23-1';
  const COLLECTION_KEYS = [
    'parks',
    'enterprises',
    'users',
    'accounts',
    'rechargeBatches',
    'rechargeBatchItems',
    'transactions',
    'orders',
    'refundRequests',
    'merchants',
    'invoiceTitles',
    'invoiceRecords',
    'pendingSettlements',
    'reconciliationRows'
  ];
  const TOP_LEVEL_KEYS = COLLECTION_KEYS.concat(['user', 'merchantConfig']);
  const MAX_ID_LENGTH = 64;
  const MAX_TEXT_LENGTH = 120;

  function demoTime(daysAgo, hhmm) {
    const date = new Date(Date.now() - daysAgo * 86400000);
    const pad = value => String(value).padStart(2, '0');
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + hhmm;
  }

  const defaults = {
    parks: [
      { id: 'park-001', name: '海智园区' },
      { id: 'park-002', name: '海创园区' },
      { id: 'park-003', name: '空白园区' }
    ],
    enterprises: [
      {
        id: 'E001',
        parkId: 'park-001',
        name: '北京海开智慧园区科技有限公司',
        adminUserIds: ['U003'],
        employeeUserIds: ['U001', 'U004'],
        status: 'active'
      },
      {
        id: 'E002',
        parkId: 'park-002',
        name: '北京海创科技服务有限公司',
        adminUserIds: ['U002'],
        employeeUserIds: ['U002'],
        status: 'active'
      }
    ],
    users: [
      { id: 'U001', homeParkId: 'park-001', name: '张伟', phone: '13800131234', status: 'active' },
      { id: 'U003', homeParkId: 'park-001', name: '王强', phone: '13700139012', status: 'active' },
      { id: 'U004', homeParkId: 'park-001', name: '赵敏', phone: '13600136012', status: 'active' },
      { id: 'U002', homeParkId: 'park-002', name: '李娜', phone: '13900139001', status: 'active' }
    ],
    accounts: [
      {
        id: 'A001',
        userId: 'U001',
        homeParkId: 'park-001',
        status: 'active',
        personal: { available: 80, frozen: 0, consumed: 42 },
        enterpriseBalances: [
          { enterpriseId: 'E001', available: 120, frozen: 0, consumed: 88 }
        ]
      },
      {
        id: 'A003',
        userId: 'U003',
        homeParkId: 'park-001',
        status: 'active',
        personal: { available: 40, frozen: 0, consumed: 20 },
        enterpriseBalances: []
      },
      {
        id: 'A004',
        userId: 'U004',
        homeParkId: 'park-001',
        status: 'active',
        personal: { available: 30, frozen: 0, consumed: 5 },
        enterpriseBalances: [
          { enterpriseId: 'E001', available: 75, frozen: 0, consumed: 5 }
        ]
      },
      {
        id: 'A002',
        userId: 'U002',
        homeParkId: 'park-002',
        status: 'active',
        personal: { available: 90, frozen: 10, consumed: 20 },
        enterpriseBalances: [
          { enterpriseId: 'E002', available: 100, frozen: 0, consumed: 20 }
        ]
      }
    ],
    rechargeBatches: [],
    rechargeBatchItems: [],
    transactions: [],
    orders: [],
    refundRequests: [],
    merchants: [
      { id: 'M001', parkId: 'park-001', name: '园区食堂', status: 'active' },
      { id: 'M002', parkId: 'park-001', name: '海智咖啡 HUB', status: 'active' },
      { id: 'M003', parkId: 'park-001', name: '园区便利店', status: 'active' },
      { id: 'M201', parkId: 'park-002', name: '海创食堂', status: 'active' }
    ],
    invoiceTitles: [
      {
        id: 'TITLE-DMO-1',
        userId: 'U001',
        name: '北京海开智慧园区科技有限公司',
        taxId: '91110108MA01C8X2B',
        address: '北京市海淀区中关村大街 1 号',
        phone: '010-88886666',
        bank: '中国工商银行北京中关村支行',
        bankAccount: '0200048809100012345',
        isDefault: true,
        deletedAt: null
      }
    ],
    invoiceRecords: [],
    pendingSettlements: [],
    reconciliationRows: [
      {
        id: 'RC-DEMO-01',
        type: 'recharge',
        subject: '企业在线充值示例',
        rechargeParkId: 'park-001',
        consumeParkId: null,
        amount: 100,
        platformStatus: 'success',
        channelStatus: 'success',
        diff: 'consistent',
        checked: false,
        checkedAt: null
      }
    ],
    user: { id: 'U001', homeParkId: 'park-001', name: '张伟', phone: '13800131234' },
    merchantConfig: {
      M001: { name: '园区食堂', ratio: 0.85, cycle: 'T+1', refundWindowHours: 24, prefix: 'YQST' },
      M002: { name: '海智咖啡 HUB', ratio: 0.8, cycle: '周结', refundWindowHours: 24, prefix: 'HZKF' },
      M003: { name: '园区便利店', ratio: 0.82, cycle: 'T+1', refundWindowHours: 24, prefix: 'YQBLD' },
      M201: { name: '海创食堂', ratio: 0.85, cycle: 'T+1', refundWindowHours: 24, prefix: 'HCST' }
    }
  };

  // Stable IDs and relative dates make every default-role list demonstrable on any day.
  (function seedDemoLists() {
    const day = daysAgo => demoTime(daysAgo, '10:20');
    for (let i = 1; i <= 10; i++) {
      const suffix = String(i).padStart(2, '0');
      const userId = 'U' + String(100 + i);
      const enterpriseId = 'E' + String(100 + i);
      const merchantId = 'M' + String(100 + i);
      defaults.users.push({ id: userId, homeParkId: 'park-001', name: '演示员工' + suffix, phone: '1380000' + String(1000 + i), status: 'active' });
      defaults.accounts.push({ id: 'A' + String(100 + i), userId, homeParkId: 'park-001', status: 'active', personal: { available: 60, frozen: 0, consumed: 0 }, enterpriseBalances: i <= 8 ? [{ enterpriseId: 'E001', available: 80, frozen: 0, consumed: 0 }] : [] });
      if (i <= 8) defaults.enterprises[0].employeeUserIds.push(userId);
      defaults.enterprises.push({ id: enterpriseId, parkId: 'park-001', name: '园区示范企业' + suffix, adminUserIds: ['U003'], employeeUserIds: [userId], status: 'active' });
      defaults.merchants.push({ id: merchantId, parkId: 'park-001', name: '园区示范商户' + suffix, status: 'active' });
      defaults.merchantConfig[merchantId] = { name: '园区示范商户' + suffix, ratio: 0.8, cycle: 'T+1', refundWindowHours: 24, prefix: 'DM' + suffix };
    }
    for (let i = 1; i <= 12; i++) {
      const suffix = String(i).padStart(2, '0');
      const createdAt = i === 1 ? new Date().toISOString() : day((i - 1) % 6);
      const personalId = 'TX-DEMO-PR-' + suffix;
      defaults.transactions.push({ id: personalId, type: 'personal_recharge', userId: 'U001', enterpriseId: null, parkId: 'park-001', batchId: null, amount: 50, paymentChannel: 'online', requestId: 'DEMO-PR-' + suffix, createdAt });
      defaults.invoiceRecords.push({ id: 'INV-DEMO-PR-' + suffix, type: 'recharge_receipt', sourceId: personalId, userId: 'U001', enterpriseId: null, amount: 50, paymentChannel: 'online', createdAt });
      const batchId = 'RB-DEMO-' + suffix;
      const employeeId = defaults.enterprises[0].employeeUserIds[(i - 1) % defaults.enterprises[0].employeeUserIds.length];
      const method = i % 2 ? 'online' : 'offline';
      defaults.rechargeBatches.push({ id: batchId, enterpriseId: 'E001', rechargeParkId: 'park-001', method, requestId: 'DEMO-ER-' + suffix, totalAmount: 100, status: 'succeeded', paymentStatus: 'succeeded', postingStatus: 'succeeded', validationStatus: 'passed', paymentReference: method === 'online' ? 'PAY-DEMO-' + suffix : null, voucher: method === 'offline' ? 'voucher-demo-' + suffix + '.pdf' : null, createdAt, postedAt: createdAt });
      defaults.rechargeBatchItems.push({ id: 'RBI-DEMO-' + suffix, batchId, enterpriseId: 'E001', userId: employeeId, amount: 100, validationResult: ['valid'], postingStatus: 'succeeded' });
      defaults.transactions.push({ id: 'TX-DEMO-ER-' + suffix, type: 'enterprise_recharge', userId: employeeId, enterpriseId: 'E001', parkId: 'park-001', batchId, amount: 100, requestId: 'DEMO-ER-' + suffix + '-' + employeeId, createdAt });
      defaults.invoiceRecords.push({ id: 'INV-DEMO-ER-' + suffix, type: 'recharge_receipt', sourceId: batchId, userId: null, enterpriseId: 'E001', amount: 100, createdAt });
      const orderId = 'ORD-DEMO-' + suffix;
      defaults.orders.push({ id: orderId, requestId: 'DEMO-ORDER-' + suffix, userId: 'U001', merchantId: 'M002', amount: 12 + i, enterpriseDeductions: [], personalAmount: 12 + i, rechargeParkIds: ['park-001'], consumeParkId: 'park-001', paymentStatus: 'paid', invoiceStatus: 'applied', refundStatus: 'none', settlementStatus: 'settling', createdAt });
      defaults.invoiceRecords.push({ id: 'INV-DEMO-C-' + suffix, type: 'consume_invoice', sourceId: orderId, applicantUserId: 'U001', merchantId: 'M002', consumeParkId: 'park-001', titleSnapshot: { name: '北京海开智慧园区科技有限公司', taxId: '91110108MA01C8X2B' }, amount: 12 + i, status: 'pending', requestId: 'DEMO-INVOICE-' + suffix, createdAt });
      defaults.pendingSettlements.push({ id: 'SET-DEMO-' + suffix, consumeParkId: 'park-001', merchantId: 'M002', orderIds: [orderId], grossAmount: 12 + i, serviceFee: Math.round((12 + i) * 20) / 100, settlementAmount: Math.round((12 + i) * 80) / 100, status: 'pending', createdAt });
      defaults.refundRequests.push({ id: 'RF-DEMO-PR-' + suffix, type: 'personal_balance', userId: 'U001', enterpriseId: null, amount: 2, originalPaymentChannel: 'online', status: 'pending', requestId: 'DEMO-REFUND-PR-' + suffix, createdAt });
      defaults.refundRequests.push({ id: 'RF-DEMO-ER-' + suffix, type: 'enterprise_balance', userId: null, enterpriseId: 'E001', adminUserId: 'U003', items: [{ userId: employeeId, amount: 5, rechargeBatchId: batchId, refundDestination: method === 'online' ? 'original_payer' : 'enterprise_payer_account' }], amount: 5, refundDestination: method === 'online' ? 'original_payer' : 'enterprise_payer_account', status: 'pending', requestId: 'DEMO-REFUND-ER-' + suffix, createdAt });
      defaults.reconciliationRows.push({ id: 'RC-DEMO-ORDER-' + suffix, type: 'consume', subject: orderId, rechargeParkId: 'park-001', consumeParkId: 'park-001', amount: 12 + i, platformStatus: 'paid', channelStatus: 'pending', diff: 'consistent', checked: false, checkedAt: null });
    }
  })();

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function jsonSafeClone(value) {
    try {
      const serialized = JSON.stringify(value);
      return serialized === undefined ? null : JSON.parse(serialized);
    } catch (error) {
      return null;
    }
  }

  function isJsonSerializable(value) {
    try {
      return JSON.stringify(value) !== undefined;
    } catch (error) {
      return false;
    }
  }

  function isPlainObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.prototype.toString.call(value) === '[object Object]';
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

  function isValidDateText(value) {
    return typeof value === 'string' && value.length <= MAX_TEXT_LENGTH && Number.isFinite(Date.parse(value));
  }

  function toCents(value) {
    return Math.round(value * 100);
  }

  function fromCents(value) {
    return value / 100;
  }

  function isMoney(value, allowZero) {
    return typeof value === 'number' && Number.isFinite(value) && (allowZero ? value >= 0 : value > 0) && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
  }

  function hasUniqueIds(collection) {
    return collection.every(item => isPlainObject(item) && isSafeId(item.id)) && new Set(collection.map(item => item.id)).size === collection.length;
  }

  function hasOnlyTopLevelKeys(value) {
    const keys = Object.keys(value);
    return keys.length === TOP_LEVEL_KEYS.length && TOP_LEVEL_KEYS.every(key => Object.prototype.hasOwnProperty.call(value, key));
  }

  function validBalance(balance) {
    return isPlainObject(balance) && isMoney(balance.available, true) && isMoney(balance.frozen, true) && isMoney(balance.consumed, true);
  }

  function validOrderDeductions(order, enterpriseIds) {
    if (!Array.isArray(order.enterpriseDeductions) || !isMoney(order.personalAmount, true) || !isMoney(order.amount, false)) return false;
    if (!order.enterpriseDeductions.every(item => isPlainObject(item) && isSafeId(item.enterpriseId) && enterpriseIds.has(item.enterpriseId) && isMoney(item.amount, false))) return false;
    const enterpriseCents = order.enterpriseDeductions.reduce((sum, item) => sum + toCents(item.amount), 0);
    return enterpriseCents + toCents(order.personalAmount) === toCents(order.amount);
  }

  function validMerchantConfig(config, merchantIds) {
    if (!isPlainObject(config)) return false;
    return Object.keys(config).every(id => {
      const item = config[id];
      return merchantIds.has(id) && isPlainObject(item) && isSafeText(item.name) &&
        typeof item.ratio === 'number' && Number.isFinite(item.ratio) && item.ratio >= 0 && item.ratio <= 1 &&
        isSafeText(item.cycle) && Number.isInteger(item.refundWindowHours) && item.refundWindowHours >= 0 &&
        typeof item.prefix === 'string' && /^[A-Z0-9]{2,8}$/.test(item.prefix);
    });
  }

  function isValidState(value) {
    if (!isPlainObject(value) || !hasOnlyTopLevelKeys(value)) return false;
    if (!COLLECTION_KEYS.every(key => Array.isArray(value[key]))) return false;
    if (!isPlainObject(value.user) || !isPlainObject(value.merchantConfig)) return false;
    if (!COLLECTION_KEYS.every(key => hasUniqueIds(value[key]))) return false;

    const parkIds = new Set(value.parks.map(item => item.id));
    const userIds = new Set(value.users.map(item => item.id));
    const enterpriseIds = new Set(value.enterprises.map(item => item.id));
    const accountUserIds = new Set();
    const merchantIds = new Set(value.merchants.map(item => item.id));

    if (!value.parks.every(item => isSafeText(item.name))) return false;
    if (!value.users.every(item => parkIds.has(item.homeParkId) && isSafeText(item.name) && isSafeText(item.phone) && ['active', 'inactive'].includes(item.status))) return false;
    if (!value.enterprises.every(item =>
      parkIds.has(item.parkId) && isSafeText(item.name) && ['active', 'inactive'].includes(item.status) &&
      Array.isArray(item.adminUserIds) && item.adminUserIds.every(id => userIds.has(id)) &&
      Array.isArray(item.employeeUserIds) && item.employeeUserIds.every(id => userIds.has(id))
    )) return false;
    if (!value.accounts.every(item => {
      if (!userIds.has(item.userId) || accountUserIds.has(item.userId) || !parkIds.has(item.homeParkId) || !['active', 'inactive'].includes(item.status) || !validBalance(item.personal)) return false;
      accountUserIds.add(item.userId);
      if (!Array.isArray(item.enterpriseBalances)) return false;
      const balanceEnterpriseIds = new Set();
      return item.enterpriseBalances.every(balance => {
        if (!isPlainObject(balance) || !enterpriseIds.has(balance.enterpriseId) || balanceEnterpriseIds.has(balance.enterpriseId) || !validBalance(balance)) return false;
        const enterprise = value.enterprises.find(candidate => candidate.id === balance.enterpriseId);
        balanceEnterpriseIds.add(balance.enterpriseId);
        return enterprise.employeeUserIds.includes(item.userId);
      });
    })) return false;
    if (!value.merchants.every(item => parkIds.has(item.parkId) && isSafeText(item.name) && ['active', 'inactive'].includes(item.status))) return false;
    if (!validMerchantConfig(value.merchantConfig, merchantIds)) return false;
    if (!userIds.has(value.user.id) || !parkIds.has(value.user.homeParkId)) return false;

    const batchIds = new Set(value.rechargeBatches.map(item => item.id));
    const batchRequestIds = new Set();
    const batchesById = new Map(value.rechargeBatches.map(item => [item.id, item]));
    const batchItemsById = new Map();
    value.rechargeBatchItems.forEach(item => {
      if (!batchItemsById.has(item.batchId)) batchItemsById.set(item.batchId, []);
      batchItemsById.get(item.batchId).push(item);
    });
    if (!value.rechargeBatches.every(item => {
      if (!enterpriseIds.has(item.enterpriseId) || !parkIds.has(item.rechargeParkId) ||
        !['online', 'offline'].includes(item.method) || !isSafeId(item.requestId) || batchRequestIds.has(item.requestId) ||
        !['pending_payment', 'pending_confirmation', 'succeeded', 'validation_failed'].includes(item.status) ||
        !['pending', 'succeeded'].includes(item.paymentStatus) ||
        !['pending', 'succeeded'].includes(item.postingStatus) ||
        !['passed', 'failed'].includes(item.validationStatus) || !isMoney(item.totalAmount, item.validationStatus === 'failed') ||
        !isValidDateText(item.createdAt) ||
        (item.paymentReference !== null && !isSafeText(item.paymentReference)) ||
        (item.voucher !== null && !isSafeText(item.voucher))) return false;
      batchRequestIds.add(item.requestId);
      if (item.validationStatus === 'failed') {
        return item.status === 'validation_failed' && item.paymentStatus === 'pending' && item.postingStatus === 'pending' &&
          item.paymentReference === null && item.voucher === null && item.postedAt === null;
      }
      const pendingStatus = item.method === 'online' ? 'pending_payment' : 'pending_confirmation';
      if (item.postingStatus === 'succeeded') {
        if (item.status !== 'succeeded' || item.paymentStatus !== 'succeeded' || !isValidDateText(item.postedAt)) return false;
      } else if (item.status !== pendingStatus || item.paymentStatus !== 'pending' || item.postedAt !== null) return false;
      if (item.method === 'online') {
        if (item.voucher !== null) return false;
        if (item.paymentStatus === 'succeeded' ? !isSafeText(item.paymentReference) : item.paymentReference !== null) return false;
      } else {
        if (item.paymentReference !== null) return false;
        if (item.paymentStatus === 'succeeded' ? !isSafeText(item.voucher) : item.voucher !== null) return false;
      }
      return true;
    })) return false;
    if (!value.rechargeBatchItems.every(item => {
      const batch = batchesById.get(item.batchId);
      if (!batch || item.enterpriseId !== batch.enterpriseId || !Array.isArray(item.validationResult) ||
        item.validationResult.length === 0 || !item.validationResult.every(code => isSafeText(code))) return false;
      if (batch.validationStatus === 'failed') {
        return (item.userId === null || isSafeId(item.userId)) &&
          (item.amount === null || (typeof item.amount === 'number' && Number.isFinite(item.amount) &&
            Math.abs(item.amount * 100 - Math.round(item.amount * 100)) < 0.000001)) &&
          item.postingStatus === 'not_posted' &&
          Object.prototype.hasOwnProperty.call(item, 'rawItem') && isJsonSerializable(item.rawItem);
      }
      return enterpriseIds.has(item.enterpriseId) && userIds.has(item.userId) && isMoney(item.amount, false) &&
        !Object.prototype.hasOwnProperty.call(item, 'rawItem') &&
        ['pending', 'succeeded'].includes(item.postingStatus) &&
        item.validationResult.length === 1 && item.validationResult[0] === 'valid';
    })) return false;
    if (!value.rechargeBatches.every(batch => {
      const items = batchItemsById.get(batch.id) || [];
      if (items.length === 0) return false;
      const totalCents = items.reduce((sum, item) => sum + (isMoney(item.amount, false) ? toCents(item.amount) : 0), 0);
      if (batch.validationStatus === 'failed') {
        return items.some(item => !(item.validationResult.length === 1 && item.validationResult[0] === 'valid')) &&
          items.every(item => item.postingStatus === 'not_posted') &&
          totalCents === toCents(batch.totalAmount);
      }
      const expectedItemPostingStatus = batch.postingStatus === 'succeeded' ? 'succeeded' : 'pending';
      const userIdsInBatch = new Set();
      return items.every(item => {
        if (userIdsInBatch.has(item.userId) || item.postingStatus !== expectedItemPostingStatus) return false;
        userIdsInBatch.add(item.userId);
        return true;
      }) && totalCents === toCents(batch.totalAmount);
    })) return false;
    if (!value.orders.every(order => userIds.has(order.userId) && merchantIds.has(order.merchantId) && parkIds.has(order.consumeParkId) && validOrderDeductions(order, enterpriseIds))) return false;
    const ordersById = new Map(value.orders.map(item => [item.id, item]));

    const refundRequestIds = new Set();
    const enterpriseRefundedBySource = new Map();
    if (!value.refundRequests.every(item => {
      if (!isSafeId(item.requestId) || refundRequestIds.has(item.requestId) ||
        !isMoney(item.amount, false) || !isSafeText(item.status) || !isValidDateText(item.createdAt)) return false;
      refundRequestIds.add(item.requestId);
      if (item.type === 'personal_balance') {
        const hasMatchingRechargeSource = value.transactions.some(transaction =>
          transaction.type === 'personal_recharge' && transaction.userId === item.userId &&
          transaction.paymentChannel === item.originalPaymentChannel &&
          value.invoiceRecords.some(receipt =>
            receipt.type === 'recharge_receipt' && receipt.sourceId === transaction.id &&
            receipt.paymentChannel === transaction.paymentChannel
          )
        );
        return userIds.has(item.userId) && item.enterpriseId === null &&
          item.originalPaymentChannel === 'online' && hasMatchingRechargeSource;
      }
      if (item.type !== 'enterprise_balance' || !enterpriseIds.has(item.enterpriseId) ||
        !userIds.has(item.adminUserId) || !Array.isArray(item.items) || item.items.length === 0 ||
        !['original_payer', 'enterprise_payer_account', 'mixed'].includes(item.refundDestination)) return false;
      const enterprise = value.enterprises.find(candidate => candidate.id === item.enterpriseId);
      const itemTotalCents = item.items.reduce((sum, refundItem) => {
        if (!isPlainObject(refundItem) || !enterprise.employeeUserIds.includes(refundItem.userId) ||
          !batchIds.has(refundItem.rechargeBatchId) || !isMoney(refundItem.amount, false) ||
          !['original_payer', 'enterprise_payer_account'].includes(refundItem.refundDestination)) return NaN;
        const batch = batchesById.get(refundItem.rechargeBatchId);
        const batchItem = value.rechargeBatchItems.find(candidate => candidate.batchId === refundItem.rechargeBatchId &&
          candidate.enterpriseId === item.enterpriseId && candidate.userId === refundItem.userId);
        if (batch.enterpriseId !== item.enterpriseId || batch.postingStatus !== 'succeeded' ||
          !batchItem || batchItem.postingStatus !== 'succeeded') return NaN;
        const sourceKey = item.enterpriseId + '|' + refundItem.rechargeBatchId + '|' + refundItem.userId;
        const refundedCents = (enterpriseRefundedBySource.get(sourceKey) || 0) + toCents(refundItem.amount);
        if (refundedCents > toCents(batchItem.amount)) return NaN;
        enterpriseRefundedBySource.set(sourceKey, refundedCents);
        return sum + toCents(refundItem.amount);
      }, 0);
      return enterprise.adminUserIds.includes(item.adminUserId) && itemTotalCents === toCents(item.amount);
    })) return false;

    const rechargeTransactionsById = new Map();
    const enterpriseTransactionsByBatchAndUser = new Map();
    if (!value.transactions.every(item => {
      if (!userIds.has(item.userId) || !isSafeText(item.type) || !isMoney(Math.abs(item.amount), false)) return false;
      if (!['personal_recharge', 'enterprise_recharge'].includes(item.type)) return true;
      if (!parkIds.has(item.parkId) || !isSafeId(item.requestId) || !isValidDateText(item.createdAt)) return false;
      rechargeTransactionsById.set(item.id, item);
      if (item.type === 'personal_recharge') {
        return item.enterpriseId === null && item.batchId === null && item.paymentChannel === 'online';
      }
      const batch = batchesById.get(item.batchId);
      if (!batch || item.enterpriseId !== batch.enterpriseId || item.parkId !== batch.rechargeParkId) return false;
      const matchingItems = (batchItemsById.get(batch.id) || []).filter(batchItem =>
        batchItem.userId === item.userId && batchItem.enterpriseId === item.enterpriseId && toCents(batchItem.amount) === toCents(item.amount)
      );
      if (matchingItems.length !== 1) return false;
      const relationKey = batch.id + '|' + item.userId;
      if (enterpriseTransactionsByBatchAndUser.has(relationKey)) return false;
      enterpriseTransactionsByBatchAndUser.set(relationKey, item);
      return true;
    })) return false;
    if (!value.rechargeBatches.every(batch => {
      const items = batchItemsById.get(batch.id) || [];
      if (batch.postingStatus === 'pending') return !items.some(item => enterpriseTransactionsByBatchAndUser.has(batch.id + '|' + item.userId));
      return items.every(item => enterpriseTransactionsByBatchAndUser.has(batch.id + '|' + item.userId));
    })) return false;
    if (!value.invoiceTitles.every(item => userIds.has(item.userId) && isSafeText(item.name))) return false;
    const receiptSourceIds = new Set();
    const invoiceOrderIds = new Set();
    if (!value.invoiceRecords.every(item => {
      if (!isSafeText(item.type) || !isSafeId(item.sourceId)) return false;
      if (item.type === 'consume_invoice') {
        const order = ordersById.get(item.sourceId);
        if (!order || order.paymentStatus !== 'paid' || order.refundStatus !== 'none' ||
          !userIds.has(item.applicantUserId) || item.applicantUserId !== order.userId ||
          item.merchantId !== order.merchantId || item.consumeParkId !== order.consumeParkId ||
          !isPlainObject(item.titleSnapshot) || !isSafeText(item.titleSnapshot.name) ||
          !isSafeText(item.titleSnapshot.taxId) || !isMoney(item.amount, false) ||
          toCents(item.amount) !== toCents(order.amount) || !isSafeText(item.status) ||
          !isSafeId(item.requestId) || !isValidDateText(item.createdAt) ||
          invoiceOrderIds.has(item.sourceId)) return false;
        invoiceOrderIds.add(item.sourceId);
        return order.invoiceStatus !== 'not_applied';
      }
      if (item.type === 'service_fee_invoice') {
        const merchant = value.merchants.find(candidate => candidate.id === item.merchantId);
        return Boolean(merchant) && parkIds.has(item.consumeParkId) && merchant.parkId === item.consumeParkId &&
          isMoney(item.amount, false) && isSafeText(item.status) && isValidDateText(item.createdAt);
      }
      if (item.type !== 'recharge_receipt') return false;
      if (!isMoney(item.amount, false) || !isValidDateText(item.createdAt) || receiptSourceIds.has(item.sourceId)) return false;
      receiptSourceIds.add(item.sourceId);
      const transaction = rechargeTransactionsById.get(item.sourceId);
      if (transaction && transaction.type === 'personal_recharge') {
        return item.userId === transaction.userId && item.enterpriseId === null &&
          item.paymentChannel === transaction.paymentChannel && toCents(item.amount) === toCents(transaction.amount);
      }
      const batch = batchesById.get(item.sourceId);
      return Boolean(batch) && batch.postingStatus === 'succeeded' && item.userId === null &&
        item.enterpriseId === batch.enterpriseId && toCents(item.amount) === toCents(batch.totalAmount);
    })) return false;
    if (!Array.from(rechargeTransactionsById.values()).every(item =>
      item.type !== 'personal_recharge' || receiptSourceIds.has(item.id)
    )) return false;
    if (!value.rechargeBatches.every(batch =>
      batch.postingStatus === 'succeeded' ? receiptSourceIds.has(batch.id) : !receiptSourceIds.has(batch.id)
    )) return false;
    return true;
  }

  let state = deepClone(defaults);

  function replaceState(nextState) {
    Object.keys(state).forEach(key => delete state[key]);
    Object.assign(state, deepClone(nextState));
  }

  function save() {
    if (!isValidState(state)) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      localStorage.setItem(VERSION_KEY, DATA_VERSION);
      return true;
    } catch (error) {
      console.error('parkStateV2 save failed:', error);
      return false;
    }
  }

  function load() {
    let loaded = false;
    try {
      if (localStorage.getItem(VERSION_KEY) === DATA_VERSION) {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
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
    }
    return state;
  }

  function reset() {
    replaceState(defaults);
    return save();
  }

  function resetForTests() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(VERSION_KEY);
    } catch (error) {
      console.error('parkStateV2 reset failed:', error);
    }
    replaceState(defaults);
    save();
    return state;
  }

  function result(ok, code, data, idempotent) {
    return { ok, code, data: data || null, idempotent: Boolean(idempotent) };
  }

  function successful(code, data, idempotent) {
    return result(true, code, data, idempotent);
  }

  function restoreStorageValue(key, value) {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  }

  function transactional(action) {
    return function () {
      const snapshot = deepClone(state);
      let storedState = null;
      let storedVersion = null;
      try {
        storedState = localStorage.getItem(STORAGE_KEY);
        storedVersion = localStorage.getItem(VERSION_KEY);
      } catch (error) {
        console.error('parkStateV2 transaction snapshot failed:', error);
        return result(false, 'PERSIST_FAILED');
      }
      const response = action.apply(null, arguments);
      const shouldPersistFailure = !response.ok && response.persistOnFailure === true;
      if ((!response.ok && !shouldPersistFailure) || response.idempotent) return response;
      if (!isValidState(state) || !save()) {
        replaceState(snapshot);
        try {
          restoreStorageValue(STORAGE_KEY, storedState);
        } catch (error) {
          console.error('parkStateV2 state rollback failed:', error);
        }
        try {
          restoreStorageValue(VERSION_KEY, storedVersion);
        } catch (error) {
          console.error('parkStateV2 version rollback failed:', error);
        }
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

  const selectors = {
    getParkById: id => state.parks.find(item => item.id === id) || null,
    getUserById: function (first, second) {
      const userId = second || first;
      return state.users.find(item => item.id === userId && (!second || item.homeParkId === first)) || null;
    },
    getAccountByUser: userId => state.accounts.find(item => item.userId === userId) || null,
    getEnterpriseById: enterpriseId => state.enterprises.find(item => item.id === enterpriseId) || null,
    getEnterpriseBalance: (userId, enterpriseId) => {
      const account = state.accounts.find(item => item.userId === userId);
      return account ? account.enterpriseBalances.find(item => item.enterpriseId === enterpriseId) || null : null;
    },
    getOrdersByConsumePark: parkId => state.orders.filter(item => item.consumeParkId === parkId),
    getRechargeBatchesByEnterprise: enterpriseId => state.rechargeBatches.filter(item => item.enterpriseId === enterpriseId),
    getMerchantsByPark: parkId => state.merchants.filter(item => item.parkId === parkId)
  };

  function nowText() {
    return new Date().toISOString();
  }

  function findRechargeBatchByRequestId(requestId) {
    return state.rechargeBatches.find(item => item.requestId === requestId) || null;
  }

  function validateEnterpriseRechargeItem(enterprise, item, seenUserIds) {
    const errors = [];
    if (!isPlainObject(item)) return ['invalid_item'];
    if (!isSafeId(item.userId)) errors.push('invalid_user_id');
    else {
      if (seenUserIds.has(item.userId)) errors.push('duplicate_user');
      seenUserIds.add(item.userId);
      const account = selectors.getAccountByUser(item.userId);
      if (!enterprise.employeeUserIds.includes(item.userId) || !account || account.status !== 'active' ||
        !account.enterpriseBalances.some(balance => balance.enterpriseId === enterprise.id)) errors.push('employee_not_eligible');
    }
    if (!isMoney(item.amount, false)) errors.push('invalid_amount');
    if (Object.prototype.hasOwnProperty.call(item, 'enterpriseId') && item.enterpriseId !== enterprise.id) errors.push('enterprise_mismatch');
    return errors.length ? errors : ['valid'];
  }

  function validateEnterpriseRechargeItems(enterprise, items) {
    if (!Array.isArray(items) || items.length === 0) return false;
    const seenUserIds = new Set();
    return items.every(item => {
      const validationResult = validateEnterpriseRechargeItem(enterprise, item, seenUserIds);
      return validationResult.length === 1 && validationResult[0] === 'valid';
    });
  }

  function rechargePersonalAction(input) {
    if (!isPlainObject(input)) return result(false, 'VALIDATION_FAILED');
    const existing = state.transactions.find(item => item.type === 'personal_recharge' && item.requestId === input.requestId);
    if (existing) {
      const matchingReceipts = state.invoiceRecords.filter(item =>
        item.type === 'recharge_receipt' && item.sourceId === existing.id &&
        item.userId === existing.userId && item.enterpriseId === null &&
        toCents(item.amount) === toCents(existing.amount)
      );
      return matchingReceipts.length === 1 && isValidState(state)
        ? successful('PERSONAL_RECHARGE_SUCCEEDED', existing, true)
        : result(false, 'VALIDATION_FAILED');
    }
    const account = selectors.getAccountByUser(input.userId);
    if (!isSafeId(input.userId) || !isSafeId(input.parkId) || !isSafeId(input.requestId) || !isMoney(input.amount, false) ||
      !selectors.getParkById(input.parkId) || !account || account.status !== 'active') {
      return result(false, 'VALIDATION_FAILED');
    }

    const transaction = {
      id: nextId('TX-PR-', state.transactions),
      type: 'personal_recharge',
      userId: input.userId,
      enterpriseId: null,
      parkId: input.parkId,
      batchId: null,
      amount: input.amount,
      paymentChannel: 'online',
      requestId: input.requestId,
      createdAt: nowText()
    };
    account.personal.available = fromCents(toCents(account.personal.available) + toCents(input.amount));
    const persistedTransaction = deepClone(transaction);
    state.transactions.push(persistedTransaction);
    state.invoiceRecords.push(deepClone({
      id: nextId('INV-RC-', state.invoiceRecords),
      type: 'recharge_receipt',
      sourceId: transaction.id,
      userId: input.userId,
      enterpriseId: null,
      amount: input.amount,
      paymentChannel: transaction.paymentChannel,
      createdAt: transaction.createdAt
    }));
    return successful('PERSONAL_RECHARGE_SUCCEEDED', persistedTransaction);
  }

  function createEnterpriseRechargeAction(input) {
    if (!isPlainObject(input)) return result(false, 'BATCH_VALIDATION_FAILED');
    const existing = isSafeId(input.requestId) ? findRechargeBatchByRequestId(input.requestId) : null;
    if (existing) {
      if (existing.validationStatus === 'failed') {
        return Object.assign(result(false, 'BATCH_VALIDATION_FAILED', existing), { persistOnFailure: false });
      }
      const validationCode = existing.postingStatus === 'succeeded' ? validateBatchForPosting(existing) : null;
      return !validationCode && isValidState(state)
        ? successful('RECHARGE_BATCH_CREATED', existing, true)
        : result(false, validationCode || 'BATCH_VALIDATION_FAILED');
    }
    const enterprise = selectors.getEnterpriseById(input.enterpriseId);
    if (!isSafeId(input.enterpriseId) || !isSafeId(input.rechargeParkId) || !isSafeId(input.requestId) ||
      !['online', 'offline'].includes(input.method) || !enterprise || enterprise.status !== 'active' ||
      !selectors.getParkById(input.rechargeParkId) || !Array.isArray(input.items) || input.items.length === 0) {
      return result(false, 'BATCH_VALIDATION_FAILED');
    }

    const seenUserIds = new Set();
    const itemRecords = input.items.map(item => {
      const validationResult = validateEnterpriseRechargeItem(enterprise, item, seenUserIds);
      const isObject = isPlainObject(item);
      return {
        userId: isObject && isSafeId(item.userId) ? item.userId : null,
        amount: isObject && isMoney(item.amount, false) ? item.amount : null,
        rawItem: jsonSafeClone(item),
        validationResult
      };
    });
    const validationFailed = itemRecords.some(item => !(item.validationResult.length === 1 && item.validationResult[0] === 'valid'));
    const totalCents = itemRecords.reduce((sum, item) => sum + (isMoney(item.amount, false) ? toCents(item.amount) : 0), 0);
    const batch = {
      id: nextId('RB-', state.rechargeBatches),
      enterpriseId: enterprise.id,
      rechargeParkId: input.rechargeParkId,
      method: input.method,
      requestId: input.requestId,
      totalAmount: fromCents(totalCents),
      status: validationFailed ? 'validation_failed' : (input.method === 'online' ? 'pending_payment' : 'pending_confirmation'),
      paymentStatus: 'pending',
      postingStatus: 'pending',
      validationStatus: validationFailed ? 'failed' : 'passed',
      paymentReference: null,
      voucher: null,
      createdAt: nowText(),
      postedAt: null
    };
    const persistedBatch = deepClone(batch);
    state.rechargeBatches.push(persistedBatch);
    itemRecords.forEach(item => {
      const itemRecord = {
        id: nextId('RBI-', state.rechargeBatchItems),
        batchId: batch.id,
        enterpriseId: enterprise.id,
        userId: item.userId,
        amount: item.amount,
        validationResult: item.validationResult,
        postingStatus: validationFailed ? 'not_posted' : 'pending'
      };
      if (validationFailed) itemRecord.rawItem = item.rawItem;
      state.rechargeBatchItems.push(deepClone(itemRecord));
    });
    if (validationFailed) {
      return Object.assign(result(false, 'BATCH_VALIDATION_FAILED', persistedBatch), { persistOnFailure: true });
    }
    return successful('RECHARGE_BATCH_CREATED', persistedBatch);
  }

  function validateBatchForPosting(batch) {
    if (!batch) return 'BATCH_NOT_FOUND';
    if (batch.validationStatus !== 'passed') return 'BATCH_VALIDATION_FAILED';
    if (batch.paymentStatus !== 'succeeded') return 'PAYMENT_REQUIRED';
    if (batch.method === 'online' && !isSafeText(batch.paymentReference)) return 'PAYMENT_REFERENCE_REQUIRED';
    if (batch.method === 'offline' && !isSafeText(batch.voucher)) return 'VOUCHER_REQUIRED';
    const enterprise = selectors.getEnterpriseById(batch.enterpriseId);
    const items = state.rechargeBatchItems.filter(item => item.batchId === batch.id);
    if (!enterprise || enterprise.status !== 'active' || !selectors.getParkById(batch.rechargeParkId) ||
      !validateEnterpriseRechargeItems(enterprise, items)) return 'BATCH_VALIDATION_FAILED';
    const totalCents = items.reduce((sum, item) => sum + toCents(item.amount), 0);
    return totalCents === toCents(batch.totalAmount) ? null : 'BATCH_VALIDATION_FAILED';
  }

  function postRechargeBatchAction(batchId) {
    const batch = state.rechargeBatches.find(item => item.id === batchId) || null;
    const validationCode = validateBatchForPosting(batch);
    if (validationCode) return result(false, validationCode);
    if (batch.postingStatus === 'succeeded') {
      return isValidState(state)
        ? successful('RECHARGE_BATCH_POSTED', batch, true)
        : result(false, 'BATCH_VALIDATION_FAILED');
    }

    const items = state.rechargeBatchItems.filter(item => item.batchId === batch.id);
    const postedAt = nowText();
    items.forEach(item => {
      const balance = selectors.getEnterpriseBalance(item.userId, batch.enterpriseId);
      balance.available = fromCents(toCents(balance.available) + toCents(item.amount));
      state.transactions.push(deepClone({
        id: nextId('TX-ER-', state.transactions),
        type: 'enterprise_recharge',
        userId: item.userId,
        enterpriseId: batch.enterpriseId,
        parkId: batch.rechargeParkId,
        batchId: batch.id,
        amount: item.amount,
        requestId: batch.requestId + '-' + item.userId,
        createdAt: postedAt
      }));
      item.postingStatus = 'succeeded';
    });
    batch.postingStatus = 'succeeded';
    batch.status = 'succeeded';
    batch.postedAt = postedAt;
    if (!state.invoiceRecords.some(item => item.type === 'recharge_receipt' && item.sourceId === batch.id)) {
      state.invoiceRecords.push(deepClone({
        id: nextId('INV-RC-', state.invoiceRecords),
        type: 'recharge_receipt',
        sourceId: batch.id,
        userId: null,
        enterpriseId: batch.enterpriseId,
        amount: batch.totalAmount,
        createdAt: postedAt
      }));
    }
    return successful('RECHARGE_BATCH_POSTED', batch);
  }

  function confirmEnterpriseOnlinePaymentAction(batchId, paymentReference) {
    const batch = state.rechargeBatches.find(item => item.id === batchId) || null;
    if (!batch) return result(false, 'BATCH_NOT_FOUND');
    if (batch.method !== 'online') return result(false, 'METHOD_MISMATCH');
    if (!isSafeText(paymentReference)) return result(false, 'PAYMENT_REFERENCE_REQUIRED');
    if (batch.postingStatus === 'succeeded') {
      const validationCode = validateBatchForPosting(batch);
      return !validationCode && isValidState(state)
        ? successful('ONLINE_PAYMENT_CONFIRMED', batch, true)
        : result(false, validationCode || 'BATCH_VALIDATION_FAILED');
    }
    const originalPaymentStatus = batch.paymentStatus;
    const originalPaymentReference = batch.paymentReference;
    batch.paymentStatus = 'succeeded';
    batch.paymentReference = paymentReference;
    const validationCode = validateBatchForPosting(batch);
    batch.paymentStatus = originalPaymentStatus;
    batch.paymentReference = originalPaymentReference;
    if (validationCode) return result(false, validationCode);
    batch.paymentStatus = 'succeeded';
    batch.paymentReference = paymentReference;
    return postRechargeBatchAction(batch.id);
  }

  function confirmOfflineRechargeAction(batchId, voucher) {
    const batch = state.rechargeBatches.find(item => item.id === batchId) || null;
    if (!batch) return result(false, 'BATCH_NOT_FOUND');
    if (batch.method !== 'offline') return result(false, 'METHOD_MISMATCH');
    if (!isSafeText(voucher)) return result(false, 'VOUCHER_REQUIRED');
    if (batch.postingStatus === 'succeeded') {
      const validationCode = validateBatchForPosting(batch);
      return !validationCode && isValidState(state)
        ? successful('OFFLINE_RECHARGE_CONFIRMED', batch, true)
        : result(false, validationCode || 'BATCH_VALIDATION_FAILED');
    }
    const originalPaymentStatus = batch.paymentStatus;
    const originalVoucher = batch.voucher;
    batch.paymentStatus = 'succeeded';
    batch.voucher = voucher;
    const validationCode = validateBatchForPosting(batch);
    batch.paymentStatus = originalPaymentStatus;
    batch.voucher = originalVoucher;
    if (validationCode) return result(false, validationCode);
    batch.paymentStatus = 'succeeded';
    batch.voucher = voucher;
    return postRechargeBatchAction(batch.id);
  }

  function traceRechargeParkIds(userId, enterpriseDeductions, personalAmount, homeParkId) {
    const parkIds = [];
    enterpriseDeductions.forEach(deduction => {
      state.transactions.forEach(transaction => {
        if (transaction.type === 'enterprise_recharge' && transaction.userId === userId &&
          transaction.enterpriseId === deduction.enterpriseId && !parkIds.includes(transaction.parkId)) {
          parkIds.push(transaction.parkId);
        }
      });
    });
    if (personalAmount > 0) {
      state.transactions.forEach(transaction => {
        if (transaction.type === 'personal_recharge' && transaction.userId === userId && !parkIds.includes(transaction.parkId)) {
          parkIds.push(transaction.parkId);
        }
      });
    }
    if (parkIds.length === 0 && homeParkId) parkIds.push(homeParkId);
    return parkIds;
  }

  function collectPaymentAction(input) {
    if (!isPlainObject(input) || !isSafeId(input.userId) || !isSafeId(input.merchantId) ||
      !isSafeId(input.requestId) || !isMoney(input.amount, false)) return result(false, 'VALIDATION_FAILED');

    const existing = state.orders.find(item => item.requestId === input.requestId) || null;
    if (existing) {
      return isValidState(state)
        ? successful('PAYMENT_SUCCEEDED', { order: existing }, true)
        : result(false, 'VALIDATION_FAILED');
    }

    const account = selectors.getAccountByUser(input.userId);
    const merchant = state.merchants.find(item => item.id === input.merchantId) || null;
    if (!account || account.status !== 'active' || !merchant || merchant.status !== 'active') {
      return result(false, 'VALIDATION_FAILED');
    }

    const amountCents = toCents(input.amount);
    const enterpriseBalance = account.enterpriseBalances[0] || null;
    const enterpriseCents = enterpriseBalance ? Math.min(toCents(enterpriseBalance.available), amountCents) : 0;
    const personalCents = amountCents - enterpriseCents;
    if (toCents(account.personal.available) < personalCents) return result(false, 'INSUFFICIENT_BALANCE');

    const enterpriseDeductions = enterpriseCents > 0
      ? [{ enterpriseId: enterpriseBalance.enterpriseId, amount: fromCents(enterpriseCents) }]
      : [];
    const personalAmount = fromCents(personalCents);
    const createdAt = nowText();
    const order = {
      id: nextId('ORD-', state.orders),
      requestId: input.requestId,
      userId: input.userId,
      merchantId: merchant.id,
      amount: input.amount,
      enterpriseDeductions,
      personalAmount,
      rechargeParkIds: traceRechargeParkIds(input.userId, enterpriseDeductions, personalAmount, account.homeParkId),
      consumeParkId: merchant.parkId,
      paymentStatus: 'paid',
      invoiceStatus: 'not_applied',
      refundStatus: 'none',
      settlementStatus: 'pending',
      createdAt
    };

    if (enterpriseCents > 0) {
      const before = toCents(enterpriseBalance.available);
      enterpriseBalance.available = fromCents(before - enterpriseCents);
      enterpriseBalance.consumed = fromCents(toCents(enterpriseBalance.consumed) + enterpriseCents);
      state.transactions.push({
        id: nextId('TX-EC-', state.transactions),
        type: 'enterprise_consume',
        userId: input.userId,
        enterpriseId: enterpriseBalance.enterpriseId,
        orderId: order.id,
        amount: -fromCents(enterpriseCents),
        rechargeParkIds: order.rechargeParkIds.slice(),
        consumeParkId: merchant.parkId,
        createdAt
      });
    }
    if (personalCents > 0) {
      const before = toCents(account.personal.available);
      account.personal.available = fromCents(before - personalCents);
      account.personal.consumed = fromCents(toCents(account.personal.consumed) + personalCents);
      state.transactions.push({
        id: nextId('TX-PC-', state.transactions),
        type: 'personal_consume',
        userId: input.userId,
        enterpriseId: null,
        orderId: order.id,
        amount: -personalAmount,
        rechargeParkIds: order.rechargeParkIds.slice(),
        consumeParkId: merchant.parkId,
        createdAt
      });
    }
    state.orders.push(order);
    return successful('PAYMENT_SUCCEEDED', { order });
  }

  function findRefundByRequestId(requestId) {
    return state.refundRequests.find(item => item.requestId === requestId) || null;
  }

  function applyPersonalRefundAction(input) {
    if (!isPlainObject(input)) return result(false, 'VALIDATION_FAILED');
    const existing = isSafeId(input.requestId) ? findRefundByRequestId(input.requestId) : null;
    if (existing) {
      return existing.type === 'personal_balance' && isValidState(state)
        ? successful('PERSONAL_REFUND_APPLIED', existing, true)
        : result(false, 'VALIDATION_FAILED');
    }
    const account = selectors.getAccountByUser(input.userId);
    if (!isSafeId(input.userId) || !isSafeId(input.requestId) || !isMoney(input.amount, false) ||
      !account || account.status !== 'active') return result(false, 'VALIDATION_FAILED');
    if (toCents(account.personal.available) < toCents(input.amount)) {
      return result(false, 'INSUFFICIENT_PERSONAL_BALANCE');
    }
    const rechargeSource = state.transactions.find(item =>
      item.type === 'personal_recharge' && item.userId === input.userId && item.paymentChannel === 'online' &&
      state.invoiceRecords.some(receipt =>
        receipt.type === 'recharge_receipt' && receipt.sourceId === item.id &&
        receipt.userId === item.userId && receipt.enterpriseId === null &&
        receipt.paymentChannel === item.paymentChannel && toCents(receipt.amount) === toCents(item.amount)
      )
    ) || null;
    if (!rechargeSource) return result(false, 'PERSONAL_RECHARGE_SOURCE_NOT_FOUND');
    const originalPaymentChannel = rechargeSource.paymentChannel;

    const amountCents = toCents(input.amount);
    account.personal.available = fromCents(toCents(account.personal.available) - amountCents);
    account.personal.frozen = fromCents(toCents(account.personal.frozen) + amountCents);
    const refund = {
      id: nextId('RF-PR-', state.refundRequests),
      type: 'personal_balance',
      userId: input.userId,
      enterpriseId: null,
      amount: input.amount,
      originalPaymentChannel,
      status: 'pending',
      requestId: input.requestId,
      createdAt: nowText()
    };
    state.refundRequests.push(refund);
    return successful('PERSONAL_REFUND_APPLIED', refund);
  }

  function enterpriseRefundedCents(enterpriseId, userId, rechargeBatchId) {
    return state.refundRequests.reduce((total, request) => {
      if (request.type !== 'enterprise_balance' || request.enterpriseId !== enterpriseId || !Array.isArray(request.items)) return total;
      return total + request.items.reduce((itemTotal, item) => {
        return item.userId === userId && item.rechargeBatchId === rechargeBatchId
          ? itemTotal + toCents(item.amount)
          : itemTotal;
      }, 0);
    }, 0);
  }

  function applyEnterpriseRefundAction(input) {
    if (!isPlainObject(input)) return result(false, 'VALIDATION_FAILED');
    const existing = isSafeId(input.requestId) ? findRefundByRequestId(input.requestId) : null;
    if (existing) {
      return existing.type === 'enterprise_balance' && isValidState(state)
        ? successful('ENTERPRISE_REFUND_APPLIED', existing, true)
        : result(false, 'VALIDATION_FAILED');
    }
    const enterprise = selectors.getEnterpriseById(input.enterpriseId);
    if (!isSafeId(input.enterpriseId) || !isSafeId(input.adminUserId) || !isSafeId(input.requestId) ||
      !enterprise || enterprise.status !== 'active' || !Array.isArray(input.items) || input.items.length === 0) {
      return result(false, 'VALIDATION_FAILED');
    }
    if (!enterprise.adminUserIds.includes(input.adminUserId)) return result(false, 'ADMIN_FORBIDDEN');

    const requestedByBalance = new Map();
    const requestedBySource = new Map();
    const normalizedItems = [];
    for (const item of input.items) {
      if (!isPlainObject(item) || !isSafeId(item.userId) || !isSafeId(item.rechargeBatchId) || !isMoney(item.amount, false) ||
        !enterprise.employeeUserIds.includes(item.userId)) return result(false, 'EMPLOYEE_FORBIDDEN');
      const batch = state.rechargeBatches.find(candidate => candidate.id === item.rechargeBatchId) || null;
      const batchItem = state.rechargeBatchItems.find(candidate => candidate.batchId === item.rechargeBatchId &&
        candidate.enterpriseId === enterprise.id && candidate.userId === item.userId) || null;
      if (!batch || batch.enterpriseId !== enterprise.id || batch.postingStatus !== 'succeeded' ||
        !batchItem || batchItem.postingStatus !== 'succeeded') return result(false, 'RECHARGE_BATCH_NOT_REFUNDABLE');

      const sourceKey = item.rechargeBatchId + '|' + item.userId;
      const sourceRequestedCents = (requestedBySource.get(sourceKey) || 0) + toCents(item.amount);
      if (enterpriseRefundedCents(enterprise.id, item.userId, item.rechargeBatchId) + sourceRequestedCents > toCents(batchItem.amount)) {
        return result(false, 'RECHARGE_BATCH_NOT_REFUNDABLE');
      }
      requestedBySource.set(sourceKey, sourceRequestedCents);
      requestedByBalance.set(item.userId, (requestedByBalance.get(item.userId) || 0) + toCents(item.amount));
      normalizedItems.push({
        userId: item.userId,
        amount: item.amount,
        rechargeBatchId: item.rechargeBatchId,
        refundDestination: batch.method === 'online' ? 'original_payer' : 'enterprise_payer_account'
      });
    }

    for (const [userId, amountCents] of requestedByBalance) {
      const balance = selectors.getEnterpriseBalance(userId, enterprise.id);
      if (!balance || toCents(balance.available) < amountCents) return result(false, 'INSUFFICIENT_ENTERPRISE_BALANCE');
    }
    requestedByBalance.forEach((amountCents, userId) => {
      const balance = selectors.getEnterpriseBalance(userId, enterprise.id);
      balance.available = fromCents(toCents(balance.available) - amountCents);
      balance.frozen = fromCents(toCents(balance.frozen) + amountCents);
    });
    const destinations = new Set(normalizedItems.map(item => item.refundDestination));
    const refund = {
      id: nextId('RF-ER-', state.refundRequests),
      type: 'enterprise_balance',
      userId: null,
      enterpriseId: enterprise.id,
      adminUserId: input.adminUserId,
      items: normalizedItems,
      amount: fromCents(normalizedItems.reduce((sum, item) => sum + toCents(item.amount), 0)),
      refundDestination: destinations.size === 1 ? normalizedItems[0].refundDestination : 'mixed',
      status: 'pending',
      requestId: input.requestId,
      createdAt: nowText()
    };
    state.refundRequests.push(refund);
    return successful('ENTERPRISE_REFUND_APPLIED', refund);
  }

  function applyConsumeInvoiceAction(input) {
    if (!isPlainObject(input)) return result(false, 'VALIDATION_FAILED');
    const existing = isSafeId(input.requestId)
      ? state.invoiceRecords.find(item => item.type === 'consume_invoice' && item.requestId === input.requestId) || null
      : null;
    if (existing) {
      return isValidState(state)
        ? successful('CONSUME_INVOICE_APPLIED', existing, true)
        : result(false, 'VALIDATION_FAILED');
    }
    if (!isSafeId(input.orderId) || !isSafeId(input.applicantUserId) || !isSafeId(input.requestId) ||
      !isPlainObject(input.title) || !isSafeText(input.title.name) || !isSafeText(input.title.taxId)) {
      return result(false, 'VALIDATION_FAILED');
    }
    const order = state.orders.find(item => item.id === input.orderId) || null;
    if (!order || order.paymentStatus !== 'paid' || order.refundStatus !== 'none') return result(false, 'ORDER_NOT_INVOICEABLE');
    if (order.userId !== input.applicantUserId) return result(false, 'APPLICANT_FORBIDDEN');
    if (order.invoiceStatus !== 'not_applied' || state.invoiceRecords.some(item => item.type === 'consume_invoice' && item.sourceId === order.id)) {
      return result(false, 'INVOICE_ALREADY_APPLIED');
    }

    const invoice = {
      id: nextId('INV-C-', state.invoiceRecords),
      type: 'consume_invoice',
      sourceId: order.id,
      applicantUserId: input.applicantUserId,
      merchantId: order.merchantId,
      consumeParkId: order.consumeParkId,
      titleSnapshot: deepClone(input.title),
      amount: order.amount,
      status: 'pending',
      requestId: input.requestId,
      createdAt: nowText()
    };
    state.invoiceRecords.push(invoice);
    order.invoiceStatus = 'applied';
    return successful('CONSUME_INVOICE_APPLIED', invoice);
  }

  function refundConsumeAction(orderId, merchantContext) {
    const order = state.orders.find(item => item.id === orderId) || null;
    if (!order || !isPlainObject(merchantContext) || !isSafeId(merchantContext.merchantId)) {
      return result(false, 'VALIDATION_FAILED');
    }
    if (order.merchantId !== merchantContext.merchantId) return result(false, 'MERCHANT_FORBIDDEN');
    if (order.refundStatus === 'refunded') {
      return isValidState(state)
        ? successful('CONSUME_REFUNDED', { order }, true)
        : result(false, 'VALIDATION_FAILED');
    }
    if (order.settlementStatus === 'settling' || order.settlementStatus === 'settled') {
      return result(false, 'SETTLED_REFUND_REQUIRES_REVERSAL');
    }
    if (order.paymentStatus !== 'paid' || order.refundStatus !== 'none') return result(false, 'ORDER_NOT_REFUNDABLE');

    const account = selectors.getAccountByUser(order.userId);
    if (!account) return result(false, 'VALIDATION_FAILED');
    const createdAt = nowText();
    order.enterpriseDeductions.forEach(deduction => {
      const balance = selectors.getEnterpriseBalance(order.userId, deduction.enterpriseId);
      const cents = toCents(deduction.amount);
      balance.available = fromCents(toCents(balance.available) + cents);
      balance.consumed = fromCents(toCents(balance.consumed) - cents);
      state.transactions.push({
        id: nextId('TX-ERF-', state.transactions),
        type: 'enterprise_consume_refund',
        userId: order.userId,
        enterpriseId: deduction.enterpriseId,
        orderId: order.id,
        amount: deduction.amount,
        rechargeParkIds: order.rechargeParkIds.slice(),
        consumeParkId: order.consumeParkId,
        createdAt
      });
    });
    if (order.personalAmount > 0) {
      const cents = toCents(order.personalAmount);
      account.personal.available = fromCents(toCents(account.personal.available) + cents);
      account.personal.consumed = fromCents(toCents(account.personal.consumed) - cents);
      state.transactions.push({
        id: nextId('TX-PRF-', state.transactions),
        type: 'personal_consume_refund',
        userId: order.userId,
        enterpriseId: null,
        orderId: order.id,
        amount: order.personalAmount,
        rechargeParkIds: order.rechargeParkIds.slice(),
        consumeParkId: order.consumeParkId,
        createdAt
      });
    }
    order.refundStatus = 'refunded';
    order.refundedAt = createdAt;
    order.settlementStatus = 'cancelled';
    return successful('CONSUME_REFUNDED', { order });
  }

  function syncSettlementsAction() {
    const settledOrderIds = new Set();
    state.pendingSettlements.forEach(settlement => {
      if (Array.isArray(settlement.orderIds)) settlement.orderIds.forEach(orderId => settledOrderIds.add(orderId));
    });
    const groups = new Map();
    state.orders.forEach(order => {
      if (order.paymentStatus !== 'paid' || order.refundStatus !== 'none' || settledOrderIds.has(order.id)) return;
      const key = order.consumeParkId + '|' + order.merchantId;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(order);
    });
    const created = [];
    groups.forEach(orders => {
      const merchantId = orders[0].merchantId;
      const config = state.merchantConfig[merchantId];
      const grossCents = orders.reduce((sum, order) => sum + toCents(order.amount), 0);
      const settlementCents = Math.round(grossCents * config.ratio);
      const settlement = {
        id: nextId('SET-', state.pendingSettlements),
        consumeParkId: orders[0].consumeParkId,
        merchantId,
        orderIds: orders.map(order => order.id),
        grossAmount: fromCents(grossCents),
        serviceFee: fromCents(grossCents - settlementCents),
        settlementAmount: fromCents(settlementCents),
        status: 'pending',
        createdAt: nowText()
      };
      state.pendingSettlements.push(settlement);
      orders.forEach(order => {
        order.settlementStatus = 'settling';
      });
      created.push(settlement);
    });
    return successful('SETTLEMENTS_SYNCED', created);
  }

  const actions = {
    rechargePersonal: transactional(rechargePersonalAction),
    createEnterpriseRecharge: transactional(createEnterpriseRechargeAction),
    postRechargeBatch: transactional(postRechargeBatchAction),
    confirmEnterpriseOnlinePayment: transactional(confirmEnterpriseOnlinePaymentAction),
    confirmOfflineRecharge: transactional(confirmOfflineRechargeAction),
    collectPayment: transactional(collectPaymentAction),
    applyPersonalRefund: transactional(applyPersonalRefundAction),
    applyEnterpriseRefund: transactional(applyEnterpriseRefundAction),
    applyConsumeInvoice: transactional(applyConsumeInvoiceAction),
    refundConsume: transactional(refundConsumeAction),
    syncSettlements: transactional(syncSettlementsAction)
  };

  load();

  window.parkState = {
    state,
    selectors,
    save,
    reset,
    resetForTests,
    reloadForTests: load,
    actions,
    internals: {
      DATA_VERSION,
      deepClone,
      isMoney,
      isValidState,
      nextId,
      result,
      successful,
      transactional,
      toCents,
      fromCents,
      demoTime
    }
  };
})();

function formatMoney(n) {
  return (n ?? 0).toFixed(2);
}
