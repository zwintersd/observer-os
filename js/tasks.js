/**
 * Tasks.exe — Neutral task tracking with help-request generation
 * Tasks are externalized acknowledgments, not a pressure system.
 */

import { addTask, getActiveTasks, updateTask, getAvoidedTasks, getSetting } from './db.js';

let windowEl = null;

export function initTasks(winEl) {
  windowEl = winEl;

  setupToolbar();
  loadTasks();
  surfaceAvoidedTask();
}

function setupToolbar() {
  if (!windowEl) return;

  const addBtn = windowEl.querySelector('#task-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const inputArea = windowEl.querySelector('#task-input-area');
      if (inputArea) {
        inputArea.style.display = inputArea.style.display === 'none' ? 'flex' : 'none';
        const input = windowEl.querySelector('#task-input');
        if (input) input.focus();
      }
    });
  }

  const saveBtn = windowEl.querySelector('#task-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveNewTask);
  }

  const taskInput = windowEl.querySelector('#task-input');
  if (taskInput) {
    taskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveNewTask();
    });
  }
}

async function saveNewTask() {
  if (!windowEl) return;
  const input = windowEl.querySelector('#task-input');
  if (!input || !input.value.trim()) return;

  await addTask(input.value.trim(), 'general', 'manual');
  input.value = '';
  loadTasks();
}

async function loadTasks() {
  if (!windowEl) return;
  const listEl = windowEl.querySelector('#tasks-list');
  if (!listEl) return;

  const tasks = await getActiveTasks();
  const doneTasks = []; // could load completed tasks too

  if (tasks.length === 0) {
    listEl.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--muted-text);">
      Nothing here. That's okay.
    </div>`;
    return;
  }

  listEl.innerHTML = '';
  tasks.forEach(task => {
    const el = document.createElement('div');
    el.className = 'task-item';

    const isCompleted = task.status === 'done';
    el.innerHTML = `
      <button class="task-check ${isCompleted ? 'done' : ''}" data-id="${task.id}">
        ${isCompleted ? '✓' : ''}
      </button>
      <div class="task-text-container" style="flex:1">
        <div class="task-text ${isCompleted ? 'done' : ''}">${escapeHtml(task.text)}</div>
        <div class="task-meta">${task.category !== 'general' ? task.category : ''}${task.source === 'check-in' ? ' · from check-in' : ''}</div>
      </div>
      <div class="task-actions">
        ${task.category === 'avoided' ? `<button class="queue-action-btn help-btn" title="Ask for support" data-id="${task.id}">♡</button>` : ''}
        <button class="queue-action-btn release-btn" title="Let go" data-id="${task.id}">~</button>
      </div>
    `;

    // Toggle complete
    el.querySelector('.task-check').addEventListener('click', async () => {
      const newStatus = task.status === 'done' ? 'active' : 'done';
      await updateTask(task.id, { status: newStatus });
      loadTasks();
    });

    // Release (consciously let go)
    const releaseBtn = el.querySelector('.release-btn');
    if (releaseBtn) {
      releaseBtn.addEventListener('click', async () => {
        await updateTask(task.id, { status: 'released' });
        loadTasks();
      });
    }

    // Help button
    const helpBtn = el.querySelector('.help-btn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => showHelpScript(task));
    }

    listEl.appendChild(el);
  });
}

async function surfaceAvoidedTask() {
  if (!windowEl) return;
  const surfacedEl = windowEl.querySelector('#tasks-surfaced');
  if (!surfacedEl) return;

  const avoided = await getAvoidedTasks();
  if (avoided.length === 0) {
    surfacedEl.style.display = 'none';
    return;
  }

  // Surface the oldest one that hasn't been surfaced too many times
  const toSurface = avoided.sort((a, b) => a.surfacedCount - b.surfacedCount)[0];

  surfacedEl.style.display = '';
  surfacedEl.querySelector('.surfaced-prompt').textContent =
    `This has been on your list for a while: "${toSurface.text}"`;

  // Update surfaced count
  await updateTask(toSurface.id, { surfacedCount: (toSurface.surfacedCount || 0) + 1 });

  // Action buttons
  const actions = surfacedEl.querySelector('.surfaced-actions');
  actions.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', async () => {
      const action = pill.dataset.action;
      if (action === 'deal') {
        // Just acknowledge — user decides what to do
        surfacedEl.style.display = 'none';
      } else if (action === 'help') {
        showHelpScript(toSurface);
        surfacedEl.style.display = 'none';
      } else if (action === 'later') {
        surfacedEl.style.display = 'none';
      }
    }, { once: true });
  });
}

async function showHelpScript(task) {
  if (!windowEl) return;
  const modal = windowEl.querySelector('#help-script-modal');
  if (!modal) return;

  const template = await getSetting('helpScriptTemplate') || defaultHelpTemplate();
  const script = template.replace('[items]', task.text);

  modal.style.display = '';
  const textarea = modal.querySelector('#help-script-text');
  if (textarea) textarea.value = script;

  const copyBtn = modal.querySelector('#help-copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (textarea) {
        navigator.clipboard.writeText(textarea.value).then(() => {
          copyBtn.textContent = 'copied!';
          setTimeout(() => { copyBtn.textContent = 'copy message'; }, 2000);
        });
      }
    }, { once: true });
  }

  const closeBtn = modal.querySelector('#help-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    }, { once: true });
  }

  // Mark help as requested
  await updateTask(task.id, {
    helpRequested: true,
    helpRequestedDate: new Date().toISOString(),
  });
}

function defaultHelpTemplate() {
  return `Hey Mom, I've got a few things that have been building up that I'm having some disability-related challenges with. Could we set up a Zoom call where you help me stay on track while I work through them? Here's what I'm dealing with: [items]. Having someone there while I tackle these would make a big difference. Love you 💛`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
