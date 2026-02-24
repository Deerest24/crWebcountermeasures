// ============================================================
//  Climate Resilience Countermeasures — script.js
// ============================================================

// --- Hazard definitions ---
// stats: [Frequency, Severity, Preparedness difficulty, Recovery time] (1–5)
const HAZARDS = [
  { id: 'earthquake', name: 'Earthquake', icon: '🏔️', dot: '#8d6e63',
    gradient: 'linear-gradient(155deg, #d7ccc8 0%, #795548 100%)',
    bannerBg: '#8d6e63', stats: [2, 5, 4, 4] },
  { id: 'flooding',   name: 'Flooding',   icon: '🌊', dot: '#1565c0',
    gradient: 'linear-gradient(155deg, #90caf9 0%, #0d47a1 100%)',
    bannerBg: '#1565c0', stats: [4, 4, 3, 3] },
  { id: 'heatwaves',  name: 'Heat Waves', icon: '☀️', dot: '#e65100',
    gradient: 'linear-gradient(155deg, #ffe082 0%, #bf360c 100%)',
    bannerBg: '#e65100', stats: [5, 3, 2, 2] },
  { id: 'landslide',  name: 'Landslide',  icon: '⛰️', dot: '#5d4037',
    gradient: 'linear-gradient(155deg, #bcaaa4 0%, #3e2723 100%)',
    bannerBg: '#5d4037', stats: [2, 4, 3, 4] },
  { id: 'tornado',    name: 'Tornado',    icon: '🌪️', dot: '#546e7a',
    gradient: 'linear-gradient(155deg, #cfd8dc 0%, #263238 100%)',
    bannerBg: '#546e7a', stats: [3, 5, 3, 4] },
  { id: 'tsunami',    name: 'Tsunami',    icon: '🌊', dot: '#01579b',
    gradient: 'linear-gradient(155deg, #4fc3f7 0%, #006064 100%)',
    bannerBg: '#01579b', stats: [1, 5, 4, 5] },
  { id: 'storm',      name: 'Storm',      icon: '⛈️', dot: '#283593',
    gradient: 'linear-gradient(155deg, #9fa8da 0%, #1a237e 100%)',
    bannerBg: '#283593', stats: [4, 3, 2, 2] },
  { id: 'wildfire',   name: 'Wildfire',   icon: '🔥', dot: '#bf360c',
    gradient: 'linear-gradient(155deg, #ffcc80 0%, #7f0000 100%)',
    bannerBg: '#bf360c', stats: [3, 5, 3, 4] }
];

// Phases: id, label, short label for card, color, light bg
const PHASES = [
  { id: 'long-before', label: 'Long before',        abbr: 'Long\nbefore', color: '#1565c0', bg: '#e3eefa' },
  { id: 'imm-before',  label: 'Immediately before', abbr: 'Imm.\nbefore', color: '#7b1fa2', bg: '#f3e5f5' },
  { id: 'during',      label: 'During',             abbr: 'During',       color: '#c62828', bg: '#fde8e8' },
  { id: 'after',       label: 'After',              abbr: 'After',        color: '#2e7d32', bg: '#e8f5e9' }
];

// Target groups: id, label, chip color
const TARGET_GROUPS = [
  { id: 'all',      label: 'All',            color: '#5c6bc0' },
  { id: 'adults',   label: 'Adults',          color: '#6a1b9a' },
  { id: 'children', label: 'Children',        color: '#2e7d32' },
  { id: 'pets',     label: 'Pet Owners',      color: '#e65100' },
  { id: 'property', label: 'Property Owners', color: '#00695c' }
];

// ============================================================
//  State
// ============================================================
const selected   = new Set();               // selected hazard IDs
const actionData = {                        // single counteraction
  title: '', desc: '',
  links: [],
  targets: new Set(),
  customTargets: [],
  phases: Object.fromEntries(PHASES.map(p => [p.id, { checked: false, score: 0 }]))
};
let isRestoring  = false;                   // suppress persist during restore
let persistTimer = null;                    // debounce handle

function schedulePersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persist, 400);
}

