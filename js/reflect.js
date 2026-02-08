/**
 * Reflect.exe — The observation mirror
 * Generates narrative observation statements from stored data.
 * NOT a dashboard. NOT analytics. A gentle letter from someone paying attention.
 */

import { getRecentCheckIns, getCurrentCycleDay, getCycleHistory, getActiveTasks, getEditorEntries } from './db.js';

let windowEl = null;

export function initReflect(winEl) {
  windowEl = winEl;

  setupTabs();
  loadObservations('week');
}

function setupTabs() {
  if (!windowEl) return;
  const tabs = windowEl.querySelectorAll('.reflect-period-tabs .pill');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadObservations(tab.dataset.period);
    });
  });
}

async function loadObservations(period) {
  if (!windowEl) return;
  const container = windowEl.querySelector('#reflect-observations');
  if (!container) return;

  container.innerHTML = '<div class="reflect-loading">Gathering observations...</div>';

  let observations = [];

  switch (period) {
    case 'week':
      observations = await generateWeekObservations();
      break;
    case 'cycle':
      observations = await generateCycleObservations();
      break;
    case 'month':
      observations = await generatePatternObservations();
      break;
  }

  if (observations.length === 0) {
    container.innerHTML = `<div class="reflect-loading">Not enough data yet. Keep checking in, and observations will appear here over time.</div>`;
    return;
  }

  container.innerHTML = '';
  observations.forEach((obs, i) => {
    const el = document.createElement('div');
    el.className = 'observation-item';
    el.style.animationDelay = `${i * 0.15}s`;
    el.innerHTML = obs;
    container.appendChild(el);
  });
}

