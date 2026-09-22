// public/js/campus-map.js
// Interactive SVG Campus Map for ReFind
// Displays campus buildings, active lost/found badges, and handles selection.

const CAMPUS_BUILDINGS = [
  {
    id: 'central-library',
    name: 'Central Library',
    code: 'LIB',
    x: 350, y: 40, w: 200, h: 100,
    labelX: 450, labelY: 95,
    badgeX: 450, badgeY: 55,
    desc: 'Main campus library, study halls, and reference archives.',
  },
  {
    id: 'academic-building',
    name: 'Academic Building',
    code: 'ACAD',
    x: 80, y: 160, w: 200, h: 110,
    labelX: 180, labelY: 220,
    badgeX: 180, badgeY: 175,
    desc: 'Lecture halls, faculty offices, and seminar rooms.',
  },
  {
    id: 'computer-science-building',
    name: 'Computer Science Building',
    code: 'CS',
    x: 620, y: 160, w: 200, h: 110,
    labelX: 720, labelY: 220,
    badgeX: 720, badgeY: 175,
    desc: 'Software labs, server rooms, and robotics workshop.',
  },
  {
    id: 'auditorium',
    name: 'Auditorium',
    code: 'AUD',
    x: 360, y: 220, w: 180, h: 100,
    labelX: 450, labelY: 275,
    badgeX: 450, badgeY: 235,
    desc: 'Main theater, performance hall, and convocation center.',
  },
  {
    id: 'laboratory',
    name: 'Laboratory',
    code: 'LAB',
    x: 620, y: 340, w: 190, h: 105,
    labelX: 715, labelY: 400,
    badgeX: 715, badgeY: 355,
    desc: 'Chemistry, Physics, and Bioengineering research labs.',
  },
  {
    id: 'cafeteria',
    name: 'Cafeteria',
    code: 'CAFE',
    x: 90, y: 360, w: 190, h: 105,
    labelX: 185, labelY: 420,
    badgeX: 185, badgeY: 375,
    desc: 'Campus food court, coffee bar, and dining patio.',
  },
  {
    id: 'student-center',
    name: 'Student Center',
    code: 'STU',
    x: 350, y: 400, w: 200, h: 105,
    labelX: 450, labelY: 460,
    badgeX: 450, badgeY: 415,
    desc: 'Clubs headquarters, recreation lounge, and campus store.',
  },
  {
    id: 'main-gate',
    name: 'Main Gate',
    code: 'GATE',
    x: 340, y: 555, w: 220, h: 65,
    labelX: 450, labelY: 595,
    badgeX: 450, badgeY: 565,
    desc: 'Campus entrance security checkpoint and visitor intake desk.',
  },
];

