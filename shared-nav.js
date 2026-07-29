(function () {
  'use strict';

  function init() {
    const phoneShell = document.querySelector('.phone-shell');
    const topbar = document.querySelector('.app-shell .topbar');
    if (!phoneShell || !topbar) return;

    const currentPath = window.location.pathname.split('/').pop() || 'user-home.html';

    const overlay = document.createElement('div');
    overlay.className = 'user-drawer-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    const drawer = document.createElement('div');
    drawer.className = 'user-drawer';
    drawer.setAttribute('role', 'navigation');
    drawer.setAttribute('aria-label', '入口切换');

    const currentGroup = currentPath.startsWith('merchant-') ? 'merchant'
      : currentPath.startsWith('admin-') ? 'admin' : 'user';

    const groupDefs = {
      user: {
        title: '用户端',
        links: [
          { href: 'user-home.html', label: '园区码服务' },
          { href: 'user-wallet.html', label: '钱包首页' },
          { href: 'user-recharge.html', label: '余额充值' },
          { href: 'user-payment-code.html', label: '付款码' },
          { href: 'user-refund.html', label: '注销申请' }
        ]
      },
      merchant: {
        title: '商家端',
        links: [
          { href: 'merchant-home.html', label: '商户首页' },
          { href: 'merchant-scan.html', label: '扫码收款' },
          { href: 'merchant-orders.html', label: '订单记录' },
          { href: 'merchant-settlements.html', label: '分账管理' }
        ]
      },
      admin: {
        title: '储值后台',
        links: [
          { href: 'admin-accounts.html', label: '储值账户' },
          { href: 'admin-orders.html', label: '订单管理' },
          { href: 'admin-refunds.html', label: '退款审核' },
          { href: 'admin-settlements.html', label: '分账管理' },
          { href: 'admin-merchants.html', label: '商户配置' }
        ]
      }
    };
    const groups = [groupDefs[currentGroup]];

    let listHtml = '<div class="user-drawer-header"><strong>入口切换</strong></div><div class="user-drawer-list">';
    groups.forEach(function (group) {
      listHtml += '<div class="user-drawer-group">' + group.title + '</div>';
      group.links.forEach(function (link) {
        const active = currentPath === link.href ? 'active' : '';
        listHtml += '<a class="' + active + '" href="' + link.href + '">' + link.label + '</a>';
      });
    });
    listHtml += '</div>';
    drawer.innerHTML = listHtml;

    const toggle = document.createElement('button');
    toggle.className = 'topbar-icon user-menu-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', '打开入口');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '≡';

    const firstTopbarChild = topbar.firstElementChild;
    if (firstTopbarChild) {
      topbar.insertBefore(toggle, firstTopbarChild);
    } else {
      topbar.appendChild(toggle);
    }

    phoneShell.appendChild(overlay);
    phoneShell.appendChild(drawer);

    function open() {
      drawer.classList.add('active');
      overlay.classList.add('active');
      toggle.setAttribute('aria-expanded', 'true');
    }

    function close() {
      drawer.classList.remove('active');
      overlay.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      if (drawer.classList.contains('active')) close(); else open();
    });

    overlay.addEventListener('click', close);
    drawer.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('active')) close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