// ============================================================
//  DOM refs
// ============================================================
const hazardListEl = document.getElementById('hazard-list');
const allHazardsEl = document.getElementById('allHazards');
const targetGridEl    = document.getElementById('target-grid');
const customTagsEl    = document.getElementById('custom-tags');
const customTagInput  = document.getElementById('custom-tag-input');
const addTagBtn       = document.getElementById('add-tag-btn');
const cardsEl      = document.getElementById('cards-container');
const emptyEl      = document.getElementById('empty-state');
const locationEl   = document.getElementById('location-display');
const countyEl     = document.getElementById('county');
const stateEl      = document.getElementById('state');
const countryEl    = document.getElementById('country');
const caTitleEl       = document.getElementById('ca-title');
const caDescEl        = document.getElementById('ca-desc');
const linksContainerEl= document.getElementById('links-container');
const addLinkBtn      = document.getElementById('add-link-btn');
const exportBtn       = document.getElementById('export-btn');
const exportMenu      = document.getElementById('export-menu');
const exportPngBtn    = document.getElementById('export-png-btn');
const exportPdfBtn    = document.getElementById('export-pdf-btn');
const saveBtn         = document.getElementById('save-btn');
const saveModal       = document.getElementById('save-modal');
const modalConfirm    = document.getElementById('modal-confirm');
const modalCancel     = document.getElementById('modal-cancel');
const saveToast       = document.getElementById('save-toast');
const phaseListEl     = document.getElementById('phase-list');

// ============================================================
//  Init
// ============================================================
function init() {
  buildHazardList();
  buildTargetGroups();
  buildPhases();

  // Hazard select-all — batch: update selected Set then sync once
  allHazardsEl.addEventListener('change', e => {
    const on = e.target.checked;
    HAZARDS.forEach(h => {
      const cb = document.getElementById(`cb-${h.id}`);
      if (!cb || cb.checked === on) return;
      cb.checked = on;
      if (on) selected.add(h.id);
      else    selected.delete(h.id);
    });
    syncSelectAll();
    syncEmptyState();
    syncExportBtn();
    renderCard();
    schedulePersist();
  });

  // Location
  [countyEl, stateEl, countryEl].forEach(el =>
    el.addEventListener('input', updateLocation)
  );

  // Action form
  caTitleEl.addEventListener('input', () => {
    actionData.title = caTitleEl.value;
    renderCard();
    schedulePersist();
  });
  caDescEl.addEventListener('input', () => {
    actionData.desc = caDescEl.value;
    renderCard();
    schedulePersist();
  });
  addLinkBtn.addEventListener('click', () => { addLinkRow(''); });

  addTagBtn.addEventListener('click', commitCustomTag);
  customTagInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commitCustomTag(); }
  });
  addLinkRow('');   // start with one empty row

  exportBtn.addEventListener('click', e => {
    e.stopPropagation();
    exportMenu.hidden = !exportMenu.hidden;
  });
  exportPngBtn.addEventListener('click', exportPNG);
  exportPdfBtn.addEventListener('click', exportPDF);
  document.addEventListener('click', () => { exportMenu.hidden = true; });

  saveBtn.addEventListener('click', () => { saveModal.hidden = false; });
  modalCancel.addEventListener('click',  () => { saveModal.hidden = true; });
  modalConfirm.addEventListener('click', handleSaveConfirm);
  // Close modal on overlay click (outside dialog)
  saveModal.addEventListener('click', e => { if (e.target === saveModal) saveModal.hidden = true; });

  restoreState();
}

// ============================================================
//  Hazard checkbox list
// ============================================================
function buildHazardList() {
  HAZARDS.forEach(h => {
    const lbl = document.createElement('label');
    lbl.className = 'check-item';
    lbl.innerHTML = `
      <input type="checkbox" id="cb-${h.id}">
      <span class="hazard-dot" style="background:${h.dot}"></span>
      <span>${h.name}</span>
    `;
    lbl.querySelector('input').addEventListener('change', e =>
      toggleHazard(h.id, e.target.checked)
    );
    hazardListEl.appendChild(lbl);
  });
}

