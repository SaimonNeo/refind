// public/js/notifications.js
// Enhanced notification center: category badges, "All" vs "Unread" tabs,
// inline delete/clear actions, audio chime, and real-time floating toast notifications.

const NOTIF_SOUND_ON_SVG = `<svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
const NOTIF_SOUND_OFF_SVG = `<svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;

function notifBellHtml() {
  return `
    <span class="notif-wrap">
      <button class="notif-bell" id="notif-bell" aria-label="Notifications" title="Notifications">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <span class="notif-dot" id="notif-dot" style="display:none;" aria-live="polite"></span>
      </button>
      <div class="notif-panel" id="notif-panel">
        <div class="notif-panel-head">
          <span class="notif-panel-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            Notifications
          </span>
          <div class="notif-panel-actions">
            <button type="button" class="notif-sound-btn" id="notif-sound-btn" title="Toggle notification sound" aria-label="Toggle notification sound">${NOTIF_SOUND_ON_SVG}</button>
            <span style="color:var(--line); font-size: 0.72rem;">•</span>
            <a href="#" id="notif-mark-all" title="Mark all notifications as read">Mark read</a>
            <span style="color:var(--line); font-size: 0.72rem;">•</span>
            <a href="#" id="notif-clear-all" title="Clear all notifications">Clear all</a>
          </div>
        </div>
        <div class="notif-tabs" id="notif-tabs">
          <button class="notif-tab active" data-tab="all" id="notif-tab-all">All <span class="notif-tab-badge" id="notif-count-all">0</span></button>
          <button class="notif-tab" data-tab="unread" id="notif-tab-unread">Unread <span class="notif-tab-badge" id="notif-count-unread">0</span></button>
        </div>
        <div class="notif-list-container">
          <div id="notif-list"><div class="notif-empty"><div class="notif-empty-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div>Loading…</div></div></div>
        </div>
      </div>
    </span>
  `;
}

