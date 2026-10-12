const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  queue: [],
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

async function loadQueue() {
  const api = window.LegalPathAPI || {};
  state.queue = api.getQueue ? (await api.getQueue()) || [] : [];

  if (state.queue.length) {
    const firstPendingIndex = state.queue.findIndex((item) => item.status === 'Chờ duyệt');
    state.selectedQueueIndex = firstPendingIndex >= 0 ? firstPendingIndex : 0;
  }
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

function bindProfile() {
  const profileButton = $('#profileButton');
  if (profileButton) {
    profileButton.addEventListener('click', () => toast('Bạn đang đăng nhập với vai trò Editor (bản demo).'));
  }
}

async function initPage() {
  await loadQueue();
  bindQueueControls();
  bindProfile();
  renderQueue();
}

document.addEventListener('DOMContentLoaded', initPage);
