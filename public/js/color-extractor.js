// public/js/color-extractor.js
// Client-Side Canvas Color & Palette Extractor for ReFind (Zero Cost)
// Analyzes uploaded item photos in real-time, extracts dominant colors,
// and auto-populates the Color field with clickable palette chips.

const COLOR_DEFINITIONS = [
  { name: 'Black', hex: '#1d1b19', isDark: true },
  { name: 'White', hex: '#fbfbfb', isLight: true },
  { name: 'Gray', hex: '#7a7f85' },
  { name: 'Silver', hex: '#c5cbcf' },
  { name: 'Blue', hex: '#2980b9' },
  { name: 'Navy', hex: '#1a2a44', isDark: true },
  { name: 'Light Blue', hex: '#7fc8f8' },
  { name: 'Red', hex: '#d93829' },
  { name: 'Maroon', hex: '#731717', isDark: true },
  { name: 'Green', hex: '#2e7d32' },
  { name: 'Olive', hex: '#556b2f' },
  { name: 'Brown', hex: '#6d4c41' },
  { name: 'Tan', hex: '#d2b48c' },
  { name: 'Yellow', hex: '#fbc02d' },
  { name: 'Gold', hex: '#c69214' },
  { name: 'Orange', hex: '#f57c00' },
  { name: 'Pink', hex: '#e91e63' },
  { name: 'Purple', hex: '#7b1fa2' },
];

function classifyRgb(r, g, b) {
  // Normalize RGB to 0..1
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;

  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const d = max - min;

  let l = (max + min) / 2;
  let s = 0;
  if (max !== min) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  }

  let h = 0;
  if (d !== 0) {
    if (max === rf) {
      h = ((gf - bf) / d + (gf < bf ? 6 : 0)) * 60;
    } else if (max === gf) {
      h = ((bf - rf) / d + 2) * 60;
    } else {
      h = ((rf - gf) / d + 4) * 60;
    }
  }

  // Achromatic checks (Lightness & Saturation)
  if (l < 0.16) return 'Black';
  if (l > 0.88 && s < 0.20) return 'White';
  if (s < 0.15) {
    return l > 0.62 ? 'Silver' : 'Gray';
  }

  // Chromatic checks based on Hue angle
  if (h < 15 || h >= 345) {
    return l < 0.38 ? 'Maroon' : (s > 0.6 && l > 0.65 ? 'Pink' : 'Red');
  }
  if (h >= 15 && h < 45) {
    return l < 0.45 ? 'Brown' : (l > 0.72 ? 'Tan' : 'Orange');
  }
  if (h >= 45 && h < 70) {
    return l < 0.52 ? 'Gold' : 'Yellow';
  }
  if (h >= 70 && h < 165) {
    return l < 0.35 ? 'Olive' : 'Green';
  }
  if (h >= 165 && h < 260) {
    if (l < 0.32) return 'Navy';
    if (l > 0.68) return 'Light Blue';
    return 'Blue';
  }
  if (h >= 260 && h < 315) {
    return 'Purple';
  }
  if (h >= 315 && h < 345) {
    return 'Pink';
  }

  return 'Gray';
}

function extractPaletteFromCanvas(img) {
  const canvas = document.createElement('canvas');
  const size = 50; // 50x50 = 2,500 samples (instant computation)
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size).data;
  const counts = {};

  let totalValidPixels = 0;
  for (let i = 0; i < imgData.length; i += 4) {
    const a = imgData[i + 3];
    if (a < 128) continue; // Skip transparent pixels
    const r = imgData[i];
    const g = imgData[i + 1];
    const b = imgData[i + 2];

    const colorName = classifyRgb(r, g, b);
    counts[colorName] = (counts[colorName] || 0) + 1;
    totalValidPixels++;
  }

  if (!totalValidPixels) return null;

  // Rank by frequency
  const sorted = Object.entries(counts)
    .map(([name, count]) => {
      const def = COLOR_DEFINITIONS.find(c => c.name === name) || { hex: '#777' };
      return {
        name,
        hex: def.hex,
        pct: Math.round((count / totalValidPixels) * 100),
      };
    })
    .sort((a, b) => b.pct - a.pct);

  // If top color is white and makes up < 65%, check if there's a strong chromatic object
  let dominant = sorted[0];
  if (dominant.name === 'White' && sorted.length > 1 && sorted[1].pct >= 15) {
    dominant = sorted[1];
  }

  return {
    dominant: dominant.name.toLowerCase(),
    palette: sorted.slice(0, 4),
  };
}

/**
 * Setup color extractor on a page's image input and preview.
 */
function initColorExtractor({ fileInputId, previewContainerId, colorInputId }) {
  const fileInput = document.getElementById(fileInputId);
  const previewBox = document.getElementById(previewContainerId);
  const colorInput = document.getElementById(colorInputId);
  if (!fileInput || !colorInput) return;

  // Container for detected swatches
  let swatchContainer = document.getElementById('auto-color-swatches');
  if (!swatchContainer) {
    swatchContainer = document.createElement('div');
    swatchContainer.id = 'auto-color-swatches';
    swatchContainer.style.cssText = 'margin-top: 10px; display: none; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 0.82rem;';
    if (previewBox) {
      previewBox.parentNode.insertBefore(swatchContainer, previewBox.nextSibling);
    } else {
      colorInput.parentNode.appendChild(swatchContainer);
    }
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file || !file.type.startsWith('image/')) {
      swatchContainer.style.display = 'none';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const result = extractPaletteFromCanvas(img);
        if (!result || !result.palette.length) return;

        // Auto-fill color input if currently empty or unmodified
        if (!colorInput.value || colorInput.dataset.autofilled === 'true') {
          colorInput.value = result.dominant;
          colorInput.dataset.autofilled = 'true';
        }

        // Render interactive palette chips
        swatchContainer.style.display = 'flex';
        swatchContainer.innerHTML = `
          <span style="color:var(--ink-soft); font-weight:600;">🎨 Auto-detected:</span>
          ${result.palette.map(p => {
            const isSelected = colorInput.value.toLowerCase() === p.name.toLowerCase();
            return `
              <button type="button" class="btn btn-ghost btn-xs color-chip-btn ${isSelected ? 'active' : ''}" data-color="${p.name.toLowerCase()}" style="display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:14px; border:1px solid ${isSelected ? 'var(--clay)' : 'var(--line)'}; background:${isSelected ? 'var(--card)' : '#fff'}; font-size:0.8rem; cursor:pointer;">
                <span style="width:11px; height:11px; border-radius:50%; background:${p.hex}; display:inline-block; border:1px solid rgba(0,0,0,0.15);"></span>
                <span>${p.name}</span>
                <span style="color:var(--ink-soft); font-size:0.72rem;">${p.pct}%</span>
              </button>
            `;
          }).join('')}
        `;

        // Click handler to select swatch
        swatchContainer.querySelectorAll('.color-chip-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const cName = btn.getAttribute('data-color');
            colorInput.value = cName;
            colorInput.dataset.autofilled = 'true';

            swatchContainer.querySelectorAll('.color-chip-btn').forEach(b => {
              b.style.borderColor = 'var(--line)';
              b.classList.remove('active');
            });
            btn.style.borderColor = 'var(--clay)';
            btn.classList.add('active');

            if (typeof toast === 'function') toast(`Color set to ${cName}`);
          });
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  colorInput.addEventListener('input', () => {
    // User typed manually
    delete colorInput.dataset.autofilled;
  });
}
