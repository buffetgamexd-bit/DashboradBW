/* ============================================
   Cronograma Jurídico — App Logic
   CRUD completo con Supabase
   ============================================ */

// ——— SUPABASE INIT ———
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ——— STATE ———
let clientes = [];
let activePicker = null; // { clienteId, field, element }
let defaultResponsables = ['Jesus', 'Alonso', 'Fabiola'];
let currentUser = null;
let currentOpenClienteId = null;

// ——— STAGE DEFINITIONS ———
const STAGES = [
  { key: 'e1', label: 'E1', hasMonto: true },
  { key: 'e2', label: 'E2', hasMonto: true, hasDiff: true },
  { key: 'e3', label: 'E3' },
  { key: 'e4', label: 'E4' },
  { key: 'nda_enviado', label: 'NDA Env.' },
  { key: 'nda_firmado', label: 'NDA Firm.' },
  { key: 'cto_enviado', label: 'CTO Env.' },
  { key: 'e6', label: 'E6', isSubState: true },
  { key: 'cto_firmado', label: 'CTO Firm.' },
  { key: 'alta_portal', label: 'Alta' },
];

const STATUS_OPTIONS = [
  { value: 'empty',           label: 'Sin iniciar',    dotClass: 'sp-empty',    icon: '—' },
  { value: 'closed',          label: 'Cerrada',        dotClass: 'sp-closed',   icon: '✓' },
  { value: 'current_verde',   label: 'Verde (en tiempo)', dotClass: 'sp-verde', icon: '✓' },
  { value: 'current_amber',   label: 'Ámbar (2-3d)',   dotClass: 'sp-amber',    icon: '✓' },
  { value: 'current_rojo_cli',label: 'Rojo · Cliente', dotClass: 'sp-rojo-cli', icon: '!' },
  { value: 'current_rojo_int',label: 'Rojo · Interno', dotClass: 'sp-rojo-int', icon: '!' },
  { value: 'current_critico', label: 'Crítico (8d+)',  dotClass: 'sp-critico',  icon: '!' },
  { value: 'pending',         label: 'Pendiente',      dotClass: 'sp-pending',  icon: '!' },
];

const E6_OPTIONS = [
  { value: null,  label: 'Sin estado' },
  { value: 'e6a', label: 'E6a — Sin comentarios' },
  { value: 'e6b', label: 'E6b — Con comentarios' },
];

// ——— DOM REFS ———
const $body       = document.getElementById('table-body');
const $loading    = document.getElementById('loading');
const $emptyState = document.getElementById('empty-state');
const $modal      = document.getElementById('client-modal');
const $picker     = document.getElementById('status-picker');
const $toasts     = document.getElementById('toast-container');
const $lastUpdate = document.getElementById('last-updated');

// ——— INIT ———
document.addEventListener('DOMContentLoaded', init);

async function init() {
  bindEvents();
  checkAuth();
  updateTimestamp();
}

function checkAuth() {
  currentUser = localStorage.getItem('currentUser');
  const overlay = document.getElementById('login-overlay');
  const profile = document.getElementById('user-profile');
  
  if (!currentUser) {
    overlay.style.display = 'flex';
    profile.style.display = 'none';
  } else {
    overlay.style.display = 'none';
    profile.style.display = 'flex';
    
    document.getElementById('user-display-name').textContent = currentUser;
    document.getElementById('user-avatar').textContent = currentUser.charAt(0).toUpperCase();
    
    fetchClientes();
  }
}

function bindEvents() {
  // Login Form Submission
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Logout Button
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Comments Drawer Close Buttons
  const drawerCloseBtn = document.getElementById('drawer-close-btn');
  if (drawerCloseBtn) {
    drawerCloseBtn.addEventListener('click', closeCommentsDrawer);
  }
  const drawerOverlay = document.getElementById('comments-drawer-overlay');
  if (drawerOverlay) {
    drawerOverlay.addEventListener('click', closeCommentsDrawer);
  }

  // Save comment button
  const saveCommentBtn = document.getElementById('btn-save-comment');
  if (saveCommentBtn) {
    saveCommentBtn.addEventListener('click', handleSaveComment);
  }

  // Add client button
  document.getElementById('btn-add-client').addEventListener('click', openAddModal);

  // Modal close / cancel
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);

  // Modal save
  document.getElementById('modal-save-btn').addEventListener('click', handleSave);

  // Close modal on backdrop click
  $modal.addEventListener('click', (e) => {
    if (e.target === $modal) closeModal();
  });

  // Close picker on outside click
  document.addEventListener('click', (e) => {
    if (activePicker && !$picker.contains(e.target) && !e.target.closest('.badge') && !e.target.closest('.sub-tag') && !e.target.closest('.sub-empty')) {
      closePicker();
    }
  });

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closePicker();
      closeCommentsDrawer();
    }
  });

  // Add new responsible button
  document.getElementById('btn-add-resp').addEventListener('click', handleAddNewResponsable);

  // Document upload events
  const docInput = document.getElementById('f-document');
  if (docInput) {
    docInput.addEventListener('change', handleDocumentUpload);
  }

  const $uploadBox = document.getElementById('doc-upload-box');
  if ($uploadBox) {
    $uploadBox.addEventListener('dragover', (e) => {
      e.preventDefault();
      $uploadBox.classList.add('dragover');
    });
    $uploadBox.addEventListener('dragleave', () => {
      $uploadBox.classList.remove('dragover');
    });
    $uploadBox.addEventListener('drop', (e) => {
      e.preventDefault();
      $uploadBox.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        docInput.files = files;
        handleDocumentUpload({ target: { files } });
      }
    });
  }
}