function getNotificationMeta(type) {
  switch (type) {
    case 'match':
      return {
        icon: `<svg class="ui-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
        iconClass: 'type-match',
        tagClass: 'tag-match',
        label: 'Match Found'
      };
    case 'claim_status':
    case 'claim':
      return {
        icon: `<svg class="ui-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
        iconClass: 'type-claim',
        tagClass: 'tag-claim',
        label: 'Claim Update'
      };
    case 'recovery':
      return {
        icon: `<svg class="ui-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
        iconClass: 'type-recovery',
        tagClass: 'tag-recovery',
        label: 'Recovered'
      };
    case 'admin_decision':
      return {
        icon: `<svg class="ui-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
        iconClass: 'type-admin',
        tagClass: 'tag-admin',
        label: 'Admin Notice'
      };
    default:
      return {
        icon: `<svg class="ui-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
        iconClass: 'type-default',
        tagClass: 'tag-default',
        label: 'Notice'
      };
  }
}

// Notification sound preference & gentle pleasant audio chime on new notification arrival
function isNotificationSoundEnabled() {
  return localStorage.getItem('refind_notif_sound') !== 'muted';
}

function playNotificationChime() {
  if (!isNotificationSoundEnabled()) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    let played = false;
    const playNotes = () => {
      if (played) return;
      if (!isNotificationSoundEnabled()) return;
      played = true;
      try {
        const now = ctx.currentTime;
        
        // Note 1: D5
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now);
        gain1.gain.setValueAtTime(0.06, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.22);

        // Note 2: A5
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.1);
        gain2.gain.setValueAtTime(0.06, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.1);
        osc2.stop(now + 0.4);
      } catch {}
    };

    if (ctx.state === 'suspended') {
      const unlockAudio = () => {
        ['click', 'keydown', 'touchstart'].forEach((evt) =>
          document.removeEventListener(evt, unlockAudio, true)
        );
        ctx.resume().then(() => playNotes()).catch(() => {});
      };
      ['click', 'keydown', 'touchstart'].forEach((evt) =>
        document.addEventListener(evt, unlockAudio, { once: true, capture: true })
      );
      ctx.resume().then(() => {
        if (ctx.state === 'running') {
          ['click', 'keydown', 'touchstart'].forEach((evt) =>
            document.removeEventListener(evt, unlockAudio, true)
          );
          playNotes();
        }
      }).catch(() => {});
    } else {
      playNotes();
    }
  } catch {
    // Non-fatal if audio context blocked before first user gesture
  }
}

function getOrCreateToastContainer() {
  let container = document.getElementById('notif-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notif-toast-container';
    container.className = 'notif-toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  return container;
}

function showNotificationToast(notification) {
  const container = getOrCreateToastContainer();
  const meta = getNotificationMeta(notification.type);
  const toast = document.createElement('div');
  toast.className = 'notif-toast';
  toast.setAttribute('role', 'alert');

  const escapeFn = (typeof escapeHtml === 'function') ? escapeHtml : (s) => (s ?? '');

  toast.innerHTML = `
    <div class="notif-toast-icon ${meta.iconClass}">
      ${meta.icon}
    </div>
    <div class="notif-toast-content">
      <div class="notif-toast-head">
        <span class="notif-toast-title">${escapeFn(meta.label)}</span>
        <button class="notif-toast-close" aria-label="Close notification">&times;</button>
      </div>
      <div class="notif-toast-body">${escapeFn(notification.message)}</div>
    </div>
  `;

  function dismiss() {
    if (toast._dismissed) return;
    toast._dismissed = true;
    if (toast._timer) clearTimeout(toast._timer);
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 360);
  }

  toast.addEventListener('click', (e) => {
    if (e.target.closest('.notif-toast-close')) {
      e.stopPropagation();
      dismiss();
      return;
    }
    dismiss();
    if (notification.link && notification.link !== '#') {
      window.location.href = notification.link;
    }
  });

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  playNotificationChime();

  toast._timer = setTimeout(dismiss, 5500);
}

function initNotifBell() {
  const bell = document.getElementById('notif-bell');
  const panel = document.getElementById('notif-panel');
  const dot = document.getElementById('notif-dot');
  const list = document.getElementById('notif-list');
  const markAll = document.getElementById('notif-mark-all');
  const clearAll = document.getElementById('notif-clear-all');
  const tabAllBtn = document.getElementById('notif-tab-all');
  const tabUnreadBtn = document.getElementById('notif-tab-unread');
  const countAllEl = document.getElementById('notif-count-all');
  const countUnreadEl = document.getElementById('notif-count-unread');
  const soundBtn = document.getElementById('notif-sound-btn');

  if (!bell) return;

  // Prevent duplicate initialization on the same DOM element
  if (bell.dataset.notifInitialized === 'true') return;
  bell.dataset.notifInitialized = 'true';

  let currentTab = 'all'; // 'all' | 'unread'
  let cachedNotifications = [];
  let knownNotificationIds = null;
  let lastActionSeq = 0;
  let requestSeq = 0;

  function getAuthToken() {
    return (typeof getToken === 'function' ? getToken() : null) || localStorage.getItem('refind_token');
  }

  function escapeText(str) {
    if (typeof escapeHtml === 'function') return escapeHtml(str);
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function formatTime(dateStr) {
    if (typeof timeAgo === 'function') return timeAgo(dateStr);
    return dateStr || '';
  }

  function updateBadge(count) {
    if (!dot) return;
    const num = parseInt(count, 10) || 0;
    if (num > 0) {
      const displayCount = num > 99 ? '99+' : String(num);
      dot.textContent = displayCount;
      dot.style.display = 'inline-flex';
      dot.setAttribute('aria-label', `${num} unread notifications`);
      dot.title = `${num} unread notification${num === 1 ? '' : 's'}`;
      bell.setAttribute('aria-label', `Notifications (${displayCount} unread)`);
      bell.title = `Notifications (${displayCount} unread)`;
    } else {
      dot.textContent = '';
      dot.style.display = 'none';
      dot.removeAttribute('aria-label');
      dot.removeAttribute('title');
      bell.setAttribute('aria-label', 'Notifications');
      bell.title = 'Notifications';
    }
  }

  function updateTabCounts(totalCount, unreadCount) {
    if (countAllEl) countAllEl.textContent = String(totalCount);
    if (countUnreadEl) countUnreadEl.textContent = String(unreadCount);
  }

  function renderList() {
    if (!list) return;

    const unreadOnly = (currentTab === 'unread');
    const items = unreadOnly ? cachedNotifications.filter((n) => !n.is_read) : cachedNotifications;

    const unreadCount = cachedNotifications.filter((n) => !n.is_read).length;
    updateTabCounts(cachedNotifications.length, unreadCount);

    if (!items.length) {
      if (unreadOnly) {
        list.innerHTML = `
          <div class="notif-empty">
            <div class="notif-empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--moss)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
            <div><strong>All caught up!</strong><br><span style="font-size:0.8rem;">No unread notifications right now.</span></div>
          </div>
        `;
      } else {
        list.innerHTML = `
          <div class="notif-empty">
            <div class="notif-empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></div>
            <div><strong>No notifications yet</strong><br><span style="font-size:0.8rem;">Updates on matches, claims, and handovers will appear here.</span></div>
          </div>
        `;
      }
      return;
    }

    list.innerHTML = items.map((n) => {
      const meta = getNotificationMeta(n.type);
      const isUnread = !n.is_read;
      const link = escapeText(n.link || '#');
      return `
        <div class="notif-item ${isUnread ? 'unread' : ''}" data-id="${n.id}" data-link="${link}">
          <div class="notif-icon-col">
            <div class="notif-type-icon ${meta.iconClass}">
              ${meta.icon}
            </div>
          </div>
          <div class="notif-body-col">
            <div class="notif-badge-row">
              <span class="notif-category-tag ${meta.tagClass}">${escapeText(meta.label)}</span>
              <span class="notif-time">${formatTime(n.created_at)}</span>
            </div>
            <div class="notif-message">
              <a href="${link}" class="notif-link" style="color:inherit; text-decoration:none;">${escapeText(n.message)}</a>
            </div>
          </div>
          <div class="notif-action-col">
            <button class="notif-delete-btn" data-id="${n.id}" title="Delete notification" aria-label="Delete notification">&times;</button>
            ${isUnread ? '<span class="notif-unread-pip" title="Unread"></span>' : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  async function fetchNotifications() {
    const token = getAuthToken();
    if (!token) return null;
    const seq = ++requestSeq;
    try {
      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (seq < lastActionSeq) return null;
      return data;
    } catch {
      return null;
    }
  }

  async function refresh() {
    const data = await fetchNotifications();
    if (!data) return;

    cachedNotifications = data.notifications || [];
    updateBadge(data.unread);
    renderList();

    // Initialize known IDs if first load
    if (knownNotificationIds === null) {
      knownNotificationIds = new Set(cachedNotifications.map(n => n.id));
    }
  }

  // Single Item Read
  async function markNotificationAsRead(id, itemEl) {
    if (!itemEl || !itemEl.classList.contains('unread')) return;
    const token = getAuthToken();
    if (!token) return;

    lastActionSeq = ++requestSeq;

    // Optimistically update in cache & DOM
    const notif = cachedNotifications.find(n => n.id === Number(id));
    if (notif) notif.is_read = 1;

    itemEl.classList.remove('unread');
    const pip = itemEl.querySelector('.notif-unread-pip');
    if (pip) pip.remove();

    const currentUnread = cachedNotifications.filter(n => !n.is_read).length;
    updateBadge(currentUnread);
    updateTabCounts(cachedNotifications.length, currentUnread);

    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        keepalive: true
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && typeof data.unread === 'number') {
          updateBadge(data.unread);
        }
      } else {
        if (notif) notif.is_read = 0;
        renderList();
      }
    } catch (err) {
      console.warn('Failed to mark notification as read:', err);
      if (notif) notif.is_read = 0;
      renderList();
    }
  }

  // Single Item Delete
  async function deleteNotification(id, itemEl) {
    const token = getAuthToken();
    if (!token) return;

    const nid = Number(id);
    const prevList = [...cachedNotifications];
    cachedNotifications = cachedNotifications.filter(n => n.id !== nid);

    // Animate removal
    if (itemEl) {
      itemEl.style.opacity = '0';
      itemEl.style.transform = 'translateX(20px)';
      itemEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      setTimeout(() => {
        renderList();
      }, 200);
    } else {
      renderList();
    }

    const currentUnread = cachedNotifications.filter(n => !n.is_read).length;
    updateBadge(currentUnread);

    try {
      const res = await fetch(`/api/notifications/${nid}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
        keepalive: true
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && typeof data.unread === 'number') {
          updateBadge(data.unread);
        }
      } else {
        cachedNotifications = prevList;
        renderList();
      }
    } catch (err) {
      console.warn('Failed to delete notification:', err);
      cachedNotifications = prevList;
      renderList();
    }
  }

  // Mark all read
  async function markAllAsRead() {
    const token = getAuthToken();
    if (!token) return;

    lastActionSeq = ++requestSeq;
    const prevList = cachedNotifications.map(n => ({ ...n }));
    cachedNotifications.forEach(n => { n.is_read = 1; });

    updateBadge(0);
    renderList();

    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        keepalive: true
      });

      if (!res.ok) {
        cachedNotifications = prevList;
        renderList();
      }
    } catch (err) {
      console.warn('Failed to mark all read:', err);
      cachedNotifications = prevList;
      renderList();
    }
  }

  // Clear all notifications
  async function clearAllNotifications() {
    const token = getAuthToken();
    if (!token) return;

    const prevList = [...cachedNotifications];
    cachedNotifications = [];

    updateBadge(0);
    renderList();

    try {
      const res = await fetch('/api/notifications/clear-all', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
        keepalive: true
      });

      if (!res.ok) {
        cachedNotifications = prevList;
        renderList();
      }
    } catch (err) {
      console.warn('Failed to clear all notifications:', err);
      cachedNotifications = prevList;
      renderList();
    }
  }

  // Tab switching event handlers
  if (tabAllBtn && tabUnreadBtn) {
    tabAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentTab = 'all';
      tabAllBtn.classList.add('active');
      tabUnreadBtn.classList.remove('active');
      renderList();
    });

    tabUnreadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentTab = 'unread';
      tabUnreadBtn.classList.add('active');
      tabAllBtn.classList.remove('active');
      renderList();
    });
  }

  // Bell toggle
  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      refresh();
    }
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== bell && !bell.contains(e.target)) {
      panel.classList.remove('open');
    }
  });

  if (markAll) {
    markAll.addEventListener('click', async (e) => {
      e.preventDefault();
      await markAllAsRead();
    });
  }

  if (clearAll) {
    clearAll.addEventListener('click', async (e) => {
      e.preventDefault();
      await clearAllNotifications();
    });
  }

  function updateSoundBtn() {
    if (!soundBtn) return;
    const enabled = isNotificationSoundEnabled();
    soundBtn.innerHTML = enabled ? NOTIF_SOUND_ON_SVG : NOTIF_SOUND_OFF_SVG;
    soundBtn.title = enabled ? 'Mute notification sound (Currently on)' : 'Unmute notification sound (Currently muted)';
    soundBtn.setAttribute('aria-label', enabled ? 'Mute notification sound' : 'Unmute notification sound');
  }

  updateSoundBtn();

  if (soundBtn) {
    soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const current = isNotificationSoundEnabled();
      if (current) {
        localStorage.setItem('refind_notif_sound', 'muted');
        updateSoundBtn();
        if (typeof toast === 'function') toast('Notification sound muted (Silent mode)');
      } else {
        localStorage.setItem('refind_notif_sound', 'enabled');
        updateSoundBtn();
        playNotificationChime();
        if (typeof toast === 'function') toast('Notification sound enabled');
      }
    });
  }

  // Delegated item click: handles individual delete and link navigation
  if (list) {
    list.addEventListener('click', async (e) => {
      // 1. Delete button click
      const deleteBtn = e.target.closest('.notif-delete-btn');
      if (deleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = deleteBtn.dataset.id;
        const itemEl = deleteBtn.closest('.notif-item');
        if (id) await deleteNotification(id, itemEl);
        return;
      }

      // 2. Notification item click
      const item = e.target.closest('.notif-item');
      if (!item) return;

      const notifId = item.dataset.id;
      const linkEl = item.querySelector('a');
      const href = item.dataset.link || (linkEl ? linkEl.getAttribute('href') : null);

      let markPromise = null;
      if (item.classList.contains('unread') && notifId) {
        markPromise = markNotificationAsRead(notifId, item);
      }

      // Modifier click (new tab)
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
        return;
      }

      if (!href || href === '#' || href.startsWith('javascript:')) {
        e.preventDefault();
        return;
      }

      e.preventDefault();
      if (markPromise) {
        try {
          await Promise.race([
            markPromise,
            new Promise((resolve) => setTimeout(resolve, 300))
          ]);
        } catch {}
      }
      window.location.href = href;
    });
  }

  // Active polling every 5 seconds + floating toast trigger
  async function poll() {
    const token = getAuthToken();
    if (!token) return;
    const data = await fetchNotifications();
    if (!data) return;

    const newNotifications = data.notifications || [];
    updateBadge(data.unread);

    // If we have an existing known IDs set, detect incoming notifications
    if (knownNotificationIds !== null) {
      const arrivingItems = newNotifications.filter(n => !knownNotificationIds.has(n.id));
      arrivingItems.forEach(n => {
        knownNotificationIds.add(n.id);
        // Display toast banner for new unread notifications
        if (!n.is_read) {
          showNotificationToast(n);
        }
      });
    } else {
      knownNotificationIds = new Set(newNotifications.map(n => n.id));
      const unreadPreItems = newNotifications.filter(n => !n.is_read);
      const isJustLoggedIn = sessionStorage.getItem('refind_just_logged_in') === 'true';
      const prePlayed = sessionStorage.getItem('refind_pre_notif_played') === 'true';

      if (unreadPreItems.length > 0 && (isJustLoggedIn || !prePlayed)) {
        sessionStorage.setItem('refind_pre_notif_played', 'true');
        sessionStorage.removeItem('refind_just_logged_in');
        try {
          showNotificationToast(unreadPreItems[0]);
        } catch {
          playNotificationChime();
        }
      }
    }

    cachedNotifications = newNotifications;

    // If dropdown panel is open, keep the list live so incoming notifications render immediately
    if (panel && panel.classList.contains('open')) {
      renderList();
    } else {
      const unreadCount = cachedNotifications.filter((n) => !n.is_read).length;
      updateTabCounts(cachedNotifications.length, unreadCount);
    }
  }

  poll();
  setInterval(poll, 5000);

  // Immediate poll on tab visibility change or window focus
  window.addEventListener('focus', poll);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) poll();
  });
}
