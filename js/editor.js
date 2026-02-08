/**
 * Editor.exe — Beautiful text editor for expression
 * Auto-save, word count, past entries, journaling prompts.
 */

import { saveEditorEntry, getEditorEntries, getEditorEntry } from './db.js';
import { setBuddyWriting } from './buddy.js';

let windowEl = null;
let saveTimeout = null;
let currentDate = null;
let isWriting = false;
let writingTimeout = null;

const PROMPTS = [
  "What's one thing you noticed today that you haven't said out loud?",
  "If your body could talk right now, what would it say?",
  "Write about something small that mattered today.",
  "What are you carrying that isn't yours to hold?",
  "Describe where you are right now like you're writing a novel.",
  "What would be different if you were gentle with yourself tonight?",
  "Write a letter to tomorrow-you.",
  "What sound do you wish you could hear right now?",
  "Name three textures you touched today.",
  "If this feeling had a weather, what would it be?",
  "What are you pretending not to know?",
  "Write about the last time you laughed.",
  "What would your ideal evening feel like in your body?",
  "Describe a place where you feel completely safe.",
  "What's something you're ready to put down?",
];

export function initEditor(winEl) {
  windowEl = winEl;
  currentDate = new Date().toISOString().split('T')[0];

  const dateEl = windowEl.querySelector('#editor-date');
  if (dateEl) {
    dateEl.textContent = formatDate(currentDate);
  }

  const editorArea = windowEl.querySelector('#editor-area');
  if (editorArea) {
    // Load today's entry if exists
    loadEntry(currentDate);

    // Auto-save on input
    editorArea.addEventListener('input', () => {
      updateWordCount();
      scheduleSave();
      trackWritingState(true);
    });

    // Track focus for buddy
    editorArea.addEventListener('focus', () => trackWritingState(true));
    editorArea.addEventListener('blur', () => trackWritingState(false));
  }

  // Prompt button
  const promptBtn = windowEl.querySelector('.editor-prompt-btn');
  if (promptBtn) {
    promptBtn.addEventListener('click', showPrompt);
  }

  // Load past entries list
  loadEntriesList();
}

async function loadEntry(date) {
  if (!windowEl) return;
  const editorArea = windowEl.querySelector('#editor-area');
  if (!editorArea) return;

  const entry = await getEditorEntry(date);
  if (entry) {
    editorArea.innerHTML = entry.content;
  } else {
    editorArea.innerHTML = '';
  }
  updateWordCount();
}

function updateWordCount() {
  if (!windowEl) return;
  const editorArea = windowEl.querySelector('#editor-area');
  const countEl = windowEl.querySelector('#editor-wordcount');
  if (!editorArea || !countEl) return;

  const text = editorArea.innerText || '';
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  countEl.textContent = `${words} word${words !== 1 ? 's' : ''}`;
}

function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    const editorArea = windowEl?.querySelector('#editor-area');
    if (!editorArea) return;

    const content = editorArea.innerHTML;
    if (content.trim()) {
      await saveEditorEntry(content);
    }
  }, 1000);
}

function trackWritingState(writing) {
  if (writing && !isWriting) {
    isWriting = true;
    setBuddyWriting(true);
  }

  if (writingTimeout) clearTimeout(writingTimeout);
  writingTimeout = setTimeout(() => {
    if (!writing || !document.activeElement?.closest('#editor-area')) {
      isWriting = false;
      setBuddyWriting(false);
    }
  }, 3000);
}

function showPrompt() {
  if (!windowEl) return;
  const editorArea = windowEl.querySelector('#editor-area');
  if (!editorArea) return;

  const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];

  // If editor is empty, show prompt as placeholder-like text
  if (!editorArea.innerText.trim()) {
    editorArea.innerHTML = `<span style="color: var(--lavender-dim); font-style: italic;">${prompt}</span>`;
    // Select all so typing replaces it
    const range = document.createRange();
    range.selectNodeContents(editorArea);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    // Append prompt on a new line
    editorArea.innerHTML += `<br><br><span style="color: var(--lavender-dim); font-style: italic;">${prompt}</span>`;
    // Move cursor to end
    const range = document.createRange();
    range.selectNodeContents(editorArea);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  editorArea.focus();
}

async function loadEntriesList() {
  if (!windowEl) return;
  const listEl = windowEl.querySelector('#editor-entries-list');
  if (!listEl) return;

  const entries = await getEditorEntries(20);
  const today = new Date().toISOString().split('T')[0];

  // Filter out today
  const pastEntries = entries.filter(e => e.date !== today);

  if (pastEntries.length === 0) {
    listEl.innerHTML = '';
    return;
  }

  listEl.innerHTML = '<div style="font-size: 11px; color: var(--muted-text); margin-bottom: 8px;">past entries</div>';

  pastEntries.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'editor-entry-item';

    // Get plain text preview
    const temp = document.createElement('div');
    temp.innerHTML = entry.content;
    const preview = (temp.innerText || '').substring(0, 80);

    item.innerHTML = `
      <div class="editor-entry-date">${formatDate(entry.date)} · ${entry.wordCount} words</div>
      <div class="editor-entry-preview">${escapeHtml(preview)}</div>
    `;

    item.addEventListener('click', () => {
      currentDate = entry.date;
      const dateEl = windowEl.querySelector('#editor-date');
      if (dateEl) dateEl.textContent = formatDate(entry.date);
      loadEntry(entry.date);
    });

    listEl.appendChild(item);
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