// ——— FETCH DATA ———
async function fetchClientes() {
  showLoading(true);
  const { data, error } = await db.from('clientes').select('*').order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching:', error);
    toast('Error al cargar datos: ' + error.message, 'error');
    showLoading(false);
    return;
  }

  clientes = data || [];
  populateResponsablesDropdown();
  renderTable();
  showLoading(false);
}

// ——— RENDER TABLE ———
function renderTable() {
  $body.innerHTML = '';

  if (clientes.length === 0) {
    $emptyState.style.display = 'block';
    return;
  }

  $emptyState.style.display = 'none';

  clientes.forEach(c => {
    const tr = document.createElement('tr');
    tr.dataset.id = c.id;

    const notesCount = c.notas_count || 0;
    const notesText = notesCount > 0 ? `NOTAS ${notesCount}` : 'Añadir Nota';
    const notesClass = notesCount > 0 ? 'notes-pill' : 'notes-pill empty';
    const isPlazos = c.tipo_pago && c.tipo_pago.includes('A plazos');

    tr.innerHTML = `
      <td>
        <div>
          <span class="cli-name">${esc(c.nombre)}</span>
          <span class="${notesClass}" onclick="openCommentsDrawer('${c.id}')"><span class="notes-icon">📝</span> ${notesText}</span>
        </div>
        <span class="cli-sector">${esc(c.sector || '')}</span>
        ${c.descripcion ? `<p class="cli-desc">${esc(c.descripcion)}</p>` : ''}
        <div class="cli-meta-row">
          <span class="pay-badge ${isPlazos ? 'plazos' : 'unico'}" onclick="toggleTipoPago('${c.id}')" title="Haga click para cambiar el tipo de pago">
            ${esc(c.tipo_pago || 'Pago único')}
          </span>
        </div>
        <div class="row-actions">
          <button class="ra-del" onclick="deleteCliente('${c.id}')" title="Eliminar cliente">✕ Eliminar</button>
        </div>
      </td>
      <td>
        <span class="resp-badge">${esc(c.responsable)}</span>
      </td>
      ${renderStageCell(c, 'e1')}
      ${renderStageCell(c, 'e2')}
      ${renderStageCell(c, 'e3')}
      ${renderStageCell(c, 'e4')}
      ${renderStageCell(c, 'nda_enviado')}
      ${renderStageCell(c, 'nda_firmado')}
      ${renderStageCell(c, 'cto_enviado')}
      ${renderE6Cell(c)}
      ${renderStageCell(c, 'cto_firmado')}
      ${renderStageCell(c, 'alta_portal')}
    `;

    $body.appendChild(tr);
  });
}

// ——— RENDER A SINGLE STAGE CELL ———
function renderStageCell(cliente, stageKey) {
  const statusField = `${stageKey}_status`;
  const diasField   = `${stageKey}_dias`;
  const status = cliente[statusField] || 'empty';
  const dias   = cliente[diasField];

  // Badge classes
  const { badgeClass, icon } = getBadgeInfo(status);

  // Build captions
  let captions = '';

  // Monto for E1
  if (stageKey === 'e1' && cliente.e1_monto > 0) {
    captions += `<span class="cap">${formatMoney(cliente.e1_monto)}</span>`;
  }

  // Monto + diff for E2
  if (stageKey === 'e2') {
    if (cliente.e2_monto > 0) {
      captions += `<span class="cap">${formatMoney(cliente.e2_monto)}</span>`;
    }
    if (cliente.e2_diff && cliente.e2_diff !== 0) {
      const isNeg = cliente.e2_diff < 0;
      const diffColor = isNeg ? 'var(--crimson)' : 'var(--teal)';
      const diffSymbol = isNeg ? '▼' : '▲';
      const diffSign = isNeg ? '' : '+';
      captions += `<span class="cap" style="color:${diffColor};font-weight:700;font-size:9.5px;margin-top:2px;">${diffSymbol} ${diffSign}${formatMoney(cliente.e2_diff)}</span>`;
    }
    if (status === 'pending') {
      captions += `<span class="cap amber">pendiente</span>`;
    }
  }

  // Days / Elapsed Time
  let elapsedText = '';
  if (dias !== null && dias !== undefined) {
    elapsedText = `${dias}d`;
  } else if (status !== 'empty') {
    const baseDate = getBaseDate(cliente, stageKey);
    const stageDate = cliente[`${stageKey}_date`] ? new Date(cliente[`${stageKey}_date`]) : null;
    const endDate = (status === 'closed') ? (stageDate || new Date()) : new Date();
    elapsedText = formatElapsedTime(baseDate, endDate);
  }

  if (elapsedText) {
    const capColor = getDiasCapColor(status);
    captions += `<span class="cap ${capColor}">${elapsedText}</span>`;
  }

  return `
    <td class="stage-cell">
      <div class="cell-stack">
        <span class="badge ${badgeClass}"
              data-client-id="${cliente.id}"
              data-field="${statusField}"
              onclick="openPicker(event, '${cliente.id}', '${statusField}')"></span>
        ${captions}
      </div>
    </td>
  `;
}

