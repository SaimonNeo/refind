// public/js/api.js
// Small fetch wrapper shared by every page.

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('refind_token');
}

function setSession(token, user) {
  localStorage.setItem('refind_token', token);
  localStorage.setItem('refind_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('refind_token');
  localStorage.removeItem('refind_user');
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('refind_user'));
  } catch {
    return null;
  }
}

async function apiRequest(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm && body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
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
  get: (path) => apiRequest(path),
  post: (path, body, isForm) => apiRequest(path, { method: 'POST', body, isForm }),
  patch: (path, body) => apiRequest(path, { method: 'PATCH', body }),
  del: (path) => apiRequest(path, { method: 'DELETE' }),
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
