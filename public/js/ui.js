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