// ——— RENDER E6 CELL ———
function renderE6Cell(cliente) {
  const subType = cliente.e6_sub_type;
  const subDesc = cliente.e6_sub_desc || '';
  const dias    = cliente.e6_dias;

  let elapsedText = '';
  if (dias !== null && dias !== undefined) {
    elapsedText = `${dias}d`;
  } else if (subType) {
    const baseDate = getBaseDate(cliente, 'e6');
    const stageDate = cliente.e6_date ? new Date(cliente.e6_date) : null;
    const endDate = stageDate || new Date();
    elapsedText = formatElapsedTime(baseDate, endDate);
  }

  let captions = '';
  if (elapsedText) {
    const capColor = subType ? (subType === 'e6a' ? 'verde' : 'rojo') : 'muted';
    captions = `<span class="cap ${capColor}">${elapsedText}</span>`;
  }

  if (!subType) {
    return `
      <td class="stage-cell">
        <div class="cell-stack">
          <span class="sub-tag sub-empty"
                onclick="openE6Picker(event, '${cliente.id}')"
                style="cursor:pointer;">—</span>
          ${captions}
        </div>
      </td>
    `;
  }

  return `
    <td class="stage-cell">
      <div class="cell-stack">
        <span class="sub-tag ${subType}"
              onclick="openE6Picker(event, '${cliente.id}')"
              style="cursor:pointer;">
          <span class="st-code">${subType.toUpperCase()}</span>
          <span class="st-desc">${esc(subDesc)}</span>
        </span>
        ${captions}
      </div>
    </td>
  `;
}

// ——— BADGE HELPER ———
function getBadgeInfo(status) {
  switch (status) {
    case 'closed':
      return { badgeClass: 'closed', icon: '✓' };
    case 'current_verde':
      return { badgeClass: 'current verde', icon: '✓' };
    case 'current_amber':
      return { badgeClass: 'current amber', icon: '✓' };
    case 'current_rojo_cli':
      return { badgeClass: 'current rojo-cli', icon: '!' };
    case 'current_rojo_int':
      return { badgeClass: 'current rojo-int', icon: '!' };
    case 'current_critico':
      return { badgeClass: 'current critico', icon: '!' };
    case 'pending':
      return { badgeClass: 'pending', icon: '!' };
    default:
      return { badgeClass: 'empty', icon: '—' };
  }
}

function getDiasCapColor(status) {
  if (status.includes('verde')) return 'verde';
  if (status.includes('amber')) return 'amber';
  if (status.includes('rojo'))  return 'rojo';
  if (status.includes('critico')) return 'critico';
  return 'muted';
}

