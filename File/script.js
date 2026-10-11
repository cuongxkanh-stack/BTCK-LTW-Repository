const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  sources: [],
  queue: [],
  monitor: [],
  activeQueueStatus: 'Chờ duyệt',
  selectedQueueIndex: 0
};

function statusClass(status) {
  return ({
    'Hoạt động': 'active',
    'Cần kiểm tra': 'check',
    'Chờ duyệt': 'pending',
    'Đã duyệt': 'approved',
    'Từ chối': 'rejected',
    'Ổn định': 'stable',
    'Sắp hết hạn': 'expiring',
    'Đã cũ': 'old'
  })[status] || '';
}

function badge(status) {
  return `<span class="status ${statusClass(status)}">${status}</span>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
}

async function loadData() {
  const api = window.LegalPathAPI || {};
  const [sources, queue, monitor] = await Promise.all([
    api.getSources ? api.getSources() : Promise.resolve([]),
    api.getQueue ? api.getQueue() : Promise.resolve([]),
    api.getMonitor ? api.getMonitor() : Promise.resolve([])
  ]);

  state.sources = sources || [];
  state.queue = queue || [];
  state.monitor = monitor || [];

  if (state.queue.length) {
    const firstPendingIndex = state.queue.findIndex((item) => item.status === 'Chờ duyệt');
    state.selectedQueueIndex = firstPendingIndex >= 0 ? firstPendingIndex : 0;
  }
}

function renderSources() {
  const sourceSearch = $('#sourceSearch');
  if (!sourceSearch) return;

  const q = (sourceSearch.value || '').trim().toLowerCase();
  const status = $('#sourceStatus').value;
  const type = $('#sourceType').value;
  const list = state.sources.filter((source) => (
    `${source.name} ${source.url}`.toLowerCase().includes(q) &&
    (status === 'all' || source.status === status) &&
    (type === 'all' || source.type === type)
  ));

  $('#sourceRows').innerHTML = list.map((source) => `
    <tr>
      <td>${escapeHtml(source.name)}</td>
      <td>${escapeHtml(source.type)}</td>
      <td><a class="url" href="${escapeHtml(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.url)}</a></td>
      <td>${badge(source.status)}</td>
      <td><button class="icon-button remove-source" data-name="${escapeHtml(source.name)}" title="Xóa nguồn" aria-label="Xóa nguồn" type="button">⋯</button></td>
    </tr>
  `).join('');

  $('#sourceEmpty').classList.toggle('hidden', list.length !== 0);
  $('#sourceCount').textContent = `Hiển thị ${list.length ? 1 : 0} - ${list.length} trong ${state.sources.length} nguồn`;
  $('#sourceTotal').textContent = state.sources.length;

  $$('.remove-source').forEach((button) => {
    button.addEventListener('click', () => {
      if (confirm(`Xóa nguồn "${button.dataset.name}" khỏi danh sách demo?`)) {
        const index = state.sources.findIndex((source) => source.name === button.dataset.name);
        if (index >= 0) {
          state.sources.splice(index, 1);
          renderSources();
          toast('Đã xóa nguồn khỏi giao diện.');
        }
      }
    });
  });
}

function renderQueue() {
  const queueSearch = $('#queueSearch');
  if (!queueSearch) return;

  const q = queueSearch.value.toLowerCase();
  const rows = state.queue
    .map((item, index) => ({ ...item, index }))
    .filter((item) => item.status === state.activeQueueStatus && `${item.title} ${item.source} ${item.sender}`.toLowerCase().includes(q));

  $('#queueRows').innerHTML = rows.map((item) => `
    <tr class="clickable ${item.index === state.selectedQueueIndex ? 'selected-row' : ''}" data-index="${item.index}">
      <td><strong>${escapeHtml(item.title)}</strong></td>
      <td><span class="source-pill">${escapeHtml(item.source)}</span></td>
      <td>${escapeHtml(item.sender)}</td>
      <td>${item.date}<br><small>${item.time}</small></td>
      <td>${badge(item.status)}</td>
    </tr>
  `).join('');

  $('#queueEmpty').classList.toggle('hidden', rows.length !== 0);
  $('#pendingCount').textContent = state.queue.filter((item) => item.status === 'Chờ duyệt').length;

  $$('#queueRows tr').forEach((row) => {
    row.addEventListener('click', () => {
      state.selectedQueueIndex = Number(row.dataset.index);
      renderQueue();
      renderQueueDetail();
    });
  });

  renderQueueDetail();
}

function renderQueueDetail() {
  const item = state.queue[state.selectedQueueIndex];
  if (!item) {
    $('#queueDetail').innerHTML = '<p>Chọn một nội dung để xem chi tiết.</p>';
    return;
  }

  const pending = item.status === 'Chờ duyệt';
  const email = item.sender.toLowerCase().replace(/\s+/g, '.').replace(/\.\./g, '.') + '@example.com';

  $('#queueDetail').innerHTML = `
    <div>
      <h3>Chi tiết nội dung cần duyệt</h3>
      <h3>${escapeHtml(item.title)}</h3>
      <div class="detail-meta">
        <span>Nguồn</span><span class="source-pill">${escapeHtml(item.source)}</span>
        <span>Người gửi</span><span>${escapeHtml(item.sender)}</span>
        <span>Email</span><span>${escapeHtml(email)}</span>
        <span>Ngày gửi</span><span>${item.date} ${item.time}</span>
      </div>
    </div>
    <div>
      <div class="detail-meta">
        <span>Trạng thái</span><span>${badge(item.status)}</span>
        <span>Mô tả</span><span>${escapeHtml(item.description)}</span>
      </div>
      <div class="detail-actions">
        ${pending ? '<button class="btn outline" id="rejectItem" type="button">× Từ chối</button><button class="btn primary" id="approveItem" type="button">✓ Duyệt</button>' : ''}
      </div>
    </div>
    <div class="document-preview">
      <div>
        CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br>
        Độc lập - Tự do - Hạnh phúc<br>
        <strong>THÔNG TƯ</strong><br>
        ${escapeHtml(item.description)}<br>
        ━━━━━━━━━━━━━━━━
      </div>
    </div>
  `;

  const approveButton = $('#approveItem');
  const rejectButton = $('#rejectItem');

  if (approveButton) {
    approveButton.addEventListener('click', () => updateQueueItem('Đã duyệt'));
  }

  if (rejectButton) {
    rejectButton.addEventListener('click', () => updateQueueItem('Từ chối'));
  }
}

function updateQueueItem(status) {
  const item = state.queue[state.selectedQueueIndex];
  if (!item) return;

  item.status = status;
  state.activeQueueStatus = status;
  $$('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.status === status));
  renderQueue();
  toast(status === 'Đã duyệt' ? 'Đã duyệt nội dung.' : 'Đã chuyển nội dung sang mục từ chối.');
}

function renderMonitor() {
  const monitorStatus = $('#monitorStatus');
  const monitorSource = $('#monitorSource');
  if (!monitorStatus || !monitorSource) return;

  const status = monitorStatus.value;
  const source = monitorSource.value;
  const list = state.monitor.filter((item) => (
    (status === 'all' || item.status === status) &&
    (source === 'all' || item.source === source)
  ));

  $('#monitorRows').innerHTML = list.map((item) => `
    <tr>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(item.source)}</td>
      <td>${item.date}<br><small>${item.time}</small></td>
      <td>${item.age} ngày</td>
      <td>${badge(item.status)}</td>
    </tr>
  `).join('');

  $('#monitorEmpty').classList.toggle('hidden', list.length !== 0);
  $('#monitorCount').textContent = `Hiển thị ${list.length ? 1 : 0} - ${list.length} trong ${state.monitor.length} nội dung`;
}

function bindSourceControls() {
  const dialog = $('#sourceDialog');
  const sourceForm = $('#sourceForm');
  const sourceFilterBtn = $('#sourceFilterBtn');

  $('#sourceSearch').addEventListener('input', renderSources);
  $('#sourceStatus').addEventListener('change', renderSources);
  $('#sourceType').addEventListener('change', renderSources);
  sourceFilterBtn.addEventListener('click', () => $('#sourceFilter').classList.toggle('hidden'));

  $('#addSourceBtn').addEventListener('click', () => dialog.showModal());
  $('#closeDialog').addEventListener('click', () => dialog.close());
  $('#cancelDialog').addEventListener('click', () => dialog.close());

  sourceForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = data.get('name').trim();
    const url = data.get('url').trim();

    if (state.sources.some((source) => source.name.toLowerCase() === name.toLowerCase())) {
      toast('Tên nguồn này đã tồn tại.');
      return;
    }

    state.sources.unshift({
      name,
      type: data.get('type'),
      url,
      status: data.get('status')
    });

    event.currentTarget.reset();
    dialog.close();
    renderSources();
    toast('Đã thêm nguồn mới vào danh sách demo.');
  });
}

function bindQueueControls() {
  $('#queueSearch').addEventListener('input', renderQueue);
  $$('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.activeQueueStatus = tab.dataset.status;
      $$('.tab').forEach((item) => item.classList.toggle('active', item === tab));
      renderQueue();
    });
  });

  $('#queueFilterBtn').addEventListener('click', () => {
    $('#queueSearch').focus();
    toast('Nhập từ khóa vào ô tìm kiếm để lọc nội dung.');
  });
}

function bindMonitorControls() {
  const refreshButton = $('#refreshMonitor');
  $('#monitorStatus').addEventListener('change', renderMonitor);
  $('#monitorSource').addEventListener('change', renderMonitor);
  $('#monitorPeriod').addEventListener('change', () => toast(`Đã chọn khoảng thời gian: ${$('#monitorPeriod').value}`));
  refreshButton.addEventListener('click', () => {
    renderMonitor();
    toast('Dữ liệu demo đã được làm mới.');
  });
}

function bindProfile() {
  const profileButton = $('#profileButton');
  if (profileButton) {
    profileButton.addEventListener('click', () => toast('Bạn đang đăng nhập với vai trò Editor (bản demo).'));
  }
}

async function initPage() {
  await loadData();

  const pageName = document.body.dataset.page;
  if (pageName === 'sources') bindSourceControls();
  if (pageName === 'queue') bindQueueControls();
  if (pageName === 'monitor') bindMonitorControls();

  bindProfile();

  if (pageName === 'sources') renderSources();
  if (pageName === 'queue') renderQueue();
  if (pageName === 'monitor') renderMonitor();
}

document.addEventListener('DOMContentLoaded', initPage);
