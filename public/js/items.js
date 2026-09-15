// public/js/items.js
// Shared constants + render helpers for item cards, used across pages.

const ITEM_CATEGORIES = [
  'electronics', 'bags', 'accessories', 'documents', 'cards',
  'clothing', 'jewelry', 'keys', 'other',
];

const CAMPUS_LOCATIONS = [
  'Central Library', 'Computer Science Building', 'Cafeteria', 'Auditorium',
  'Main Gate', 'Academic Building', 'Laboratory', 'Student Center',
];

function populateSelect(id, values) {
  const select = document.getElementById(id);
  if (!select) return;
  for (const v of values) {
    const opt = document.createElement('option');
    opt.value = v.toLowerCase ? v : v;
    opt.textContent = v.charAt(0).toUpperCase() + v.slice(1);
    select.appendChild(opt);
  }
}

function statusBadgeClass(status) {
  return {
    active: 'badge-active',
    matched: 'badge-matched',
    claimed: 'badge-claimed',
    resolved: 'badge-resolved',
  }[status] || 'badge-active';
}

function itemCardHtml(item) {
  const img = item.image
    ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}">`
    : `<span>No photo</span>`;
  return `
    <a href="/item.html?id=${item.id}" class="item-card">
      <div class="item-card-img">${img}</div>
      <div class="item-card-body">
        <div class="item-card-top">
          <span class="badge ${item.type === 'lost' ? 'badge-lost' : 'badge-found'}">${item.type.toUpperCase()}</span>
          <span class="badge ${statusBadgeClass(item.status)}">${item.status}</span>
        </div>
        <h3 class="item-card-title">${escapeHtml(item.title)}</h3>
        <div class="item-card-meta">
          <span>${escapeHtml(item.category)}</span>
          
          <span>${escapeHtml(item.location)}</span>
        </div>
        <div class="item-card-meta"><span>${timeAgo(item.created_at)}</span></div>
      </div>
    </a>
  `;
}

function skeletonCards(n = 6) {
  return Array.from({ length: n }).map(() => `
    <div class="item-card">
      <div class="item-card-img skeleton" style="border-radius:0;"></div>
      <div class="item-card-body">
        <div class="skeleton" style="height:14px; width:60%; border-radius:4px;"></div>
        <div class="skeleton" style="height:12px; width:40%; border-radius:4px;"></div>
      </div>
    </div>
  `).join('');
}
