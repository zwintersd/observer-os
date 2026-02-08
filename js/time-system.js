/**
 * Time Externalization System
 * Relational time display, evening phase management, gentle transition nudges.
 */

import { getSetting } from './db.js';
import { setPhase, applyTimeShift } from './ambient.js';

let checkInTime = null; // when user completed check-in
let currentIntention = null;
let intentionStartTime = null;
let phaseInterval = null;

const PHASES = ['arrival', 'settling', 'active', 'winddown', 'rest'];

export function setCheckInTime(time) {
  checkInTime = time || new Date();
}

export function setCurrentIntention(intention) {
  currentIntention = intention;
  intentionStartTime = new Date();
}

export function getCheckInTime() {
  return checkInTime;
}

function formatRelativeTime(minutes) {
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${Math.round(minutes)} minutes ago`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${hours}h ${mins}m ago`;
}

function formatTimeLeft(minutes) {
  if (minutes < 1) return 'any moment now';
  if (minutes < 60) return `about ${Math.round(minutes)} minutes`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins < 10) return `about ${hours} hour${hours > 1 ? 's' : ''}`;
  return `about ${hours}h ${mins}m`;
}

function formatClock(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export async function determinePhase() {
  const now = new Date();
  const hour = now.getHours();
  const bedtimeStr = await getSetting('typicalBedtime') || '22:30';
  const [bedH] = bedtimeStr.split(':').map(Number);

  const winddownStart = bedH - 1.5;

  if (!checkInTime) return 'arrival';
  const minsSinceCheckIn = (now - checkInTime) / 60000;

  if (minsSinceCheckIn < 30) return 'settling';
  if (hour >= bedH) return 'rest';
  if (hour >= winddownStart) return 'winddown';
  return 'active';
}

export async function updateTimeDisplay() {
  const now = new Date();
  const relationalEl = document.getElementById('time-relational');
  const clockEl = document.getElementById('time-clock');
  const trayClockEl = document.getElementById('tray-clock');
  const trayPhaseEl = document.getElementById('tray-phase');

  // Clock displays
  const clockStr = formatClock(now);
  if (clockEl) clockEl.textContent = clockStr;
  if (trayClockEl) trayClockEl.textContent = clockStr;

  // Relational time
  if (relationalEl) {
    const lines = [];

    if (checkInTime) {
      const minsSince = (now - checkInTime) / 60000;
      lines.push(`Checked in ${formatRelativeTime(minsSince)}`);
    }

    if (currentIntention && intentionStartTime) {
      const minsDoing = (now - intentionStartTime) / 60000;
      if (minsDoing >= 1) {
        lines.push(`${Math.round(minsDoing)}m into your evening`);
      }
    }

    // Time until bedtime
    const bedtimeStr = await getSetting('typicalBedtime') || '22:30';
    const [bedH, bedM] = bedtimeStr.split(':').map(Number);
    const bedtime = new Date(now);
    bedtime.setHours(bedH, bedM, 0, 0);

    if (bedtime > now) {
      const minsLeft = (bedtime - now) / 60000;
      lines.push(`${formatTimeLeft(minsLeft)} of evening left`);
    }

    relationalEl.innerHTML = lines.join('<br>');
  }

  // Phase
  const phase = await determinePhase();
  setPhase(phase);
  applyTimeShift(now.getHours());

  if (trayPhaseEl) {
    const phaseLabels = {
      arrival: '☽ arriving',
      settling: '☽ settling in',
      active: '☽ evening',
      winddown: '☽ winding down',
      rest: '☽ rest',
    };
    trayPhaseEl.textContent = phaseLabels[phase] || '';
  }
}

export function startTimeSystem() {
  updateTimeDisplay();
  phaseInterval = setInterval(updateTimeDisplay, 30000); // every 30 seconds
}

export function stopTimeSystem() {
  if (phaseInterval) clearInterval(phaseInterval);
}