function toggleHazard(id, on) {
  if (on) selected.add(id);
  else    selected.delete(id);
  syncSelectAll();
  syncEmptyState();
  syncExportBtn();
  renderCard();
  schedulePersist();
}

function syncSelectAll() {
  allHazardsEl.checked       = selected.size === HAZARDS.length;
  allHazardsEl.indeterminate = selected.size > 0 && selected.size < HAZARDS.length;
}

// ============================================================
//  Target group checkboxes
// ============================================================
function buildTargetGroups() {
  TARGET_GROUPS.forEach(tg => {
    const lbl = document.createElement('label');
    lbl.className = 'tg-label';
    lbl.id = `tg-label-${tg.id}`;
    lbl.innerHTML = `<input type="checkbox" id="tg-${tg.id}" value="${tg.id}">${tg.label}`;
    targetGridEl.appendChild(lbl);

    const cb = lbl.querySelector('input');
    cb.addEventListener('change', () => handleTargetChange(tg.id, cb.checked));
  });
}

// ============================================================
//  Phase checkboxes + score inputs
// ============================================================
function buildPhases() {
  PHASES.forEach(p => {
    const row = document.createElement('div');
    row.className = 'phase-row';
    row.innerHTML = `
      <input type="checkbox" id="phase-cb-${p.id}">
      <label class="phase-row-label" for="phase-cb-${p.id}">${p.label}</label>
      <div class="phase-score-wrap">
        <span>Score</span>
        <input type="number" class="phase-score-input" id="phase-score-${p.id}"
               min="0" max="5" value="0" disabled>
      </div>
    `;
    phaseListEl.appendChild(row);

    const cb    = row.querySelector(`#phase-cb-${p.id}`);
    const score = row.querySelector(`#phase-score-${p.id}`);

    cb.addEventListener('change', () => {
      actionData.phases[p.id].checked = cb.checked;
      score.disabled = !cb.checked;
      if (!cb.checked) {
        score.value = 0;
        actionData.phases[p.id].score = 0;
      }
      renderCard();
      schedulePersist();
    });

    score.addEventListener('input', () => {
      let v = parseInt(score.value, 10);
      if (isNaN(v) || v < 0) v = 0;
      if (v > 5) v = 5;
      score.value = v;
      actionData.phases[p.id].score = v;
      renderCard();
      schedulePersist();
    });
  });
}

// ============================================================
//  Multi-link rows
// ============================================================
function addLinkRow(url) {
  const row = document.createElement('div');
  row.className = 'link-row';
  row.innerHTML = `
    <input type="url" class="ca-input" placeholder="https://…" value="${esc(url)}">
    <button type="button" class="link-remove-btn" title="Remove">×</button>
  `;
  linksContainerEl.appendChild(row);

  row.querySelector('input').addEventListener('input', () => { syncLinks(); });
  row.querySelector('button').addEventListener('click', () => {
    row.remove();
    syncLinks();
  });
}

function syncLinks() {
  actionData.links = [...linksContainerEl.querySelectorAll('input')]
    .map(el => el.value.trim())
    .filter(Boolean);
  renderCard();
  schedulePersist();
}

// ============================================================
//  Custom target tags
// ============================================================
function commitCustomTag() {
  const label = customTagInput.value.trim();
  if (!label) return;
  addCustomTagChip(label);
  actionData.customTargets.push(label);
  customTagInput.value = '';
  renderCard();
  schedulePersist();
}

function addCustomTagChip(label) {
  const chip = document.createElement('span');
  chip.className = 'custom-tag-chip';
  chip.innerHTML = `<span>${esc(label)}</span><button type="button" title="Remove">×</button>`;
  chip.querySelector('button').addEventListener('click', () => {
    chip.remove();
    actionData.customTargets = [...customTagsEl.querySelectorAll('.custom-tag-chip span')]
      .map(s => s.textContent);
    renderCard();
    schedulePersist();
  });
  customTagsEl.appendChild(chip);
}

