/**
 * Check-In.exe — The sequential evening arrival ritual
 * Smart contextual greetings, body check, brain dump, evening intention, summary.
 */

import {
  saveCheckIn, getTodayCheckIn, getLastCheckIn, getRecentCheckIns,
  getCurrentCycleDay, logCycleDay, addTask, getQueueRecommendations,
} from './db.js';
import { setCheckInTime, setCurrentIntention } from './time-system.js';
import { setBuddyState } from './buddy.js';

const STEPS = ['arrival', 'body', 'braindump', 'intention', 'summary'];
let currentStep = 0;
let checkInData = {};
let windowEl = null;

export function initCheckIn(winEl) {
  windowEl = winEl;
  currentStep = 0;
  checkInData = {};

  setupPillSelects();
  setupNavigation();
  generateGreeting();
  updateStepVisibility();
}

function setupPillSelects() {
  if (!windowEl) return;
  const pillSelects = windowEl.querySelectorAll('.pill-select:not(.multi)');
  pillSelects.forEach(container => {
    const pills = container.querySelectorAll('.pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
        const field = container.dataset.field;
        if (field) checkInData[field] = pill.dataset.value;
      });
    });
  });

  // Multi-select (for queue mood tags)
  const multiSelects = windowEl.querySelectorAll('.pill-select.multi');
  multiSelects.forEach(container => {
    const pills = container.querySelectorAll('.pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pill.classList.toggle('selected');
      });
    });
  });
}

function setupNavigation() {
  if (!windowEl) return;
  const nextBtn = windowEl.querySelector('.checkin-next');
  const backBtn = windowEl.querySelector('.checkin-back');

  nextBtn.addEventListener('click', () => {
    collectStepData();
    if (currentStep < STEPS.length - 1) {
      currentStep++;
      updateStepVisibility();
      if (STEPS[currentStep] === 'intention') {
        loadIntentionSuggestions();
      }
      if (STEPS[currentStep] === 'summary') {
        showSummary();
        nextBtn.textContent = 'close & begin evening';
        nextBtn.addEventListener('click', finishCheckIn, { once: true });
      }
    }
  });

  backBtn.addEventListener('click', () => {
    if (currentStep > 0) {
      currentStep--;
      updateStepVisibility();
      const nextBtn2 = windowEl.querySelector('.checkin-next');
      nextBtn2.textContent = 'continue';
    }
  });
}

function updateStepVisibility() {
  if (!windowEl) return;
  const steps = windowEl.querySelectorAll('.checkin-step');
  steps.forEach((step, i) => {
    step.style.display = i === currentStep ? '' : 'none';
  });

  // Progress
  const fill = windowEl.querySelector('.checkin-progress-fill');
  const dots = windowEl.querySelectorAll('.checkin-progress-dots .dot');
  const pct = ((currentStep + 1) / STEPS.length) * 100;
  if (fill) fill.style.width = `${pct}%`;

  dots.forEach((dot, i) => {
    dot.classList.remove('active', 'completed');
    if (i < currentStep) dot.classList.add('completed');
    if (i === currentStep) dot.classList.add('active');
  });

  // Back button visibility
  const backBtn = windowEl.querySelector('.checkin-back');
  if (backBtn) {
    backBtn.style.visibility = currentStep > 0 ? 'visible' : 'hidden';
  }
}

async function generateGreeting() {
  if (!windowEl) return;
  const greetingEl = windowEl.querySelector('.checkin-greeting');
  if (!greetingEl) return;

  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const day = dayNames[now.getDay()];
  const hour = now.getHours();

  let timeGreeting = 'evening';
  if (hour < 17) timeGreeting = 'afternoon';
  if (hour >= 21) timeGreeting = 'late evening';

  const cycleDay = await getCurrentCycleDay();
  const lastCheckIn = await getLastCheckIn();
  const recentCheckIns = await getRecentCheckIns(7);

  const parts = [];

  // Opening
  if (!lastCheckIn) {
    parts.push(`Welcome to Observer.os. This is your space.`);
    parts.push(`It's ${day} ${timeGreeting}. How are you arriving?`);
  } else {
    const lastDate = new Date(lastCheckIn.time);
    const daysSince = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

    if (daysSince > 3) {
      parts.push(`Hey. It's been a few days. No pressure \u2014 glad you're here.`);
      parts.push(`It's ${day} ${timeGreeting}. How are you arriving?`);
    } else if (now.getDay() === 5) {
      parts.push(`Hey. It's Friday \u2014 you made it through the week.`);
      parts.push(`How are you arriving?`);
    } else {
      parts.push(`Welcome home. It's ${day} ${timeGreeting}.`);

      if (cycleDay !== null) {
        parts.push(`Day ${cycleDay} of your cycle.`);

        // Check for pattern: similar cycle days in recent data
        if (recentCheckIns.length > 5) {
          const similarDayCheckIns = recentCheckIns.filter(
            c => Math.abs((c.cycleDay || 0) - cycleDay) <= 2
          );
          if (similarDayCheckIns.length >= 2) {
            const energies = similarDayCheckIns.map(c => c.energy).filter(Boolean);
            const mostCommon = mode(energies);
            if (mostCommon) {
              parts.push(`Around this point in your cycle, you've tended toward ${mostCommon.replace('-', ' ')} energy.`);
            }
          }
        }
      }

      parts.push(`How are you arriving?`);
    }
  }

  greetingEl.textContent = parts.join(' ');
}

