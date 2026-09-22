// public/js/ui.js
// Small shared UI helpers: a confirm dialog (replacing window.confirm with
// something styled) and a toast for success messages.

function ensureModalRoot() {
  let root = document.getElementById('confirm-modal-root');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'confirm-modal-root';
  root.innerHTML = `
    <div class="modal-backdrop" id="confirm-backdrop">
      <div class="modal-box">
        <h3 id="confirm-title">Are you sure?</h3>
        <p id="confirm-body" class="small"></p>
        <div class="modal-actions">
          <button class="btn btn-ghost btn-sm" id="confirm-cancel">Cancel</button>
          <button class="btn btn-danger btn-sm" id="confirm-ok">Confirm</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

function confirmDialog({ title = 'Are you sure?', body = '', confirmLabel = 'Confirm', danger = true } = {}) {
  ensureModalRoot();
  const backdrop = document.getElementById('confirm-backdrop');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-body').textContent = body;
  const okBtn = document.getElementById('confirm-ok');
  okBtn.textContent = confirmLabel;
  okBtn.className = `btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`;

  return new Promise((resolve) => {
    function cleanup(result) {
      backdrop.classList.remove('open');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    const cancelBtn = document.getElementById('confirm-cancel');
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    backdrop.classList.add('open');
  });
}

function toast(message, kind = 'success') {
  let el = document.getElementById('toast-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast-root';
    el.style.cssText = 'position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:200; display:flex; flex-direction:column; gap:8px; align-items:center;';
    document.body.appendChild(el);
  }
  const item = document.createElement('div');
  item.className = `alert alert-${kind === 'error' ? 'error' : 'success'}`;
  item.style.cssText = 'margin:0; box-shadow: var(--shadow); min-width:220px; text-align:center;';
  item.textContent = message;
  el.appendChild(item);
  setTimeout(() => { item.style.opacity = '0'; item.style.transition = 'opacity 0.3s'; setTimeout(() => item.remove(), 300); }, 2600);
}

function formatWhatsAppUrl(rawPhone, message = '') {
  if (!rawPhone) return '';
  let clean = String(rawPhone).replace(/[^\d+]/g, '');
  if (clean.startsWith('+')) clean = clean.slice(1);
  if (!clean) return '';
  const textParam = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${clean}${textParam}`;
}

function whatsappButtonHtml(rawPhone, message = '', label = 'Chat on WhatsApp', btnClass = 'btn-sm') {
  const url = formatWhatsAppUrl(rawPhone, message);
  if (!url) return '';
  return `
    <a href="${url}" target="_blank" rel="noopener noreferrer" class="btn ${btnClass}" style="display:inline-flex; align-items:center; gap:6px; background:#25D366; color:#ffffff; border:none; text-decoration:none; font-weight:600; border-radius:var(--radius); padding:6px 12px;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
      <span>${label}</span>
    </a>
  `;
}

function renderUserAvatar(userOrAvatar, name = '', size = 'sm') {
  const avatar = typeof userOrAvatar === 'object' && userOrAvatar ? userOrAvatar.avatar : userOrAvatar;
  const userName = (typeof userOrAvatar === 'object' && userOrAvatar ? userOrAvatar.name : name) || '';
  const initial = userName.trim() ? userName.trim().charAt(0).toUpperCase() : '?';
  const esc = typeof escapeHtml === 'function' ? escapeHtml : (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  if (avatar) {
    return `<div class="user-avatar user-avatar-${size}"><img src="${esc(avatar)}" alt="${esc(userName)}'s DP"></div>`;
  }
  return `<div class="user-avatar user-avatar-${size}"><span>${esc(initial)}</span></div>`;
}

// --- Theme Manager (Dark / Light Mode) ---
function getStoredTheme() {
  const saved = localStorage.getItem('refind-theme');
  if (saved) return saved;
  return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('refind-theme', theme);
  updateThemeToggleIcons();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || getStoredTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  if (typeof toast === 'function') {
    toast(next === 'dark' ? '🌙 Nocturnal mode enabled' : '☀️ Light mode enabled');
  }
}

const THEME_ICONS = {
  sun: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`,
  moon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`
};

function updateThemeToggleIcons() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.innerHTML = isDark ? THEME_ICONS.sun : THEME_ICONS.moon;
    const label = isDark ? 'Switch to light mode' : 'Switch to nocturnal mode';
    btn.setAttribute('title', label);
    btn.setAttribute('aria-label', label);
  });
}

function themeToggleBtnHtml() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to nocturnal mode';
  return `
    <button type="button" class="theme-toggle-btn" onclick="toggleTheme()" title="${label}" aria-label="${label}">
      ${isDark ? THEME_ICONS.sun : THEME_ICONS.moon}
    </button>
  `;
}