class CampusMap {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.options = Object.assign({
      mode: 'explorer', // 'explorer' | 'picker'
      initialLocation: '',
      onSelect: null,
    }, options);
    this.selectedBuilding = null;
    this.stats = {};
    this.init();
  }

  async init() {
    this.renderSkeleton();
    await this.loadStats();
    if (this.options.initialLocation) {
      this.selectBuildingByName(this.options.initialLocation, false);
    }
  }

  async loadStats() {
    try {
      const res = await fetch('/api/items/stats/by-location');
      const data = await res.json();
      this.stats = data.stats || {};
      this.updateBadges();
    } catch (err) {
      console.warn('[CampusMap] Could not fetch location stats:', err);
    }
  }

  renderSkeleton() {
    this.container.innerHTML = `
      <div class="campus-map-wrapper">
        <div class="campus-map-header">
          <div class="campus-map-legend">
            <span class="legend-item"><span class="legend-dot dot-lost"></span> Lost Reports</span>
            <span class="legend-item"><span class="legend-dot dot-found"></span> Found Reports</span>
            <span class="legend-item"><span class="legend-box"></span> Buildings</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="campus-map-hint">
              ${this.options.mode === 'picker' ? 'Click a building on the map to set your location' : 'Click any building to filter items'}
            </div>
            <button type="button" class="btn btn-outline btn-sm map-clear-btn" id="map-clear-btn" style="padding:2px 8px; font-size:0.78rem; display:none;">✕ Clear Filter</button>
          </div>
        </div>
        <div class="campus-map-svg-wrap">
          <svg viewBox="0 0 900 650" class="campus-map-svg" preserveAspectRatio="xMidYMid meet">
            <defs>
              <filter id="map-shadow" x="-5%" y="-5%" width="110%" height="115%">
                <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#262220" flood-opacity="0.12" />
              </filter>
              <filter id="map-hover-shadow" x="-8%" y="-8%" width="116%" height="120%">
                <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#a8542f" flood-opacity="0.25" />
              </filter>
              <pattern id="campus-grass" width="24" height="24" patternUnits="userSpaceOnUse">
                <rect width="24" height="24" fill="#ebe4d4" />
                <circle cx="12" cy="12" r="1.5" fill="#dfd6c3" />
              </pattern>
            </defs>

            <!-- Background & Grounds -->
            <rect width="900" height="650" fill="url(#campus-grass)" rx="8" />

            <!-- Walkways and Roads -->
            <!-- Main vertical spine -->
            <path d="M 450 620 L 450 140 M 180 215 L 720 215 M 180 410 L 720 410" stroke="#dfd5c0" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <!-- Inner crossways -->
            <path d="M 180 215 L 450 270 L 720 215 M 180 410 L 450 270 L 720 410" stroke="#e8dfce" stroke-width="14" fill="none" />
            <path d="M 450 555 L 450 140" stroke="#fdfbf7" stroke-width="8" stroke-dasharray="6,6" stroke-linecap="round" fill="none" />

            <!-- Central Campus Fountain / Plaza -->
            <circle cx="450" cy="345" r="32" fill="#d4c9b3" stroke="#b5a790" stroke-width="2" />
            <circle cx="450" cy="345" r="20" fill="#9db7a2" stroke="#ffffff" stroke-width="2" />
            <circle cx="450" cy="345" r="6" fill="#ffffff" />

            <!-- Trees & Campus greenery decorations -->
            <g class="campus-trees" fill="#698565" opacity="0.85">
              <circle cx="320" cy="170" r="10" /><circle cx="580" cy="170" r="10" />
              <circle cx="310" cy="345" r="12" /><circle cx="590" cy="345" r="12" />
              <circle cx="320" cy="510" r="11" /><circle cx="580" cy="510" r="11" />
              <circle cx="200" cy="300" r="9" /><circle cx="700" cy="290" r="9" />
              <circle cx="210" cy="110" r="10" /><circle cx="690" cy="110" r="10" />
            </g>

            <!-- Buildings Layer -->
            <g id="buildings-layer">
              ${CAMPUS_BUILDINGS.map(b => this.renderBuildingSvg(b)).join('')}
            </g>
          </svg>
        </div>
        <div id="map-selection-banner" class="map-selection-banner" style="display:none;"></div>
      </div>
    `;

    this.attachEvents();
  }

  renderBuildingSvg(b) {
    return `
      <g class="campus-building" id="building-${b.id}" data-name="${b.name}" data-id="${b.id}" tabindex="0" role="button" aria-label="${b.name}">
        <!-- Building Shadow & Shape -->
        <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6" class="bldg-base" filter="url(#map-shadow)" />
        <rect x="${b.x + 3}" y="${b.y + 3}" width="${b.w - 6}" height="${b.h - 6}" rx="4" class="bldg-roof" />
        
        <!-- Architectural roof detail line -->
        <line x1="${b.x + 12}" y1="${b.y + b.h / 2}" x2="${b.x + b.w - 12}" y2="${b.y + b.h / 2}" stroke="#dfd4bf" stroke-width="1.5" stroke-dasharray="4,4" />

        <!-- Building Code Badge -->
        <rect x="${b.labelX - 22}" y="${b.labelY - 26}" width="44" height="15" rx="3" class="bldg-code-tag" />
        <text x="${b.labelX}" y="${b.labelY - 15}" class="bldg-code-text" text-anchor="middle">${b.code}</text>

        <!-- Building Name -->
        <text x="${b.labelX}" y="${b.labelY + 8}" class="bldg-title" text-anchor="middle">${b.name}</text>

        <!-- Dynamic Counter Badges Container -->
        <g id="badge-${b.id}" class="bldg-badge-group">
          <!-- Will be filled by updateBadges() -->
        </g>
      </g>
    `;
  }

  attachEvents() {
    const buildingEls = this.container.querySelectorAll('.campus-building');
    buildingEls.forEach(el => {
      const id = el.getAttribute('data-id');
      const bldg = CAMPUS_BUILDINGS.find(b => b.id === id);
      if (!bldg) return;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectBuilding(bldg, true);
      });

      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.selectBuilding(bldg, true);
        }
      });
    });

    const clearBtn = this.container.querySelector('#map-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearSelection();
        if (this.options.onSelect) this.options.onSelect('');
      });
    }
  }

  updateBadges() {
    CAMPUS_BUILDINGS.forEach(b => {
      const group = this.container.querySelector(`#badge-${b.id}`);
      if (!group) return;

      const stat = this.stats[b.name.toLowerCase()] || { lost: 0, found: 0, total: 0 };
      const lost = stat.lost || 0;
      const found = stat.found || 0;

      if (lost === 0 && found === 0) {
        group.innerHTML = `
          <rect x="${b.badgeX - 32}" y="${b.badgeY - 11}" width="64" height="18" rx="9" fill="#ece5d6" stroke="#cfc5b0" stroke-width="1" />
          <text x="${b.badgeX}" y="${b.badgeY + 2}" class="badge-count-text" fill="#847a6d" text-anchor="middle">No items</text>
        `;
        return;
      }

      // If we have both or either
      let content = '';
      if (lost > 0 && found > 0) {
        content = `
          <g transform="translate(${b.badgeX - 44}, ${b.badgeY - 11})">
            <rect x="0" y="0" width="40" height="18" rx="9" fill="#a8542f" />
            <text x="20" y="13" class="badge-count-text" fill="#ffffff" text-anchor="middle">🔴 ${lost}</text>
            <rect x="46" y="0" width="40" height="18" rx="9" fill="#46654a" />
            <text x="66" y="13" class="badge-count-text" fill="#ffffff" text-anchor="middle">🟢 ${found}</text>
          </g>
        `;
      } else if (lost > 0) {
        content = `
          <g transform="translate(${b.badgeX - 28}, ${b.badgeY - 11})">
            <rect x="0" y="0" width="56" height="18" rx="9" fill="#a8542f" />
            <text x="28" y="13" class="badge-count-text" fill="#ffffff" text-anchor="middle">🔴 ${lost} Lost</text>
          </g>
        `;
      } else {
        content = `
          <g transform="translate(${b.badgeX - 32}, ${b.badgeY - 11})">
            <rect x="0" y="0" width="64" height="18" rx="9" fill="#46654a" />
            <text x="32" y="13" class="badge-count-text" fill="#ffffff" text-anchor="middle">🟢 ${found} Found</text>
          </g>
        `;
      }
      group.innerHTML = content;
    });
  }

  selectBuilding(bldg, triggerCallback = true) {
    this.selectedBuilding = bldg;
    const allEls = this.container.querySelectorAll('.campus-building');
    allEls.forEach(el => el.classList.remove('selected'));

    const activeEl = this.container.querySelector(`#building-${bldg.id}`);
    if (activeEl) activeEl.classList.add('selected');

    const clearBtn = this.container.querySelector('#map-clear-btn');
    if (clearBtn) clearBtn.style.display = 'inline-flex';

    // Update banner
    const banner = this.container.querySelector('#map-selection-banner');
    if (banner) {
      const stat = this.stats[bldg.name.toLowerCase()] || { lost: 0, found: 0, total: 0 };
      banner.style.display = 'flex';
      banner.innerHTML = `
        <div class="banner-info">
          <strong>📍 ${bldg.name} (${bldg.code})</strong>
          <span class="small muted">${bldg.desc}</span>
        </div>
        <div class="banner-stats">
          <span class="badge badge-lost">${stat.lost || 0} Lost</span>
          <span class="badge badge-found">${stat.found || 0} Found</span>
          ${this.options.mode === 'explorer' ? `<button type="button" class="btn btn-outline btn-sm" id="confirm-loc-btn">Filter reports for ${typeof escapeHtml === 'function' ? escapeHtml(bldg.name) : bldg.name} →</button>` : `<button type="button" class="btn btn-primary btn-sm" id="confirm-loc-btn">Select this location</button>`}
        </div>
      `;

      const btn = banner.querySelector('#confirm-loc-btn');
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.options.onSelect) this.options.onSelect(bldg.name);
        });
      }
    }

    if (triggerCallback && this.options.onSelect) {
      this.options.onSelect(bldg.name);
    }
  }

  selectBuildingByName(name, triggerCallback = false) {
    if (!name) {
      this.clearSelection();
      return;
    }
    const norm = name.trim().toLowerCase();
    const bldg = CAMPUS_BUILDINGS.find(b => b.name.toLowerCase() === norm);
    if (bldg) {
      this.selectBuilding(bldg, triggerCallback);
    } else {
      this.clearSelection();
    }
  }

  clearSelection() {
    this.selectedBuilding = null;
    this.container.querySelectorAll('.campus-building').forEach(el => el.classList.remove('selected'));
    const banner = this.container.querySelector('#map-selection-banner');
    if (banner) banner.style.display = 'none';
    const clearBtn = this.container.querySelector('#map-clear-btn');
    if (clearBtn) clearBtn.style.display = 'none';
  }
}