// ——— STATUS PICKER ———
function openPicker(event, clienteId, field) {
  event.stopPropagation();

  const badge = event.currentTarget;
  const rect  = badge.getBoundingClientRect();

  // Current status
  const cliente = clientes.find(c => c.id === clienteId);
  const currentStatus = cliente ? cliente[field] : 'empty';

  // Build picker HTML
  let html = '';
  STATUS_OPTIONS.forEach(opt => {
    const activeClass = opt.value === currentStatus ? 'active' : '';
    html += `
      <button class="sp-option ${activeClass}"
              onclick="setStatus('${clienteId}', '${field}', '${opt.value}')">
        <span class="sp-dot ${opt.dotClass}">${opt.icon}</span>
        ${opt.label}
      </button>
    `;
  });

  // Add days input
  const diasField = field.replace('_status', '_dias');
  const currentDias = cliente ? (cliente[diasField] || '') : '';
  html += `<div class="sp-sep"></div>`;
  html += `
    <div style="padding:6px 10px;display:flex;align-items:center;gap:8px;">
      <span style="font-family:var(--mono);font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:var(--char);flex-shrink:0;">Días:</span>
      <input type="number" min="0" max="999" value="${currentDias}"
             style="width:60px;padding:4px 8px;border:1px solid var(--rule);border-radius:2px;font-family:var(--mono);font-size:11px;background:var(--paper);color:var(--ink-900);outline:none;"
             onchange="setDias('${clienteId}', '${diasField}', this.value)"
             onclick="event.stopPropagation()">
    </div>
  `;

  // Add monto input for E1 and E2
  if (field === 'e1_status' || field === 'e2_status') {
    const montoField = field.replace('_status', '_monto');
    const currentMonto = cliente ? (cliente[montoField] || 0) : 0;
    html += `
      <div style="padding:6px 10px;display:flex;align-items:center;gap:8px;">
        <span style="font-family:var(--mono);font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:var(--char);flex-shrink:0;">Monto:</span>
        <input type="number" min="0" step="1000" value="${currentMonto}"
               style="width:100px;padding:4px 8px;border:1px solid var(--rule);border-radius:2px;font-family:var(--mono);font-size:11px;background:var(--paper);color:var(--ink-900);outline:none;"
               onchange="setMonto('${clienteId}', '${montoField}', this.value)"
               onclick="event.stopPropagation()">
      </div>
    `;
  }

  $picker.innerHTML = html;
  $picker.classList.add('is-open');

  // Position
  const pickerW = 200;
  let left = rect.left + rect.width / 2 - pickerW / 2;
  let top  = rect.bottom + 8;

  // Keep in viewport
  if (left < 8) left = 8;
  if (left + pickerW > window.innerWidth - 8) left = window.innerWidth - pickerW - 8;
  if (top + 320 > window.innerHeight) top = rect.top - 320;

  $picker.style.left = left + 'px';
  $picker.style.top  = top + 'px';

  activePicker = { clienteId, field };
}

function openE6Picker(event, clienteId) {
  event.stopPropagation();

  const el   = event.currentTarget;
  const rect = el.getBoundingClientRect();
  const cliente = clientes.find(c => c.id === clienteId);
  const currentType = cliente ? cliente.e6_sub_type : null;

  let html = '';
  E6_OPTIONS.forEach(opt => {
    const activeClass = opt.value === currentType ? 'active' : '';
    html += `
      <button class="sp-option ${activeClass}"
              onclick="setE6('${clienteId}', ${opt.value === null ? 'null' : `'${opt.value}'`})">
        ${opt.value ? `<span class="sp-dot ${opt.value === 'e6a' ? 'sp-verde' : 'sp-rojo-cli'}" style="width:10px;height:10px;"></span>` : '<span class="sp-dot sp-empty" style="width:10px;height:10px;"></span>'}
        ${opt.label}
      </button>
    `;
  });

  // Add days input for E6
  const currentDias = cliente ? (cliente.e6_dias || '') : '';
  html += `<div class="sp-sep"></div>`;
  html += `
    <div style="padding:6px 10px;display:flex;align-items:center;gap:8px;">
      <span style="font-family:var(--mono);font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:var(--char);flex-shrink:0;">Días:</span>
      <input type="number" min="0" max="999" value="${currentDias}"
             style="width:60px;padding:4px 8px;border:1px solid var(--rule);border-radius:2px;font-family:var(--mono);font-size:11px;background:var(--paper);color:var(--ink-900);outline:none;"
             onchange="setDias('${clienteId}', 'e6_dias', this.value)"
             onclick="event.stopPropagation()">
    </div>
  `;

  $picker.innerHTML = html;
  $picker.classList.add('is-open');

  const pickerW = 220;
  let left = rect.left + rect.width / 2 - pickerW / 2;
  let top  = rect.bottom + 8;
  if (left < 8) left = 8;
  if (left + pickerW > window.innerWidth - 8) left = window.innerWidth - pickerW - 8;
  if (top + 240 > window.innerHeight) top = rect.top - 240;

  $picker.style.left = left + 'px';
  $picker.style.top  = top + 'px';

  activePicker = { clienteId, field: 'e6' };
}

function closePicker() {
  $picker.classList.remove('is-open');
  activePicker = null;
}