async function generateWeekObservations() {
  const observations = [];
  const checkIns = await getRecentCheckIns(7);
  const editorEntries = await getEditorEntries(7);
  const tasks = await getActiveTasks();
  const cycleDay = await getCurrentCycleDay();

  if (checkIns.length === 0) return observations;

  // Check-in frequency
  const days = new Set(checkIns.map(c => c.date)).size;
  observations.push(`You checked in <span class="obs-highlight">${days}</span> day${days !== 1 ? 's' : ''} this week.`);

  // Energy patterns
  const energies = checkIns.map(c => c.energy).filter(Boolean);
  if (energies.length > 0) {
    const lowDays = energies.filter(e => e === 'very-low' || e === 'low').length;
    const goodDays = energies.filter(e => e === 'good' || e === 'high').length;

    if (lowDays > goodDays && lowDays > 0) {
      observations.push(`Most days this week, your energy was on the <span class="obs-highlight">lower side</span>.`);
    } else if (goodDays > lowDays && goodDays > 0) {
      observations.push(`Energy has been <span class="obs-highlight">relatively good</span> this week.`);
    } else if (energies.length >= 3) {
      observations.push(`Your energy has been <span class="obs-highlight">mixed</span> this week — some low, some good.`);
    }
  }

  // Mood words
  const moods = checkIns.map(c => c.mood).filter(Boolean);
  if (moods.length > 0) {
    const moodStr = moods.slice(-3).map(m => `"${m}"`).join(', ');
    observations.push(`Recent mood words: ${moodStr}.`);
  }

  // Medication
  const meds = checkIns.map(c => c.medicationStatus).filter(Boolean);
  if (meds.length > 0) {
    const yesDays = meds.filter(m => m === 'yes').length;
    observations.push(`Medication was consistent on <span class="obs-highlight">${yesDays}</span> of ${meds.length} day${meds.length !== 1 ? 's' : ''} logged.`);
  }

  // Writing
  const recentEntries = editorEntries.filter(e => {
    const d = new Date(e.date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  });

  if (recentEntries.length > 0) {
    const totalWords = recentEntries.reduce((sum, e) => sum + (e.wordCount || 0), 0);
    observations.push(`You wrote <span class="obs-highlight">${recentEntries.length}</span> time${recentEntries.length !== 1 ? 's' : ''} this week. ${totalWords} words total.`);
  }

  // Cycle
  if (cycleDay !== null) {
    observations.push(`You're on <span class="obs-highlight">day ${cycleDay}</span> of your hormone cycle.`);
  }

  // Tasks
  const helpRequested = tasks.filter(t => t.helpRequested);
  if (helpRequested.length > 0) {
    observations.push(`You asked for help with <span class="obs-highlight">${helpRequested.length}</span> task${helpRequested.length !== 1 ? 's' : ''}.`);
  }

  return observations;
}

async function generateCycleObservations() {
  const observations = [];
  const cycleDay = await getCurrentCycleDay();
  const history = await getCycleHistory(3);

  if (cycleDay === null) {
    return ['No cycle data recorded yet. Cycle tracking begins when you log bleeding in a check-in.'];
  }

  observations.push(`Current cycle: <span class="obs-highlight">day ${cycleDay}</span>.`);

  if (history.length >= 2) {
    const lengths = history.filter(c => c.length).map(c => c.length);
    if (lengths.length > 0) {
      const lengthStr = lengths.join(', ');
      observations.push(`Recent cycle lengths: <span class="obs-highlight">${lengthStr}</span> days.`);
    }
  }

  // Look for energy patterns at similar cycle days
  const checkIns = await getRecentCheckIns(90);
  const similarDayCheckIns = checkIns.filter(c =>
    c.cycleDay !== null && Math.abs(c.cycleDay - cycleDay) <= 2
  );

  if (similarDayCheckIns.length >= 2) {
    const energies = similarDayCheckIns.map(c => c.energy).filter(Boolean);
    const lowCount = energies.filter(e => e === 'very-low' || e === 'low').length;
    if (lowCount > energies.length / 2) {
      observations.push(`Around this point in your cycle, energy tends to be <span class="obs-highlight">lower</span>.`);
    }

    const stimLevels = similarDayCheckIns.map(c => c.overstimulation).filter(Boolean);
    const highStim = stimLevels.filter(s => s === 'overstimulated' || s === 'overloaded').length;
    if (highStim > stimLevels.length / 3) {
      observations.push(`Overstimulation tends to be <span class="obs-highlight">elevated</span> around this cycle day.`);
    }
  }

  return observations;
}

async function generatePatternObservations() {
  const observations = [];
  const checkIns = await getRecentCheckIns(30);

  if (checkIns.length < 5) {
    return ['Keep checking in — patterns will emerge with more data.'];
  }

  // Day-of-week patterns
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayEnergies = {};

  checkIns.forEach(c => {
    if (!c.energy) return;
    const d = new Date(c.date).getDay();
    if (!dayEnergies[d]) dayEnergies[d] = [];
    dayEnergies[d].push(c.energy);
  });

  // Find lowest energy day
  let lowestDay = null;
  let lowestScore = Infinity;
  const energyScores = { 'very-low': 1, 'low': 2, 'moderate': 3, 'good': 4, 'high': 5 };

  for (const [day, energies] of Object.entries(dayEnergies)) {
    if (energies.length < 2) continue;
    const avg = energies.reduce((sum, e) => sum + (energyScores[e] || 3), 0) / energies.length;
    if (avg < lowestScore) {
      lowestScore = avg;
      lowestDay = parseInt(day);
    }
  }

  if (lowestDay !== null && lowestScore < 3) {
    observations.push(`Over the past month, <span class="obs-highlight">${dayNames[lowestDay]}s</span> tend to be your lowest energy day.`);
  }

  // Overstimulation → media choice patterns
  const overstimCheckIns = checkIns.filter(c =>
    c.overstimulation === 'overstimulated' || c.overstimulation === 'overloaded'
  );
  if (overstimCheckIns.length >= 2) {
    const intentions = overstimCheckIns.map(c => c.eveningIntention).filter(Boolean);
    if (intentions.length > 0) {
      observations.push(`When overstimulated, you've most often chosen: <span class="obs-highlight">"${intentions[0]}"</span>.`);
    }
  }

  // Medication consistency
  const medCheckIns = checkIns.filter(c => c.medicationStatus && c.medicationStatus !== 'na');
  if (medCheckIns.length >= 5) {
    const consistent = medCheckIns.filter(c => c.medicationStatus === 'yes').length;
    observations.push(`Medication was consistent on <span class="obs-highlight">${consistent}</span> of ${medCheckIns.length} days logged this month.`);
  }

  // Check-in frequency
  const uniqueDays = new Set(checkIns.map(c => c.date)).size;
  observations.push(`You checked in <span class="obs-highlight">${uniqueDays}</span> days over the past month.`);

  // Writing patterns
  const entries = await getEditorEntries(30);
  if (entries.length > 0) {
    observations.push(`You wrote <span class="obs-highlight">${entries.length}</span> time${entries.length !== 1 ? 's' : ''} in the past month.`);
  }

  return observations;
}
