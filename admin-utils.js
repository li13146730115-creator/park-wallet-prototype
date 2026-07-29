(function () {
  'use strict';

  const PARK_STORAGE_KEY = 'parkV2AdminPark';
  const PARKS = (window.parkState && Array.isArray(window.parkState.state.parks) && window.parkState.state.parks.length)
    ? window.parkState.state.parks.map(function (park) { return { id: park.id, name: park.name }; })
    : [
        { id: 'park-001', name: '海智园区' },
        { id: 'park-002', name: '海创园区' },
        { id: 'park-003', name: '空白园区' }
      ];

  window.exportTableCsv = function (tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const rows = Array.from(table.querySelectorAll('tr')).map(function (row) {
      return Array.from(row.cells).map(function (cell) {
        const value = cell.innerText.replace(/\s+/g, ' ').trim().replace(/"/g, '""');
        return '"' + value + '"';
      }).join(',');
    });

    const blob = new Blob(['\ufeff' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = (filename || '导出数据') + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  function getCurrentPark() {
    try {
      const stored = localStorage.getItem(PARK_STORAGE_KEY);
      if (stored) {
        const found = PARKS.find(function (p) { return p.id === stored; });
        if (found) return found;
      }
    } catch (error) {
      // ignore storage errors
    }
    return PARKS[0];
  }

  function setCurrentPark(parkId) {
    try {
      localStorage.setItem(PARK_STORAGE_KEY, parkId);
    } catch (error) {
      // ignore storage errors
    }
  }

  function injectParkSelector() {
    const headers = document.querySelectorAll('.admin-header');
    headers.forEach(function (header) {
      const existing = header.querySelector('.admin-park-selector');
      if (existing) return;

      const current = getCurrentPark();
      const wrapper = document.createElement('div');
      wrapper.className = 'admin-header-right';

      const select = document.createElement('select');
      select.className = 'admin-park-selector';
      select.setAttribute('aria-label', '园区切换');
      PARKS.forEach(function (park) {
        const option = document.createElement('option');
        option.value = park.id;
        option.textContent = park.name;
        if (park.id === current.id) option.selected = true;
        select.appendChild(option);
      });
      select.addEventListener('change', function () {
        setCurrentPark(select.value);
        window.location.reload();
      });

      const adminLabel = document.createElement('span');
      adminLabel.textContent = '管理员';
      adminLabel.className = 'text-muted text-small';

      wrapper.appendChild(select);
      wrapper.appendChild(adminLabel);

      const oldLabel = header.querySelector('div');
      if (oldLabel) {
        oldLabel.replaceWith(wrapper);
      } else {
        header.appendChild(wrapper);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectParkSelector);
  } else {
    injectParkSelector();
  }

  window.parkV2Admin = {
    parks: PARKS,
    getCurrentPark: getCurrentPark,
    getCurrentParkId: function () { return getCurrentPark().id; },
    setCurrentPark: setCurrentPark,
    filterCurrentPark: function (items) {
      const parkId = getCurrentPark().id;
      return (items || []).filter(function (item) { return item.parkId === parkId; });
    },
    injectParkSelector: injectParkSelector
  };
})();
