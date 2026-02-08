/**
 * Queue.exe — Personal media and activity database with mood-aware recommender
 */

import { addQueueItem, getQueueItems, updateQueueItem, deleteQueueItem } from './db.js';

let windowEl = null;

export function initQueue(winEl) {
  windowEl = winEl;

  setupToolbar();
  setupForm();
  loadQueueList();
}

function setupToolbar() {
  if (!windowEl) return;

  const addBtn = windowEl.querySelector('#queue-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => showForm());
  }

  const typeFilter = windowEl.querySelector('#queue-type-filter');
  const statusFilter = windowEl.querySelector('#queue-status-filter');

  if (typeFilter) typeFilter.addEventListener('change', loadQueueList);
  if (statusFilter) statusFilter.addEventListener('change', loadQueueList);
}

function setupForm() {
  if (!windowEl) return;

  // Pill selects in form
  const pillSelects = windowEl.querySelectorAll('.queue-form .pill-select:not(.multi)');
  pillSelects.forEach(container => {
    const pills = container.querySelectorAll('.pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
      });
    });
  });

  // Multi-select pills
  const multiSelects = windowEl.querySelectorAll('.queue-form .pill-select.multi');
  multiSelects.forEach(container => {
    const pills = container.querySelectorAll('.pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pill.classList.toggle('selected');
      });
    });
  });

  const saveBtn = windowEl.querySelector('#queue-save-btn');
  if (saveBtn) saveBtn.addEventListener('click', saveForm);

  const cancelBtn = windowEl.querySelector('#queue-cancel-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', hideForm);
}

function showForm(editItem = null) {
  if (!windowEl) return;
  const form = windowEl.querySelector('#queue-form');
  const list = windowEl.querySelector('#queue-list');
  if (!form) return;

  form.style.display = '';
  if (list) list.style.display = 'none';

  if (editItem) {
    form.querySelector('.queue-form-title').textContent = 'Edit Queue Item';
    form.querySelector('#queue-edit-id').value = editItem.id;
    form.querySelector('#queue-item-title').value = editItem.title || '';
    form.querySelector('#queue-item-notes').value = editItem.notes || '';

    // Select pills
    selectPill(form, 'queue-type', editItem.type);
    selectPill(form, 'queue-energy', editItem.tags?.energy_cost);
    selectPill(form, 'queue-stimulation', editItem.tags?.stimulation_level);
    selectPill(form, 'queue-time', editItem.tags?.time_commitment);

    // Multi-select mood
    if (editItem.tags?.mood_fit) {
      const moodContainer = form.querySelector('[data-field="queue-mood"]');
      if (moodContainer) {
        moodContainer.querySelectorAll('.pill').forEach(p => {
          p.classList.toggle('selected', editItem.tags.mood_fit.includes(p.dataset.value));
        });
      }
    }
  } else {
    form.querySelector('.queue-form-title').textContent = 'Add to Queue';
    form.querySelector('#queue-edit-id').value = '';
    form.querySelector('#queue-item-title').value = '';
    form.querySelector('#queue-item-notes').value = '';
    form.querySelectorAll('.pill.selected').forEach(p => p.classList.remove('selected'));
  }
}

function hideForm() {
  if (!windowEl) return;
  const form = windowEl.querySelector('#queue-form');
  const list = windowEl.querySelector('#queue-list');
  if (form) form.style.display = 'none';
  if (list) list.style.display = '';
}

function selectPill(container, field, value) {
  if (!value) return;
  const select = container.querySelector(`[data-field="${field}"]`);
  if (!select) return;
  select.querySelectorAll('.pill').forEach(p => {
    p.classList.toggle('selected', p.dataset.value === value);
  });
}

function getSelectedPill(field) {
  if (!windowEl) return null;
  const container = windowEl.querySelector(`#queue-form [data-field="${field}"]`);
  if (!container) return null;
  const selected = container.querySelector('.pill.selected');
  return selected?.dataset.value || null;
}

function getSelectedMultiPills(field) {
  if (!windowEl) return [];
  const container = windowEl.querySelector(`#queue-form [data-field="${field}"]`);
  if (!container) return [];
  return Array.from(container.querySelectorAll('.pill.selected')).map(p => p.dataset.value);
}

async function saveForm() {
  if (!windowEl) return;

  const title = windowEl.querySelector('#queue-item-title')?.value?.trim();
  if (!title) return;

  const editId = windowEl.querySelector('#queue-edit-id')?.value;
  const data = {
    title,
    type: getSelectedPill('queue-type') || 'other',
    tags: {
      energy_cost: getSelectedPill('queue-energy') || 'medium',
      stimulation_level: getSelectedPill('queue-stimulation') || 'moderate',
      mood_fit: getSelectedMultiPills('queue-mood'),
      time_commitment: getSelectedPill('queue-time') || 'medium',
    },
    notes: windowEl.querySelector('#queue-item-notes')?.value || '',
  };

  if (editId) {
    await updateQueueItem(parseInt(editId), data);
  } else {
    await addQueueItem(data);
  }

  hideForm();
  loadQueueList();
}

async function loadQueueList() {
  if (!windowEl) return;
  const listEl = windowEl.querySelector('#queue-list');
  if (!listEl) return;

  const typeFilter = windowEl.querySelector('#queue-type-filter')?.value || 'all';
  const statusFilter = windowEl.querySelector('#queue-status-filter')?.value || 'all';

  const items = await getQueueItems({ type: typeFilter, status: statusFilter });

  if (items.length === 0) {
    listEl.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--muted-text);">
      Your queue is empty. Add something you want to watch, read, play, or do.
    </div>`;
    return;
  }

  listEl.innerHTML = '';
  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'queue-item';
    el.innerHTML = `
      <div class="queue-item-info">
        <div class="queue-item-title">${escapeHtml(item.title)}</div>
        <div class="queue-item-meta">${item.type}${item.tags?.energy_cost ? ' · ' + item.tags.energy_cost + ' energy' : ''}</div>
      </div>
      <span class="queue-item-status ${item.status}">${item.status}</span>
      <div class="queue-item-actions">
        <button class="queue-action-btn edit-btn" title="Edit">✎</button>
        <button class="queue-action-btn status-btn" title="Cycle status">↻</button>
        <button class="queue-action-btn delete-btn" title="Remove">×</button>
      </div>
    `;

    el.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      showForm(item);
    });

    el.querySelector('.status-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const statuses = ['want', 'in-progress', 'completed', 'dropped'];
      const idx = statuses.indexOf(item.status);
      const next = statuses[(idx + 1) % statuses.length];
      await updateQueueItem(item.id, { status: next });
      loadQueueList();
    });

    el.querySelector('.delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteQueueItem(item.id);
      loadQueueList();
    });

    listEl.appendChild(el);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
