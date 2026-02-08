import Dexie from 'dexie';

const db = new Dexie('ObserverOS');

db.version(1).stores({
  checkIns: '++id, date, time, energy, mood, overstimulation, medicationStatus, cycleDay, bodyNotes, brainDump, avoided, eveningIntention',
  cycleTracking: '++id, date, cycleDay, bleeding, cycleId',
  tasks: '++id, text, category, status, created, source, helpRequested, helpRequestedDate, surfacedCount, notes',
  queueItems: '++id, title, type, status, addedDate, lastEngaged, timesRecommended, timesChosen',
  editorEntries: '++id, date, content, wordCount',
  observations: '++id, date, type, content',
  notes: '++id, date, content',
  settings: 'key'
});

// Default settings
const DEFAULTS = {
  typicalHomeTime: '17:30',
  typicalBedtime: '22:30',
  buddyName: 'Buddy',
  supportContacts: [],
  helpScriptTemplate: `Hey Mom, I've got a few things that have been building up that I'm having some disability-related challenges with. Could we set up a Zoom call where you help me stay on track while I work through them? Here's what I'm dealing with: [items]. Having someone there while I tackle these would make a big difference. Love you 💛`,
};

export async function getSetting(key) {
  const row = await db.settings.get(key);
  if (row) return row.value;
  return DEFAULTS[key] ?? null;
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

export async function saveCheckIn(data) {
  return db.checkIns.add({
    ...data,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toISOString(),
  });
}

export async function getTodayCheckIn() {
  const today = new Date().toISOString().split('T')[0];
  return db.checkIns.where('date').equals(today).last();
}

export async function getRecentCheckIns(days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return db.checkIns.where('date').aboveOrEqual(cutoffStr).toArray();
}

export async function getLastCheckIn() {
  return db.checkIns.orderBy('id').last();
}

// Cycle tracking
export async function logCycleDay(date, bleeding) {
  const existing = await db.cycleTracking.where('date').equals(date).first();
  const lastBleedStart = await getLastBleedStart();

  let cycleDay = 0;
  let cycleId = null;

  if (bleeding) {
    if (!lastBleedStart || daysBetween(lastBleedStart.date, date) > 14) {
      // New cycle
      cycleId = `cycle_${date}`;
      cycleDay = 0;
    } else {
      // Continuing current bleed
      cycleId = lastBleedStart.cycleId;
      cycleDay = daysBetween(lastBleedStart.date, date);
    }
  } else if (lastBleedStart) {
    cycleId = lastBleedStart.cycleId;
    cycleDay = daysBetween(lastBleedStart.date, date);
  }

  if (existing) {
    await db.cycleTracking.update(existing.id, { bleeding, cycleDay, cycleId });
  } else {
    await db.cycleTracking.add({ date, bleeding, cycleDay, cycleId });
  }

  return { cycleDay, cycleId };
}

export async function getLastBleedStart() {
  const bleeds = await db.cycleTracking
    .where('bleeding')
    .equals(1)
    .reverse()
    .sortBy('date');

  if (bleeds.length === 0) return null;

  // Find the most recent day 0 (start of bleeding after >14 day gap)
  for (let i = 0; i < bleeds.length; i++) {
    if (bleeds[i].cycleDay === 0) return bleeds[i];
  }
  return bleeds[0];
}

export async function getCurrentCycleDay() {
  const lastStart = await getLastBleedStart();
  if (!lastStart) return null;
  const today = new Date().toISOString().split('T')[0];
  return daysBetween(lastStart.date, today);
}

export async function getCycleHistory(count = 3) {
  const allEntries = await db.cycleTracking.orderBy('date').toArray();
  const cycles = [];
  let current = null;

  for (const entry of allEntries) {
    if (entry.cycleDay === 0 && entry.bleeding) {
      if (current) {
        current.length = daysBetween(current.startDate, entry.date);
        cycles.push(current);
      }
      current = { startDate: entry.date, cycleId: entry.cycleId, entries: [] };
    }
    if (current) current.entries.push(entry);
  }
  if (current) cycles.push(current);

  return cycles.slice(-count);
}

// Tasks
export async function addTask(text, category = 'general', source = 'manual') {
  return db.tasks.add({
    text,
    category,
    status: 'active',
    created: new Date().toISOString(),
    source,
    helpRequested: false,
    helpRequestedDate: null,
    surfacedCount: 0,
    notes: '',
  });
}

export async function getActiveTasks() {
  return db.tasks.where('status').equals('active').toArray();
}

export async function updateTask(id, changes) {
  return db.tasks.update(id, changes);
}

export async function getAvoidedTasks() {
  return db.tasks
    .where('category')
    .equals('avoided')
    .and(t => t.status === 'active')
    .toArray();
}

// Queue
export async function addQueueItem(item) {
  return db.queueItems.add({
    ...item,
    status: item.status || 'want',
    addedDate: new Date().toISOString(),
    lastEngaged: null,
    timesRecommended: 0,
    timesChosen: 0,
  });
}

export async function getQueueItems(filters = {}) {
  let collection = db.queueItems.toCollection();
  const items = await collection.toArray();

  return items.filter(item => {
    if (filters.type && filters.type !== 'all' && item.type !== filters.type) return false;
    if (filters.status && filters.status !== 'all' && item.status !== filters.status) return false;
    return true;
  });
}

export async function updateQueueItem(id, changes) {
  return db.queueItems.update(id, changes);
}

export async function deleteQueueItem(id) {
  return db.queueItems.delete(id);
}

export async function getQueueRecommendations(state) {
  const items = await db.queueItems
    .filter(item => item.status === 'want' || item.status === 'in-progress')
    .toArray();

  return items.filter(item => {
    const tags = item.tags || {};
    if (state.energy === 'very-low' || state.energy === 'low') {
      if (tags.energy_cost === 'high') return false;
    }
    if (state.overstimulation === 'overstimulated' || state.overstimulation === 'overloaded') {
      if (tags.stimulation_level === 'stimulating') return false;
    }
    return true;
  }).slice(0, 5);
}

// Editor
export async function saveEditorEntry(content) {
  const today = new Date().toISOString().split('T')[0];
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const existing = await db.editorEntries.where('date').equals(today).first();

  if (existing) {
    return db.editorEntries.update(existing.id, { content, wordCount });
  }
  return db.editorEntries.add({ date: today, content, wordCount });
}

export async function getEditorEntries(limit = 30) {
  return db.editorEntries.orderBy('date').reverse().limit(limit).toArray();
}

export async function getEditorEntry(date) {
  return db.editorEntries.where('date').equals(date).first();
}

// Notes
export async function saveNote(content) {
  const today = new Date().toISOString().split('T')[0];
  const existing = await db.notes.where('date').equals(today).first();
  if (existing) {
    return db.notes.update(existing.id, { content });
  }
  return db.notes.add({ date: today, content });
}

export async function getTodayNote() {
  const today = new Date().toISOString().split('T')[0];
  return db.notes.where('date').equals(today).first();
}

// Observations
export async function addObservation(type, content) {
  return db.observations.add({
    date: new Date().toISOString().split('T')[0],
    type,
    content,
  });
}

export async function getObservations(days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return db.observations.where('date').aboveOrEqual(cutoffStr).toArray();
}

// Helpers
function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

export { db };
export default db;