function handleTargetChange(changedId, checked) {
  if (changedId === 'all') {
    // Toggle every group including itself
    TARGET_GROUPS.forEach(tg => {
      const cb  = document.getElementById(`tg-${tg.id}`);
      const lbl = document.getElementById(`tg-label-${tg.id}`);
      cb.checked = checked;
      lbl.classList.toggle('tg-checked', checked);
      if (checked) actionData.targets.add(tg.id);
      else         actionData.targets.delete(tg.id);
    });
  } else {
    // Toggle individual group
    const lbl = document.getElementById(`tg-label-${changedId}`);
    lbl.classList.toggle('tg-checked', checked);
    if (checked) actionData.targets.add(changedId);
    else         actionData.targets.delete(changedId);

    // Sync the "All" checkbox
    const allChecked = TARGET_GROUPS
      .filter(t => t.id !== 'all')
      .every(t => actionData.targets.has(t.id));
    const allCb  = document.getElementById('tg-all');
    const allLbl = document.getElementById('tg-label-all');
    allCb.checked = allChecked;
    allLbl.classList.toggle('tg-checked', allChecked);
    if (allChecked) actionData.targets.add('all');
    else            actionData.targets.delete('all');
  }
  renderCard();
  schedulePersist();
}

// ============================================================
//  Location
// ============================================================
function updateLocation() {
  const parts = [countyEl, stateEl, countryEl]
    .map(el => el.value.trim()).filter(Boolean);
  locationEl.textContent = parts.length
    ? parts.join(', ')
    : 'Enter your location to get started';
  schedulePersist();
}

// ============================================================
//  Card rendering  (ONE card, multi-hazard)
// ============================================================
function renderCard() {
  const existing = document.getElementById('main-card');
  if (existing) existing.remove();

  syncEmptyState();
  if (selected.size === 0) return;

  const card = buildCard();
  card.id = 'main-card';
  cardsEl.appendChild(card);
}

