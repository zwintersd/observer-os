/**
 * Buddy.exe — The ambient companion
 * Buddy's state reflects the system's state, not the user's performance.
 * Buddy is a presence, not a reward system.
 */

let currentState = 'waiting';
let windowEl = null;

const BUDDY_STATES = {
  'waiting': {
    art: [
      '        ',
      '  (@•‿•@)  ',
      '  /|    |\\  ',
      '   |    |   ',
      '  _|    |_  ',
    ],
    status: 'Waiting for you...',
  },
  'attentive': {
    art: [
      '        ',
      '  (@•◡•@)  ',
      '  /|    |\\  ',
      '   |    |   ',
      '  _|    |_  ',
    ],
    status: 'Listening...',
  },
  'checked-in': {
    art: [
      '    ✦     ',
      '  (@•‿•@)  ',
      '  /|    |\\  ',
      '   | ♡  |   ',
      '  _|    |_  ',
    ],
    status: 'Cozy evening...',
  },
  'relaxed': {
    art: [
      '        ',
      '  (@•‿•@)  ',
      '   \\    /   ',
      '    \\  /    ',
      '    _||_    ',
    ],
    status: 'Just vibing...',
  },
  'reading': {
    art: [
      '        ',
      '  (@•_•@)  ',
      '  /| 📖|\\  ',
      '   |    |   ',
      '  _|    |_  ',
    ],
    status: 'Reading alongside you...',
  },
  'cozy': {
    art: [
      '   ~ ~ ~   ',
      '  (@•‿•@)  ',
      ' ╔════════╗',
      ' ║ ░░░░░░ ║',
      ' ╚════════╝',
    ],
    status: 'Cozy with a blanket...',
  },
  'sleepy': {
    art: [
      '    z z z  ',
      '  (@-_-@)  ',
      '   \\    /   ',
      '    \\  /    ',
      '   _/  \\_   ',
    ],
    status: 'Getting sleepy...',
  },
  'vibing': {
    art: [
      '        ',
      '  (@•‿•@)  ',
      '   \\    /   ',
      '    |  |    ',
      '   _|  |_   ',
    ],
    status: 'Just existing...',
  },
};

export function initBuddy(winEl) {
  windowEl = winEl;
  render();
}

export function setBuddyState(state) {
  if (BUDDY_STATES[state]) {
    currentState = state;
  }
  render();
}

export function getBuddyState() {
  return currentState;
}

/**
 * Update buddy based on system phase
 */
export function updateBuddyForPhase(phase) {
  switch (phase) {
    case 'arrival':
      if (currentState === 'waiting' || currentState === 'vibing') {
        setBuddyState('waiting');
      }
      break;
    case 'settling':
      if (currentState !== 'reading') {
        setBuddyState('checked-in');
      }
      break;
    case 'active':
      if (currentState !== 'reading') {
        setBuddyState('relaxed');
      }
      break;
    case 'winddown':
      setBuddyState('cozy');
      break;
    case 'rest':
      setBuddyState('sleepy');
      break;
  }
}

/**
 * Update buddy when user is writing
 */
export function setBuddyWriting(isWriting) {
  if (isWriting) {
    setBuddyState('reading');
  } else {
    // Revert based on time
    const hour = new Date().getHours();
    if (hour >= 22) setBuddyState('sleepy');
    else if (hour >= 21) setBuddyState('cozy');
    else setBuddyState('relaxed');
  }
}

function render() {
  if (!windowEl) return;

  const artEl = windowEl.querySelector('#buddy-art');
  const statusEl = windowEl.querySelector('#buddy-status');

  if (!artEl || !statusEl) return;

  const state = BUDDY_STATES[currentState] || BUDDY_STATES.vibing;

  artEl.textContent = state.art.join('\n');
  statusEl.textContent = state.status;
}

// Also allow rendering in any buddy container (for re-opened windows)
export function renderBuddyIn(container) {
  windowEl = container;
  render();
}