function collectStepData() {
  if (!windowEl) return;
  const step = STEPS[currentStep];

  if (step === 'arrival') {
    const moodInput = windowEl.querySelector('.mood-input');
    if (moodInput) checkInData.mood = moodInput.value;
  }

  if (step === 'body') {
    const bodyNotes = windowEl.querySelector('.body-notes');
    if (bodyNotes) checkInData.bodyNotes = bodyNotes.value;
  }

  if (step === 'braindump') {
    const brainDump = windowEl.querySelector('.braindump-input');
    if (brainDump) checkInData.brainDump = brainDump.value;
    const avoided = windowEl.querySelector('.avoided-input');
    if (avoided) checkInData.avoided = avoided.value;
  }

  if (step === 'intention') {
    const intentionInput = windowEl.querySelector('.intention-input');
    if (intentionInput && intentionInput.value) {
      checkInData.intention = intentionInput.value;
    }
    // Or selected card
    const selectedCard = windowEl.querySelector('.intention-card.selected');
    if (selectedCard && !checkInData.intention) {
      checkInData.intention = selectedCard.querySelector('.intention-card-title')?.textContent;
    }
  }
}

async function loadIntentionSuggestions() {
  if (!windowEl) return;
  const container = windowEl.querySelector('#intention-suggestions');
  if (!container) return;

  const state = {
    energy: checkInData.energy,
    overstimulation: checkInData.overstimulation,
  };

  const recommendations = await getQueueRecommendations(state);

  container.innerHTML = '';

  if (recommendations.length === 0) {
    container.innerHTML = '<div style="color: var(--muted-text); font-size: 13px; padding: 8px 0;">Add items to your Queue to get personalized suggestions here.</div>';
    return;
  }

  recommendations.forEach(item => {
    const card = document.createElement('div');
    card.className = 'intention-card';
    card.innerHTML = `
      <div class="intention-card-title">${escapeHtml(item.title)}</div>
      <div class="intention-card-reason">${item.type}${item.tags?.energy_cost ? ` · ${item.tags.energy_cost} energy` : ''}${item.tags?.stimulation_level ? ` · ${item.tags.stimulation_level}` : ''}</div>
    `;
    card.addEventListener('click', () => {
      container.querySelectorAll('.intention-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      checkInData.intention = item.title;
      // Clear text input if card selected
      const input = windowEl.querySelector('.intention-input');
      if (input) input.value = '';
    });
    container.appendChild(card);
  });
}

function showSummary() {
  if (!windowEl) return;
  collectStepData();
  const summaryEl = windowEl.querySelector('#checkin-summary');
  if (!summaryEl) return;

  const items = [];

  if (checkInData.mood || checkInData.energy) {
    let stateStr = '';
    if (checkInData.mood) stateStr += checkInData.mood;
    if (checkInData.energy) stateStr += (stateStr ? ', ' : '') + checkInData.energy.replace('-', ' ') + ' energy';
    if (checkInData.overstimulation && checkInData.overstimulation !== 'calm') {
      stateStr += ', ' + checkInData.overstimulation.replace('-', ' ');
    }
    items.push({ label: 'your state', value: stateStr });
  }

  if (checkInData.medication) {
    items.push({ label: 'medication', value: checkInData.medication === 'na' ? 'n/a' : checkInData.medication });
  }

  if (checkInData.intention) {
    items.push({ label: 'your intention', value: checkInData.intention });
  }

  if (checkInData.brainDump) {
    items.push({ label: 'brain dump', value: 'captured \u2713' });
  }

  if (checkInData.avoided) {
    items.push({ label: 'avoided task', value: 'noted \u2014 it\'ll be held gently' });
  }

  summaryEl.innerHTML = items.map(item => `
    <div class="summary-item">
      <div class="summary-label">${item.label}</div>
      <div class="summary-value">${escapeHtml(item.value)}</div>
    </div>
  `).join('');
}

async function finishCheckIn() {
  collectStepData();

  // Handle cycle tracking
  if (checkInData.bleeding) {
    const today = new Date().toISOString().split('T')[0];
    const result = await logCycleDay(today, checkInData.bleeding === 'yes');
    checkInData.cycleDay = result.cycleDay;
  }

  // Save avoided items as tasks
  if (checkInData.avoided && checkInData.avoided.trim()) {
    const items = checkInData.avoided.split('\n').filter(l => l.trim());
    for (const item of items) {
      await addTask(item.trim(), 'avoided', 'check-in');
    }
  }

  // Save brain dump items as tasks (optional)
  if (checkInData.brainDump && checkInData.brainDump.trim()) {
    await addTask(checkInData.brainDump.trim(), 'brain-dump', 'check-in');
  }

  // Save the check-in
  await saveCheckIn({
    energy: checkInData.energy || '',
    mood: checkInData.mood || '',
    overstimulation: checkInData.overstimulation || '',
    medicationStatus: checkInData.medication || '',
    cycleDay: checkInData.cycleDay ?? null,
    bodyNotes: checkInData.bodyNotes || '',
    brainDump: checkInData.brainDump || '',
    avoided: checkInData.avoided || '',
    eveningIntention: checkInData.intention || '',
    completedSteps: STEPS.length,
  });

  // Set system state
  setCheckInTime(new Date());
  setCurrentIntention(checkInData.intention);
  setBuddyState('checked-in');

  // Dispatch event for other systems
  window.dispatchEvent(new CustomEvent('checkin-complete', {
    detail: checkInData
  }));
}

function mode(arr) {
  if (!arr.length) return null;
  const counts = {};
  arr.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
