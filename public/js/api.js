// public/js/api.js
// Small fetch wrapper shared by every page.

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('refind_token');
}

function setSession(token, user, isLogin = false) {
  const previousToken = localStorage.getItem('refind_token');
  localStorage.setItem('refind_token', token);
  localStorage.setItem('refind_user', JSON.stringify(user));
  if (isLogin || (token && token !== previousToken)) {
    sessionStorage.setItem('refind_just_logged_in', 'true');
    sessionStorage.removeItem('refind_pre_notif_played');
  }
}

function clearSession() {
  localStorage.removeItem('refind_token');
  localStorage.removeItem('refind_user');
  sessionStorage.removeItem('refind_just_logged_in');
  sessionStorage.removeItem('refind_pre_notif_played');
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('refind_user'));
  } catch {
    return null;
  }
}

async function apiRequest(path, { method = 'GET', body, isForm = false, keepalive = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm && body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
    keepalive,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no body
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

const api = {
  get: (path, opts) => apiRequest(path, { method: 'GET', ...opts }),
  post: (path, body, isForm, opts) => apiRequest(path, { method: 'POST', body, isForm, ...opts }),
  patch: (path, body, isFormOrOpts, opts) => {
    const isForm = typeof isFormOrOpts === 'boolean' ? isFormOrOpts : false;
    const extra = typeof isFormOrOpts === 'object' ? isFormOrOpts : (opts || {});
    return apiRequest(path, { method: 'PATCH', body, isForm, ...extra });
  },
  del: (path, opts) => apiRequest(path, { method: 'DELETE', ...opts }),
};

function requireLogin(redirectTo = '/login.html') {
  if (!getToken()) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

function requireAdmin() {
  const user = getUser();
  if (!getToken() || !user || user.role !== 'admin') {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

function logout() {
  clearSession();
  window.location.href = '/index.html';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function timeAgo(dateStr) {
  const date = new Date(dateStr.replace(' ', 'T') + 'Z');
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

// Ensure global availability on window
window.api = api;
window.getToken = getToken;
window.setSession = setSession;
window.clearSession = clearSession;
window.getUser = getUser;
window.apiRequest = apiRequest;
window.requireLogin = requireLogin;
window.requireAdmin = requireAdmin;
window.logout = logout;
window.escapeHtml = escapeHtml;
window.timeAgo = timeAgo;