// ——— UPDATE STATUS ———
async function setStatus(clienteId, field, value) {
  closePicker();

  const stageKey = field.replace('_status', '');
  const dateField = `${stageKey}_date`;
  const diasField = `${stageKey}_dias`;
  
  const cliente = clientes.find(c => c.id === clienteId);
  if (!cliente) return;
  
  const nowStr = new Date().toISOString();
  let dateValue = null;
  let diasValue = null;
  
  if (value !== 'empty') {
    dateValue = nowStr;
    const baseDate = getBaseDate(cliente, stageKey);
    diasValue = calculateDaysDifference(baseDate, dateValue);
  }
  
  // Optimistic update
  cliente[field] = value;
  cliente[dateField] = dateValue;
  cliente[diasField] = diasValue;
  renderTable();

  const updates = {
    [field]: value,
    [dateField]: dateValue,
    [diasField]: diasValue,
    updated_at: nowStr
  };

  const { error } = await db.from('clientes').update(updates).eq('id', clienteId);

  if (error) {
    toast('Error al actualizar: ' + error.message, 'error');
    await fetchClientes();
  } else {
    updateTimestamp();
  }
}

async function setDias(clienteId, field, value) {
  const dias = value ? parseInt(value) : null;

  const cliente = clientes.find(c => c.id === clienteId);
  if (cliente) cliente[field] = dias;
  renderTable();

  const { error } = await db.from('clientes').update({ [field]: dias, updated_at: new Date().toISOString() }).eq('id', clienteId);
  if (error) {
    toast('Error al actualizar días: ' + error.message, 'error');
    await fetchClientes();
  }
}

async function setMonto(clienteId, field, value) {
  const monto = value ? parseFloat(value) : 0;

  const cliente = clientes.find(c => c.id === clienteId);
  let updates = {};
  
  if (cliente) {
    cliente[field] = monto;
    
    // Recalcular diferencia entre E1 y E2
    const e1 = cliente.e1_monto || 0;
    const e2 = cliente.e2_monto || 0;
    cliente.e2_diff = e2 > 0 ? (e2 - e1) : null;
    
    updates = {
      [field]: monto,
      e2_diff: cliente.e2_diff,
      updated_at: new Date().toISOString()
    };
  }
  
  renderTable();

  const { error } = await db.from('clientes').update(updates).eq('id', clienteId);
  if (error) {
    toast('Error al actualizar monto: ' + error.message, 'error');
    await fetchClientes();
  }
}

async function setE6(clienteId, value) {
  closePicker();

  const descMap = { e6a: 'sin comentarios', e6b: 'con comentarios' };
  const nowStr = new Date().toISOString();
  
  const cliente = clientes.find(c => c.id === clienteId);
  if (!cliente) return;
  
  let dateValue = null;
  let diasValue = null;
  
  if (value) {
    dateValue = nowStr;
    const baseDate = getBaseDate(cliente, 'e6');
    diasValue = calculateDaysDifference(baseDate, dateValue);
  }
  
  const updates = {
    e6_sub_type: value,
    e6_sub_desc: value ? descMap[value] : null,
    e6_date: dateValue,
    e6_dias: diasValue,
    updated_at: nowStr
  };

  // Optimistic update
  cliente.e6_sub_type = updates.e6_sub_type;
  cliente.e6_sub_desc = updates.e6_sub_desc;
  cliente.e6_date = updates.e6_date;
  cliente.e6_dias = updates.e6_dias;
  
  renderTable();

  const { error } = await db.from('clientes').update(updates).eq('id', clienteId);
  if (error) {
    toast('Error al actualizar E6: ' + error.message, 'error');
    await fetchClientes();
  } else {
    updateTimestamp();
  }
}

// ——— DELETE ———
async function deleteCliente(id) {
  const cliente = clientes.find(c => c.id === id);
  const name = cliente ? cliente.nombre : 'este cliente';

  if (!confirm(`¿Seguro que deseas eliminar a "${name}"?`)) return;

  // Optimistic
  clientes = clientes.filter(c => c.id !== id);
  renderTable();

  const { error } = await db.from('clientes').delete().eq('id', id);

  if (error) {
    toast('Error al eliminar: ' + error.message, 'error');
    await fetchClientes();
  } else {
    toast(`"${name}" eliminado`, 'success');
    updateTimestamp();
  }
}

// ——— MODAL ———
function openAddModal() {
  document.getElementById('modal-title').textContent = 'Nuevo Cliente';
  document.getElementById('client-form').reset();
  
  // Limpiar estado de carga de documento
  const statusText = document.getElementById('doc-status-text');
  if (statusText) {
    statusText.className = 'doc-status';
    statusText.textContent = 'Ningún archivo seleccionado';
  }
  
  populateResponsablesDropdown();
  $modal.classList.add('is-open');

  // Focus first input
  setTimeout(() => document.getElementById('f-nombre').focus(), 150);
}

function closeModal() {
  $modal.classList.remove('is-open');
}