function buildCard() {
  const hazards = HAZARDS.filter(h => selected.has(h.id));

  // ---- Stats: phase scores ----
  const statsHtml = PHASES.map(p => {
    const active = actionData.phases[p.id].checked;
    const score  = actionData.phases[p.id].score;
    const bg     = active
      ? `radial-gradient(circle at 37% 33%, ${p.color}cc, ${p.color})`
      : 'radial-gradient(circle at 37% 33%, #90a4ae, #546e7a)';
    const opacity = active ? '1' : '0.45';
    const abbr    = p.abbr.replace('\n', ' ');
    return `
      <div class="stat-badge" style="opacity:${opacity}">
        <div class="stat-circle" style="background:${bg}">${score}</div>
        <span class="stat-label">${abbr}</span>
      </div>`;
  }).join('');

  // ---- Image area ----
  let imageContent;
  if (hazards.length === 1) {
    imageContent = `<span class="card-icon">${hazards[0].icon}</span>`;
  } else {
    const visible = hazards.slice(0, 4);
    const extra   = hazards.length - 4;
    const icons   = visible.map(h => `<span class="card-icon-sm">${h.icon}</span>`).join('');
    const moreTag = extra > 0
      ? `<span class="card-icon-more">+${extra}</span>`
      : '';
    imageContent = `<div class="card-icons-grid">${icons}${moreTag}</div>`;
  }

  // ---- Gradient background ----
  const bgGradient = hazards.length === 1
    ? hazards[0].gradient
    : `linear-gradient(155deg, ${firstColor(hazards[0].gradient)} 0%, ${lastColor(hazards[hazards.length - 1].gradient)} 100%)`;

  // ---- Banner: action title ----
  const bannerBg   = hazards.length === 1 ? hazards[0].bannerBg : '#c07800';
  const bannerText = actionData.title
    ? esc(actionData.title)
    : '<span class="banner-placeholder">Action title</span>';

  // ---- Body ----
  const hasContent = actionData.desc || actionData.targets.size > 0
                  || actionData.customTargets.length > 0 || actionData.links.length > 0;

  const descHtml = actionData.desc
    ? `<p class="card-action-desc">${esc(actionData.desc).replace(/\n/g, '<br>')}</p>` : '';

  const predefinedChips = [...actionData.targets]
    .filter(t => t !== 'all')
    .map(t => {
      const tg = TARGET_GROUPS.find(x => x.id === t);
      return tg ? `<span class="tg-chip" style="background:${tg.color}">${tg.label}</span>` : '';
    }).join('');
  const customChips = actionData.customTargets
    .map(label => `<span class="tg-chip" style="background:#546e7a">${esc(label)}</span>`)
    .join('');
  const allChips = predefinedChips + customChips;
  const targetsHtml = allChips ? `<div class="card-targets">${allChips}</div>` : '';

  const linkItems = actionData.links
    .filter(isValidUrl)
    .map(url => {
      const domain = new URL(url).hostname.replace('www.', '');
      return `<a class="card-link" href="${esc(url)}" target="_blank" rel="noopener">
        <span class="card-link-icon">🔗</span>${domain}</a>`;
    }).join('');
  const linkHtml = linkItems ? `<div class="card-links">${linkItems}</div>` : '';

  const bodyHtml = hasContent
    ? descHtml + targetsHtml + linkHtml
    : `<p class="card-placeholder">Add a description to fill this card.</p>`;

  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-stats">${statsHtml}</div>
    <div class="card-image" style="background:${bgGradient}">${imageContent}</div>
    <div class="card-banner" style="background:${bannerBg};color:#fff">${bannerText}</div>
    <div class="card-body">${bodyHtml}</div>
  `;
  return card;
}

// ============================================================
//  Empty state & button sync
// ============================================================
function syncEmptyState() {
  emptyEl.style.display = selected.size === 0 ? '' : 'none';
}

function syncExportBtn() {
  exportBtn.disabled = selected.size === 0;
  saveBtn.disabled   = selected.size === 0;
}

// ============================================================
//  Save (POST to server → append CSV + git commit)
// ============================================================
function buildSavePayload() {
  const hazardNames = HAZARDS
    .filter(h => selected.has(h.id))
    .map(h => h.name);

  const targets = [
    ...[...actionData.targets]
      .filter(t => t !== 'all')
      .map(t => TARGET_GROUPS.find(x => x.id === t)?.label || t),
    ...actionData.customTargets
  ];

  const phases = PHASES
    .filter(p => actionData.phases[p.id].checked)
    .map(p => `${p.label}: ${actionData.phases[p.id].score}`);

  return {
    county:  countyEl.value.trim(),
    state:   stateEl.value.trim(),
    country: countryEl.value.trim(),
    hazards: hazardNames,
    title:   actionData.title,
    desc:    actionData.desc,
    targets,
    phases,
    links:   actionData.links,
  };
}

async function handleSaveConfirm() {
  saveModal.hidden = true;
  modalConfirm.disabled = true;

  try {
    const res = await fetch('/api/save', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(buildSavePayload()),
    });
    const json = await res.json();
    if (json.ok) {
      showToast('Entry saved to database!', false);
    } else {
      showToast('Save failed: ' + (json.error || 'unknown error'), true);
    }
  } catch (err) {
    showToast('Could not reach server. Is server.js running?', true);
  } finally {
    modalConfirm.disabled = false;
  }
}

function showToast(msg, isError) {
  saveToast.textContent = msg;
  saveToast.classList.toggle('toast-error', isError);
  saveToast.hidden = false;
  // Force reflow so animation replays each time
  saveToast.getAnimations().forEach(a => a.cancel());
  saveToast.style.animation = 'none';
  void saveToast.offsetWidth;
  saveToast.style.animation = '';
  clearTimeout(saveToast._timer);
  saveToast._timer = setTimeout(() => { saveToast.hidden = true; }, 3500);
}

// ============================================================
//  Export Card — PNG / PDF
// ============================================================
function closeExportMenu() {
  exportMenu.hidden = true;
}

async function exportPNG() {
  closeExportMenu();
  const card = document.getElementById('main-card');
  if (!card) return;
  showToast('Generating PNG…', false);
  try {
    const canvas = await html2canvas(card, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
    const a = document.createElement('a');
    a.download = slugTitle() + '.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
    showToast('PNG saved!', false);
  } catch (_) {
    showToast('PNG export failed', true);
  }
}

async function exportPDF() {
  closeExportMenu();
  const card = document.getElementById('main-card');
  if (!card) return;
  showToast('Generating PDF…', false);
  try {
    const canvas  = await html2canvas(card, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pxToMm  = 25.4 / 96;
    const pdfW    = card.offsetWidth  * pxToMm;
    const pdfH    = card.offsetHeight * pxToMm;
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pdfW, pdfH] });
    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
    pdf.save(slugTitle() + '.pdf');
    showToast('PDF saved!', false);
  } catch (_) {
    showToast('PDF export failed', true);
  }
}

function slugTitle() {
  const base = actionData.title || 'countermeasure-card';
  return base.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'card';
}

// ============================================================
//  Persistence (localStorage)
// ============================================================
function persist() {
  if (isRestoring) return;
  try {
    localStorage.setItem('cr_state', JSON.stringify({
      county:  countyEl.value,
      state:   stateEl.value,
      country: countryEl.value,
      hazards: [...selected],
      action: {
        title:   actionData.title,
        desc:    actionData.desc,
        links:         actionData.links,
        targets:       [...actionData.targets],
        customTargets: actionData.customTargets,
        phases:  Object.fromEntries(
          PHASES.map(p => [p.id, { checked: actionData.phases[p.id].checked,
                                   score:   actionData.phases[p.id].score }])
        )
      }
    }));
  } catch (_) {}
}

function restoreState() {
  isRestoring = true;
  try {
    const raw = localStorage.getItem('cr_state');
    if (!raw) return;
    const d = JSON.parse(raw);

    if (d.county)  countyEl.value  = d.county;
    if (d.state)   stateEl.value   = d.state;
    if (d.country) countryEl.value = d.country;
    updateLocation();

    if (Array.isArray(d.hazards)) {
      d.hazards.forEach(id => {
        const cb = document.getElementById(`cb-${id}`);
        if (cb) { cb.checked = true; selected.add(id); }
      });
    }

    if (d.action) {
      actionData.title   = d.action.title || '';
      actionData.desc    = d.action.desc  || '';
      actionData.links         = d.action.links         || [];
      actionData.targets       = new Set(d.action.targets || []);
      actionData.customTargets = d.action.customTargets  || [];

      caTitleEl.value = actionData.title;
      caDescEl.value  = actionData.desc;

      // Restore link rows (clear the initial empty row first)
      linksContainerEl.innerHTML = '';
      if (actionData.links.length > 0) {
        actionData.links.forEach(url => addLinkRow(url));
      } else {
        addLinkRow('');
      }

      actionData.targets.forEach(tgId => {
        const cb  = document.getElementById(`tg-${tgId}`);
        const lbl = document.getElementById(`tg-label-${tgId}`);
        if (cb)  cb.checked = true;
        if (lbl) lbl.classList.add('tg-checked');
      });

      actionData.customTargets.forEach(label => addCustomTagChip(label));

      if (d.action.phases) {
        PHASES.forEach(p => {
          const saved = d.action.phases[p.id];
          if (!saved) return;
          actionData.phases[p.id].checked = saved.checked || false;
          actionData.phases[p.id].score   = saved.score   || 0;
          const cb    = document.getElementById(`phase-cb-${p.id}`);
          const score = document.getElementById(`phase-score-${p.id}`);
          if (cb)    cb.checked    = actionData.phases[p.id].checked;
          if (score) { score.value = actionData.phases[p.id].score;
                       score.disabled = !actionData.phases[p.id].checked; }
        });
      }
    }

    syncSelectAll();
    syncEmptyState();
    syncExportBtn();
    renderCard();
  } catch (_) {}
  isRestoring = false;
}

// ============================================================
//  Helpers
// ============================================================
function esc(s) {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function isValidUrl(s) {
  try { new URL(s); return true; } catch (_) { return false; }
}

function firstColor(gradient) {
  const m = gradient.match(/#[0-9a-fA-F]{3,8}/);
  return m ? m[0] : '#888';
}

function lastColor(gradient) {
  const m = gradient.match(/#[0-9a-fA-F]{3,8}/g);
  return m ? m[m.length - 1] : '#444';
}

// ============================================================
//  Boot
// ============================================================
document.addEventListener('DOMContentLoaded', init);
