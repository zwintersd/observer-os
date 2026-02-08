/**
 * Observer.os — Main Application Bootstrap
 * Your evening. Observed, supported, yours.
 */

import { initAmbient } from './ambient.js';
import { initSparkle } from './sparkle.js';
import { startTimeSystem } from './time-system.js';
import { toggleWindow, openWindow, getAppConfig } from './window-manager.js';
import { initCheckIn } from './checkin.js';
import { initBuddy, setBuddyState, updateBuddyForPhase } from './buddy.js';
import { initEditor } from './editor.js';
import { initQueue } from './queue.js';
import { initTasks } from './tasks.js';
import { initReflect } from './reflect.js';
import { initNotes } from './notes.js';
import { getTodayCheckIn, getCurrentCycleDay } from './db.js';

// App initializers keyed by app ID
const APP_INITIALIZERS = {
  checkin: initCheckIn,
  editor: initEditor,
  buddy: initBuddy,
  queue: initQueue,
  tasks: initTasks,
  reflect: initReflect,
  notes: initNotes,
  sounds: () => {}, // Placeholder — ambient sounds TBD
};

async function boot() {
  console.log('Observer.os booting...');

  // Initialize ambient systems
  initAmbient();
  initSparkle();
  startTimeSystem();

  // Set up taskbar clicks
  setupTaskbar();

  // Update tray info
  await updateTray();

  // Check if already checked in today
  const todayCheckIn = await getTodayCheckIn();

  if (todayCheckIn) {
    // Already checked in — open Buddy in relaxed state
    setBuddyState('relaxed');
    openWindow('buddy', initBuddy);
  } else {
    // Gently prompt check-in — open it after a brief moment
    setBuddyState('waiting');
    setTimeout(() => {
      openWindow('checkin', initCheckIn);
      openWindow('buddy', initBuddy);
    }, 800);
  }

  // Listen for check-in completion
  window.addEventListener('checkin-complete', (e) => {
    updateTray();
  });

  // Listen for phase changes to update buddy
  setInterval(async () => {
    // Phase is updated by time-system, buddy follows
    const hour = new Date().getHours();
    if (hour >= 22) updateBuddyForPhase('rest');
    else if (hour >= 21) updateBuddyForPhase('winddown');
    else if (hour >= 19) updateBuddyForPhase('active');
  }, 60000);

  console.log('Observer.os ready.');
}

function setupTaskbar() {
  const taskbarApps = document.querySelectorAll('.taskbar-app');
  taskbarApps.forEach(btn => {
    btn.addEventListener('click', () => {
      const appId = btn.dataset.app;
      const initializer = APP_INITIALIZERS[appId];
      toggleWindow(appId, initializer);
    });
  });
}

async function updateTray() {
  // Cycle day in tray
  const cycleDay = await getCurrentCycleDay();
  const trayCycle = document.getElementById('tray-cycle');
  if (trayCycle) {
    if (cycleDay !== null) {
      trayCycle.textContent = `day ${cycleDay}`;
      trayCycle.title = `Day ${cycleDay} of hormone cycle`;
    } else {
      trayCycle.textContent = '';
    }
  }
}

// Boot when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
