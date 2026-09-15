// public/js/notifications.js
// Small notification bell + dropdown, reused in every page's nav once a
// user is logged in. Call notifBellHtml() to get the markup and
// initNotifBell() after inserting it into the DOM.

function notifBellHtml() {
  return `
    <span class="notif-wrap">
      <button class="notif-bell" id="notif-bell" aria-label="Notifications" title="Notifications">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <span class="notif-dot" id="notif-dot" style="display:none;"></span>
      </button>
      <div class="notif-panel" id="notif-panel">
        <div class="notif-panel-head">
          <strong class="small">Notifications</strong>
          <a href="#" id="notif-mark-all" class="small">Mark all read</a>
        </div>
        <div id="notif-list"><div class="notif-empty">Loading…</div></div>
      </div>
    </span>
  `;
}

function initNotifBell() {
  const bell = document.getElementById('notif-bell');
  const panel = document.getElementById('notif-panel');
  const dot = document.getElementById('notif-dot');
  const list = document.getElementById('notif-list');
  const markAll = document.getElementById('notif-mark-all');
  if (!bell) return;

  async function refresh() {
    try {
      const data = await api.get('/notifications');
      dot.style.display = data.unread > 0 ? 'block' : 'none';
      if (!data.notifications.length) {
        list.innerHTML = `<div class="notif-empty">Nothing yet — you'll see updates on matches and claims here.</div>`;
        return;
      }
      list.innerHTML = data.notifications.map((n) => `
        <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
          <a href="${n.link || '#'}">${escapeHtml(n.message)}</a>
          <div class="notif-time">${timeAgo(n.created_at)}</div>
        </div>
      `).join('');
    } catch (err) {
      list.innerHTML = `<div class="notif-empty">Couldn't load notifications.</div>`;
    }
  }

  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) refresh();
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== bell) panel.classList.remove('open');
  });

  markAll.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await api.patch('/notifications/read-all', {});
      refresh();
    } catch {}
  });

  // Light polling so the dot updates even if the user doesn't open the panel.
  async function pollCount() {
    try {
      const data = await api.get('/notifications');
      dot.style.display = data.unread > 0 ? 'block' : 'none';
    } catch {}
  }
  pollCount();
  setInterval(pollCount, 30000);
}