async function handleSave() {
  const nombre = document.getElementById('f-nombre').value.trim();
  const sector = document.getElementById('f-sector').value.trim();
  const responsable = document.getElementById('f-responsable').value;
  const monto  = parseFloat(document.getElementById('f-monto').value) || 0;
  const tipo_pago = document.getElementById('f-tipo-pago').value || 'Pago único';
  const descripcion = document.getElementById('f-descripcion').value.trim() || null;

  // Validation
  if (!nombre) {
    toast('El nombre del cliente es requerido', 'error');
    document.getElementById('f-nombre').focus();
    return;
  }
  if (!responsable) {
    toast('Selecciona un responsable', 'error');
    document.getElementById('f-responsable').focus();
    return;
  }

  const isE1Closed = monto > 0;
  const baseStartDate = new Date().toISOString();

  const newCliente = {
    nombre,
    sector,
    responsable,
    notas_count: 0,
    tipo_pago,
    descripcion,
    e1_status: isE1Closed ? 'closed' : 'empty',
    e1_monto: monto,
    e1_date: isE1Closed ? baseStartDate : null,
    e1_dias: isE1Closed ? 0 : null,
    e2_status: 'empty',
    e2_monto: 0,
    e2_dias: null,
    e2_date: null,
    e3_status: 'empty',
    e3_dias: null,
    e3_date: null,
    e4_status: 'empty',
    e4_dias: null,
    e4_date: null,
    nda_enviado_status: 'empty',
    nda_enviado_dias: null,
    nda_enviado_date: null,
    nda_firmado_status: 'empty',
    nda_firmado_dias: null,
    nda_firmado_date: null,
    cto_enviado_status: 'empty',
    cto_enviado_dias: null,
    cto_enviado_date: null,
    e6_dias: null,
    e6_date: null,
    cto_firmado_status: 'empty',
    cto_firmado_dias: null,
    cto_firmado_date: null,
    alta_portal_status: 'empty',
    alta_portal_dias: null,
    alta_portal_date: null,
  };

  closeModal();

  const { data, error } = await db.from('clientes').insert([newCliente]).select();

  if (error) {
    toast('Error al guardar: ' + error.message, 'error');
    console.error(error);
    return;
  }

  if (data && data.length > 0) {
    clientes.push(data[0]);
  }

  renderTable();
  toast(`"${nombre}" agregado exitosamente`, 'success');
  updateTimestamp();
}

// ——— DYNAMIC RESPONSABLES ———
function populateResponsablesDropdown() {
  const $select = document.getElementById('f-responsable');
  if (!$select) return;
  
  const dbResponsables = clientes.map(c => c.responsable)
    .filter(r => r && r.trim() !== '')
    .filter(r => r !== r.toUpperCase()) // Quitar mayúsculas (MAJA, CHUY, ALONSO, etc.)
    .filter(r => r.toLowerCase() !== 'brandon'); // Quitar Brandon
    
  const allResponsables = [...new Set([...defaultResponsables, ...dbResponsables])];
  
  const currentValue = $select.value;
  
  $select.innerHTML = '<option value="">— Seleccionar —</option>';
  allResponsables.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    $select.appendChild(opt);
  });
  
  if (currentValue && allResponsables.includes(currentValue)) {
    $select.value = currentValue;
  }
}

function handleAddNewResponsable() {
  const name = prompt('Ingresa el nombre del nuevo responsable:');
  if (!name) return;
  const trimmed = name.trim();
  if (trimmed === '') return;
  
  if (!defaultResponsables.includes(trimmed)) {
    defaultResponsables.push(trimmed);
  }
  
  populateResponsablesDropdown();
  document.getElementById('f-responsable').value = trimmed;
  toast(`Responsable "${trimmed}" agregado`, 'success');
}

// ——— TOGGLE TIPO PAGO IN TABLE ———
async function toggleTipoPago(clienteId) {
  const cliente = clientes.find(c => c.id === clienteId);
  if (!cliente) return;
  
  const nextValue = (cliente.tipo_pago && cliente.tipo_pago.includes('A plazos')) ? 'Pago único' : 'A plazos';
  cliente.tipo_pago = nextValue;
  renderTable();
  
  const { error } = await db.from('clientes').update({ tipo_pago: nextValue, updated_at: new Date().toISOString() }).eq('id', clienteId);
  if (error) {
    toast('Error al actualizar tipo de pago: ' + error.message, 'error');
    await fetchClientes();
  } else {
    toast(`Tipo de pago de "${cliente.nombre}" cambiado a "${nextValue}"`, 'success');
  }
}

