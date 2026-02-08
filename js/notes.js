/**
 * Notes.exe — Quick capture scratchpad
 */

import { saveNote, getTodayNote } from './db.js';

let windowEl = null;
let saveTimeout = null;

export function initNotes(winEl) {
  windowEl = winEl;

  const textarea = windowEl.querySelector('#notes-area');
  if (!textarea) return;

  // Load today's note
  loadNote();

  textarea.addEventListener('input', () => {
    scheduleSave();
  });
}

async function loadNote() {
  if (!windowEl) return;
  const textarea = windowEl.querySelector('#notes-area');
  if (!textarea) return;

  const note = await getTodayNote();
  if (note) {
    textarea.value = note.content;
  }
}

function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    const textarea = windowEl?.querySelector('#notes-area');
    if (!textarea) return;

    await saveNote(textarea.value);

    const savedEl = windowEl?.querySelector('#notes-saved');
    if (savedEl) {
      savedEl.textContent = 'saved';
      setTimeout(() => {
        if (savedEl) savedEl.textContent = '';
      }, 2000);
    }
  }, 800);
}