// Immediate theme application on script evaluation (prevents FOUC)
(function initThemeNow() {
  const currentTheme = getStoredTheme();
  document.documentElement.setAttribute('data-theme', currentTheme);
})();

// Auto-mount toggle button on page navigation bars if not already present
function autoMountThemeToggle() {
  const navLinks = document.querySelector('.nav-links') || document.querySelector('.nav-inner');
  if (navLinks && !document.querySelector('.theme-toggle-btn')) {
    const wrap = document.createElement('span');
    wrap.className = 'theme-toggle-wrap';
    wrap.style.display = 'inline-flex';
    wrap.style.alignItems = 'center';
    wrap.innerHTML = themeToggleBtnHtml();
    navLinks.appendChild(wrap);
  }
  updateThemeToggleIcons();
}

// --- Admin Quick Access & 1-Click Navigation Manager ---
function autoMountAdminNav() {
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('refind_user'));
  } catch {}

  if (!user || user.role !== 'admin') return;

  const currentPath = window.location.pathname;
  const isAdminPage = currentPath.startsWith('/admin/');
  if (isAdminPage) {
    sessionStorage.setItem('refind_admin_last_page', window.location.pathname + window.location.search);
  }

  // --- Polished UI Vector Icons ---
  const UI_ICONS = {
    shield: `<svg class="ui-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    phone: `<svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    printer: `<svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
    receipt: `<svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    map: `<svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>`,
    grid: `<svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    bell: `<svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    chart: `<svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    package: `<svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    claims: `<svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    checkCircle: `<svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    users: `<svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    analytics: `<svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
    audit: `<svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 18h1"/><path d="M8 14h6"/></svg>`,
    filter: `<svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
  };

  // 1. Inject Admin / Student View badge in navbar if missing
  const navLinks = document.querySelector('.nav-links');
  if (navLinks) {
    if (!isAdminPage) {
      if (!navLinks.querySelector('a[href*="/admin/"]')) {
        const adminA = document.createElement('a');
        adminA.href = '/admin/dashboard.html';
        adminA.className = 'nav-admin-badge';
        adminA.innerHTML = `${UI_ICONS.shield} Admin Panel`;
        navLinks.insertBefore(adminA, navLinks.firstChild);
      }
    }
  }

  // 2. Persistent Floating Quick Dock (only on student/public pages so admin can quickly jump into Admin Panel)
  if (!document.getElementById('admin-floating-dock') && !isAdminPage) {
    const dock = document.createElement('div');
    dock.id = 'admin-floating-dock';
    dock.className = 'floating-admin-dock';

    dock.innerHTML = `
      <div class="floating-admin-menu" id="admin-quick-menu">
        <div style="padding:4px 8px; font-size:0.72rem; font-weight:700; color:var(--ink-soft); text-transform:uppercase; letter-spacing:0.04em;">Admin Shortcuts</div>
        <a href="/admin/dashboard.html">${UI_ICONS.chart} Overview</a>
        <a href="/admin/items.html">${UI_ICONS.package} All Items</a>
        <a href="/admin/claims.html">${UI_ICONS.claims} Claims</a>
        <a href="/admin/recovered.html">${UI_ICONS.checkCircle} Recovered</a>
        <a href="/admin/users.html">${UI_ICONS.users} Users</a>
        <a href="/admin/analytics.html">${UI_ICONS.analytics} Analytics</a>
        <a href="/admin/audit-log.html">${UI_ICONS.audit} Audit Log</a>
      </div>
      <div style="display:flex; gap:6px; align-items:center;">
        <button type="button" class="floating-admin-btn" id="admin-menu-toggle" style="padding:10px 12px;" title="Admin Shortcuts Menu">⋮</button>
        <a href="/admin/dashboard.html" class="floating-admin-btn" title="Open Admin Control Panel">
          <span>${UI_ICONS.shield} Admin Panel</span> ↗
        </a>
      </div>
    `;
    document.body.appendChild(dock);

    const toggleBtn = dock.querySelector('#admin-menu-toggle');
    const menu = dock.querySelector('#admin-quick-menu');
    if (toggleBtn && menu) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('open');
      });
      document.addEventListener('click', (e) => {
        if (!dock.contains(e.target)) menu.classList.remove('open');
      });
    }
  }
}

// Listen to system theme changes if user hasn't explicitly set preference
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('refind-theme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}

function initUiHelpers() {
  autoMountThemeToggle();
  autoMountAdminNav();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUiHelpers);
} else {
  initUiHelpers();
}