// ——— CLAUDE DOCUMENT PARSER ———
async function handleDocumentUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const statusText = document.getElementById('doc-status-text');
  if (statusText) {
    statusText.className = 'doc-status loading';
    statusText.textContent = `Procesando archivo: ${file.name}...`;
  }

  try {
    let payload = {};
    const extension = file.name.split('.').pop().toLowerCase();

    if (extension === 'txt') {
      const text = await readTextFile(file);
      payload = { text };
    } else if (extension === 'pdf') {
      if (statusText) statusText.textContent = 'Renderizando páginas del PDF como imágenes...';
      const images = await renderPdfToImages(file);
      payload = { images };
    } else if (extension === 'docx') {
      const text = await readDocxFile(file);
      payload = { text };
    } else {
      throw new Error('Formato de archivo no soportado. Sube un PDF, DOCX o TXT.');
    }

    if (statusText) {
      statusText.textContent = 'Enviando imágenes/texto a Claude 4.6 para análisis...';
    }

    const response = await fetch('/api/parse-document', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Error al analizar el documento.');
    }

    const data = await response.json();

    if (data.nombre) document.getElementById('f-nombre').value = data.nombre;
    if (data.sector) document.getElementById('f-sector').value = data.sector;
    
    if (data.responsable) {
      const respValue = data.responsable.trim();
      const isInvalid = respValue === respValue.toUpperCase() || respValue.toLowerCase() === 'brandon';
      if (respValue && !isInvalid) {
        // Buscar coincidencia insensible a mayúsculas
        const matchedResp = defaultResponsables.find(r => r.toLowerCase() === respValue.toLowerCase());
        if (matchedResp) {
          document.getElementById('f-responsable').value = matchedResp;
        } else {
          // Capitalizar la primera letra del nombre nuevo para que se vea limpio
          const formattedName = respValue.charAt(0).toUpperCase() + respValue.slice(1).toLowerCase();
          if (!defaultResponsables.includes(formattedName)) {
            defaultResponsables.push(formattedName);
            populateResponsablesDropdown();
          }
          document.getElementById('f-responsable').value = formattedName;
        }
      }
    }
    
    if (data.monto !== undefined && data.monto !== null) {
      document.getElementById('f-monto').value = data.monto;
    }
    
    if (data.tipo_pago) {
      const payVal = data.tipo_pago.trim().toLowerCase();
      if (payVal.includes('plazo') || payVal.includes('mensual') || payVal.includes('recurrente') || payVal.includes('hitos')) {
        document.getElementById('f-tipo-pago').value = 'A plazos';
      } else {
        document.getElementById('f-tipo-pago').value = 'Pago único';
      }
    }

    if (data.descripcion) {
      document.getElementById('f-descripcion').value = data.descripcion;
    }

    if (statusText) {
      statusText.className = 'doc-status success';
      statusText.textContent = '¡Documento leído! Campos completados con éxito.';
    }
    toast('Campos auto-completados por Claude', 'success');

  } catch (err) {
    console.error(err);
    if (statusText) {
      statusText.className = 'doc-status error';
      statusText.textContent = `Error: ${err.message}`;
    }
    toast(`Error al leer archivo: ${err.message}`, 'error');
  } finally {
    const docInput = document.getElementById('f-document');
    if (docInput) docInput.value = '';
  }
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
}

async function renderPdfToImages(file) {
  const arrayBuffer = await file.arrayBuffer();
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
  
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images = [];
  
  // Renderizar máximo las primeras 3 páginas para evitar sobrecargar la petición
  const pagesToRender = Math.min(pdf.numPages, 3);
  
  for (let i = 1; i <= pagesToRender; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 }); // Escala ideal para legibilidad de texto
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Renderizar la página en el canvas
    await page.render({ canvasContext: context, viewport: viewport }).promise;
    
    // Obtener la imagen base64 como JPEG (comprimido al 85% para mantener un tamaño ligero)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64Data = dataUrl.split(',')[1];
    images.push(base64Data);
  }
  
  return images;
}

async function readDocxFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

// ——— HELPERS ———
function formatMoney(n) {
  if (!n && n !== 0) return '';
  const num = Number(n);
  const prefix = num < 0 ? '-' : '';
  return prefix + '$' + Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 0 });
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showLoading(show) {
  $loading.style.display = show ? 'flex' : 'none';
}