// Inject CSS styles for the Campus Map once
(function injectCampusMapStyles() {
  if (document.getElementById('campus-map-styles')) return;
  const style = document.createElement('style');
  style.id = 'campus-map-styles';
  style.textContent = `
    .campus-map-wrapper {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 16px;
      box-shadow: var(--shadow);
    }
    .campus-map-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      flex-wrap: wrap;
      gap: 10px;
    }
    .campus-map-legend {
      display: flex;
      align-items: center;
      gap: 14px;
      font-size: 0.85rem;
      color: var(--ink-soft);
    }
    .legend-item { display: inline-flex; align-items: center; gap: 5px; }
    .legend-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
    .dot-lost { background: var(--clay); }
    .dot-found { background: var(--moss); }
    .legend-box { width: 11px; height: 11px; background: #fffdf9; border: 1.5px solid #a4967f; border-radius: 2px; }
    .campus-map-hint { font-size: 0.84rem; color: var(--ink-soft); font-style: italic; }
    
    .campus-map-svg-wrap {
      width: 100%;
      overflow: hidden;
      border-radius: 4px;
      border: 1px solid #dcd4c0;
      background: #eae3d2;
    }
    .campus-map-svg {
      width: 100%;
      height: auto;
      display: block;
    }

    /* Building styling */
    .campus-building {
      cursor: pointer;
      outline: none;
      transition: transform 0.15s ease, filter 0.15s ease;
    }
    .campus-building .bldg-base {
      fill: #fffefb;
      stroke: #baa991;
      stroke-width: 2;
      transition: fill 0.15s, stroke 0.15s;
    }
    .campus-building .bldg-roof {
      fill: #faf6ed;
      stroke: #dfd5bf;
      stroke-width: 1;
    }
    .campus-building .bldg-code-tag {
      fill: #eae2cf;
      stroke: #cfc4ac;
      stroke-width: 0.8;
    }
    .campus-building .bldg-code-text {
      font-family: var(--font-num);
      font-size: 10px;
      font-weight: 600;
      fill: #5a5043;
    }
    .campus-building .bldg-title {
      font-family: var(--font-display);
      font-size: 14.5px;
      font-weight: 600;
      fill: #262220;
    }
    .badge-count-text {
      font-family: var(--font-num);
      font-size: 10.5px;
      font-weight: 700;
    }

    /* Hover & Active States */
    .campus-building:hover .bldg-base,
    .campus-building:focus-visible .bldg-base {
      fill: #fffdf4;
      stroke: var(--clay);
      stroke-width: 2.5;
      filter: url(#map-hover-shadow);
    }
    .campus-building:hover .bldg-roof {
      fill: #fdf3e6;
    }
    .campus-building:hover .bldg-title {
      fill: var(--clay-deep);
    }

    .campus-building.selected .bldg-base {
      fill: #fbf0e6;
      stroke: var(--clay);
      stroke-width: 3;
    }
    .campus-building.selected .bldg-roof {
      fill: #f7e6d7;
    }
    .campus-building.selected .bldg-code-tag {
      fill: var(--clay);
      stroke: var(--clay-deep);
    }
    .campus-building.selected .bldg-code-text {
      fill: #ffffff;
    }

    /* Selection Banner */
    .map-selection-banner {
      margin-top: 14px;
      padding: 12px 18px;
      background: #fbf8f0;
      border: 1px solid var(--line);
      border-left: 4px solid var(--clay);
      border-radius: var(--radius);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .banner-info {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .banner-stats {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    [data-theme="dark"] .map-selection-banner {
      background: #25211c;
      border-color: var(--line);
      border-left-color: var(--clay);
    }

    /* Mobile Responsive Optimizations */
    @media (max-width: 640px) {
      .campus-map-wrapper {
        padding: 12px 10px;
      }
      .campus-map-header {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }
      .campus-map-legend {
        flex-wrap: wrap;
        gap: 10px;
        font-size: 0.8rem;
        justify-content: flex-start;
      }
      .campus-map-hint {
        font-size: 0.8rem;
      }
      .map-selection-banner {
        flex-direction: column;
        align-items: stretch;
        padding: 12px 14px;
        gap: 10px;
      }
      .banner-info {
        width: 100%;
      }
      .banner-stats {
        width: 100%;
        flex-wrap: wrap;
        justify-content: space-between;
      }
      .banner-stats .btn {
        width: 100%;
        justify-content: center;
        min-height: 42px;
        margin-top: 4px;
      }
    }
  `;
  document.head.appendChild(style);
})();