function updateTimestamp() {
  const now = new Date();
  const formatted = now.toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  $lastUpdate.textContent = `Última actualización · ${formatted}`;
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $toasts.appendChild(el);

  setTimeout(() => {
    el.style.animation = 'toastOut 0.3s ease-out forwards';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const day = parts[2];
      const month = months[parseInt(parts[1]) - 1];
      const year = parts[0];
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
}

function getBaseDate(cliente, stageKey) {
  const stageOrder = ['e1', 'e2', 'e3', 'e4', 'nda_enviado', 'nda_firmado', 'cto_enviado', 'e6', 'cto_firmado', 'alta_portal'];
  const index = stageOrder.indexOf(stageKey);
  if (index <= 0) {
    return new Date(cliente.created_at || new Date());
  }
  for (let i = index - 1; i >= 0; i--) {
    const prevKey = stageOrder[i];
    const prevDate = cliente[`${prevKey}_date`] || (prevKey === 'e6' ? cliente.e6_date : null);
    if (prevDate) {
      return new Date(prevDate);
    }
  }
  return new Date(cliente.created_at || new Date());
}

function calculateDaysDifference(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

function formatElapsedTime(startDateVal, endDateVal) {
  if (!startDateVal || !endDateVal) return '';
  const start = new Date(startDateVal);
  const end = new Date(endDateVal);
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return '0s';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;

  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d`;
}

// ——— LOGIN FUNCTIONS ———
function handleLogin(e) {
  e.preventDefault();
  const user = document.getElementById('login-user').value;
  const pass = document.getElementById('login-pass').value;
  const errorMsg = document.getElementById('login-error-msg');

  if (!user) return;

  const passwords = {
    'Jesus': 'jesus123',
    'Alonso': 'alonso123',
    'Fabiola': 'fabiola123'
  };

  if (pass === passwords[user]) {
    localStorage.setItem('currentUser', user);
    errorMsg.style.display = 'none';
    document.getElementById('login-pass').value = '';
    checkAuth();
  } else {
    errorMsg.style.display = 'block';
  }
}

function handleLogout() {
  localStorage.removeItem('currentUser');
  currentUser = null;
  checkAuth();
}

// ——— COMMENTS (DRAWER) ———
async function openCommentsDrawer(clienteId) {
  currentOpenClienteId = clienteId;
  const cliente = clientes.find(c => c.id === clienteId);
  if (!cliente) return;

  document.getElementById('drawer-client-name').textContent = cliente.nombre;
  document.getElementById('f-comment-text').value = '';
  
  document.getElementById('comments-drawer').classList.add('is-open');
  document.getElementById('comments-drawer-overlay').classList.add('is-open');

  await fetchAndRenderComments(clienteId);
}

function closeCommentsDrawer() {
  document.getElementById('comments-drawer').classList.remove('is-open');
  document.getElementById('comments-drawer-overlay').classList.remove('is-open');
  currentOpenClienteId = null;
}

async function fetchAndRenderComments(clienteId) {
  const listEl = document.getElementById('comments-list');
  listEl.innerHTML = '<div class="loading-overlay" style="padding:20px 0;"><span class="loading-dot"></span> Cargando notas…</div>';

  const { data, error } = await db
    .from('comentarios')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching comments:', error);
    listEl.innerHTML = '<div style="color:var(--crimson);font-size:12px;font-family:var(--mono);">Error al cargar comentarios.</div>';
    return;
  }

  if (!data || data.length === 0) {
    listEl.innerHTML = '<div style="color:var(--char);font-size:12px;font-family:var(--mono);text-align:center;padding:20px 0;">No hay notas registradas para este cliente.</div>';
    return;
  }

  listEl.innerHTML = '';
  data.forEach(comment => {
    const item = document.createElement('div');
    item.className = 'comment-item';

    const authorName = comment.autor || 'Otro';
    const initial = authorName.charAt(0).toUpperCase();
    
    let userClass = 'user-other';
    if (authorName === 'Jesus') userClass = 'user-J';
    else if (authorName === 'Alonso') userClass = 'user-A';
    else if (authorName === 'Fabiola') userClass = 'user-F';

    const commentDate = new Date(comment.created_at);
    const dateStr = commentDate.toLocaleString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    item.innerHTML = `
      <div class="comment-avatar ${userClass}">${initial}</div>
      <div class="comment-content">
        <div class="comment-meta">
          <span class="comment-author">${esc(authorName)}</span>
          <span class="comment-date">${dateStr}</span>
        </div>
        <div class="comment-text">${esc(comment.texto)}</div>
      </div>
    `;
    listEl.appendChild(item);
  });
}

async function handleSaveComment() {
  if (!currentOpenClienteId) return;

  const textEl = document.getElementById('f-comment-text');
  const text = textEl.value.trim();
  if (!text) return;

  const user = currentUser || 'Otro';

  const btn = document.getElementById('btn-save-comment');
  btn.disabled = true;

  const { data, error } = await db.from('comentarios').insert([
    {
      cliente_id: currentOpenClienteId,
      autor: user,
      texto: text
    }
  ]).select();

  if (error) {
    toast('Error al guardar comentario: ' + error.message, 'error');
    btn.disabled = false;
    return;
  }

  textEl.value = '';
  btn.disabled = false;

  const cliente = clientes.find(c => c.id === currentOpenClienteId);
  if (cliente) {
    cliente.notas_count = (cliente.notas_count || 0) + 1;
    await db.from('clientes').update({ notas_count: cliente.notas_count }).eq('id', currentOpenClienteId);
  }

  await fetchAndRenderComments(currentOpenClienteId);
  renderTable();
}
