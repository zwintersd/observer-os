/**
 * Window Manager — handles window lifecycle, dragging, focus, minimize/maximize/close
 */

let zIndexCounter = 100;
const openWindows = new Map(); // appId -> { element, state, config }

const APP_CONFIGS = {
  checkin: {
    title: 'Check-In.exe',
    icon: '🌙',
    template: 'checkin-content',
    defaultSize: { width: 560, height: 520 },
    defaultPos: { x: 120, y: 60 },
  },
  editor: {
    title: 'Editor.exe',
    icon: '✎',
    template: 'editor-content',
    defaultSize: { width: 640, height: 500 },
    defaultPos: { x: 180, y: 40 },
  },
  buddy: {
    title: 'Buddy.exe',
    icon: '❋',
    template: 'buddy-content',
    defaultSize: { width: 240, height: 280 },
    defaultPos: { x: 900, y: 400 },
  },
  queue: {
    title: 'Queue.exe',
    icon: '♫',
    template: 'queue-content',
    defaultSize: { width: 520, height: 480 },
    defaultPos: { x: 200, y: 80 },
  },
  tasks: {
    title: 'Tasks.exe',
    icon: '◻',
    template: 'tasks-content',
    defaultSize: { width: 440, height: 420 },
    defaultPos: { x: 240, y: 100 },
  },
  reflect: {
    title: 'Reflect.exe',
    icon: '◈',
    template: 'reflect-content',
    defaultSize: { width: 500, height: 460 },
    defaultPos: { x: 260, y: 70 },
  },
  notes: {
    title: 'Notes.exe',
    icon: '▤',
    template: 'notes-content',
    defaultSize: { width: 380, height: 360 },
    defaultPos: { x: 300, y: 120 },
  },
  sounds: {
    title: 'Sounds.exe',
    icon: '♪',
    template: 'sounds-content',
    defaultSize: { width: 320, height: 340 },
    defaultPos: { x: 700, y: 200 },
  },
};

export function getAppConfig(appId) {
  return APP_CONFIGS[appId];
}

export function isWindowOpen(appId) {
  return openWindows.has(appId);
}

export function getOpenWindows() {
  return openWindows;
}

export function openWindow(appId, onInit) {
  if (openWindows.has(appId)) {
    const win = openWindows.get(appId);
    if (win.state === 'minimized') {
      restoreWindow(appId);
    }
    focusWindow(appId);
    return win.element;
  }

  const config = APP_CONFIGS[appId];
  if (!config) return null;

  const template = document.getElementById('window-template');
  const clone = template.content.cloneNode(true);
  const windowEl = clone.querySelector('.os-window');

  // Set up window
  windowEl.dataset.app = appId;
  windowEl.querySelector('.window-icon').textContent = config.icon;
  windowEl.querySelector('.window-name').textContent = config.title;

  // Load content from template
  const contentTemplate = document.getElementById(config.template);
  if (contentTemplate) {
    const content = contentTemplate.content.cloneNode(true);
    windowEl.querySelector('.window-body').appendChild(content);
  }

  // Position and size
  const pos = config.defaultPos;
  const size = config.defaultSize;
  // Add slight random offset to avoid exact stacking
  const offsetX = (openWindows.size % 5) * 20;
  const offsetY = (openWindows.size % 5) * 20;

  windowEl.style.left = `${pos.x + offsetX}px`;
  windowEl.style.top = `${pos.y + offsetY}px`;
  windowEl.style.width = `${size.width}px`;
  windowEl.style.height = `${size.height}px`;

  // Add resize handle
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'resize-handle';
  windowEl.appendChild(resizeHandle);

  // Add to desktop
  document.getElementById('desktop').appendChild(windowEl);

  // Register
  openWindows.set(appId, {
    element: windowEl,
    state: 'normal',
    config,
  });

  // Focus
  focusWindow(appId);

  // Set up event listeners
  setupWindowControls(appId, windowEl);
  setupDrag(appId, windowEl);
  setupResize(appId, windowEl, resizeHandle);

  // Update taskbar
  updateTaskbarState(appId, true);

  // Click to focus
  windowEl.addEventListener('mousedown', () => focusWindow(appId));

  // Call init callback
  if (onInit) onInit(windowEl);

  return windowEl;
}

export function closeWindow(appId) {
  const win = openWindows.get(appId);
  if (!win) return;

  win.element.style.animation = 'none';
  win.element.style.opacity = '0';
  win.element.style.transform = 'scale(0.95)';
  win.element.style.transition = 'opacity 0.2s, transform 0.2s';

  setTimeout(() => {
    win.element.remove();
    openWindows.delete(appId);
    updateTaskbarState(appId, false);

    // Dispatch close event
    window.dispatchEvent(new CustomEvent('window-closed', { detail: { appId } }));
  }, 200);
}

export function minimizeWindow(appId) {
  const win = openWindows.get(appId);
  if (!win) return;

  win.state = 'minimized';
  win.element.classList.add('minimized');
  updateTaskbarState(appId, true);
}

export function restoreWindow(appId) {
  const win = openWindows.get(appId);
  if (!win) return;

  win.state = 'normal';
  win.element.classList.remove('minimized', 'maximized');
  focusWindow(appId);
}

export function maximizeWindow(appId) {
  const win = openWindows.get(appId);
  if (!win) return;

  if (win.state === 'maximized') {
    win.state = 'normal';
    win.element.classList.remove('maximized');
  } else {
    win.state = 'maximized';
    win.element.classList.add('maximized');
  }
}

export function focusWindow(appId) {
  // Remove focus from all
  for (const [id, win] of openWindows) {
    win.element.classList.remove('focused');
    const btn = document.querySelector(`.taskbar-app[data-app="${id}"]`);
    if (btn) btn.classList.remove('active');
  }

  const win = openWindows.get(appId);
  if (!win) return;

  zIndexCounter++;
  win.element.style.zIndex = zIndexCounter;
  win.element.classList.add('focused');

  const btn = document.querySelector(`.taskbar-app[data-app="${appId}"]`);
  if (btn) btn.classList.add('active');
}

function setupWindowControls(appId, windowEl) {
  const closeBtn = windowEl.querySelector('.win-close');
  const minBtn = windowEl.querySelector('.win-minimize');
  const maxBtn = windowEl.querySelector('.win-maximize');

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeWindow(appId);
  });

  minBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    minimizeWindow(appId);
  });

  maxBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    maximizeWindow(appId);
  });

  // Double-click titlebar to maximize
  const titlebar = windowEl.querySelector('.window-titlebar');
  titlebar.addEventListener('dblclick', () => maximizeWindow(appId));
}

function setupDrag(appId, windowEl) {
  const titlebar = windowEl.querySelector('.window-titlebar');
  let isDragging = false;
  let startX, startY, startLeft, startTop;

  titlebar.addEventListener('mousedown', (e) => {
    if (e.target.closest('.window-controls')) return;

    const win = openWindows.get(appId);
    if (win?.state === 'maximized') return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = windowEl.offsetLeft;
    startTop = windowEl.offsetTop;
    windowEl.style.transition = 'none';

    focusWindow(appId);
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    windowEl.style.left = `${startLeft + dx}px`;
    windowEl.style.top = `${startTop + dy}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      windowEl.style.transition = '';
    }
  });
}

function setupResize(appId, windowEl, handle) {
  let isResizing = false;
  let startX, startY, startW, startH;

  handle.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    const win = openWindows.get(appId);
    if (win?.state === 'maximized') return;

    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startW = windowEl.offsetWidth;
    startH = windowEl.offsetHeight;
    windowEl.style.transition = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const newW = Math.max(320, startW + dx);
    const newH = Math.max(200, startH + dy);

    windowEl.style.width = `${newW}px`;
    windowEl.style.height = `${newH}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      windowEl.style.transition = '';
    }
  });
}

function updateTaskbarState(appId, isOpen) {
  const btn = document.querySelector(`.taskbar-app[data-app="${appId}"]`);
  if (!btn) return;

  if (isOpen) {
    btn.classList.add('has-window');
  } else {
    btn.classList.remove('has-window', 'active');
  }
}

export function toggleWindow(appId, onInit) {
  if (openWindows.has(appId)) {
    const win = openWindows.get(appId);
    if (win.state === 'minimized') {
      restoreWindow(appId);
    } else {
      const focused = win.element.classList.contains('focused');
      if (focused) {
        minimizeWindow(appId);
      } else {
        focusWindow(appId);
      }
    }
  } else {
    openWindow(appId, onInit);
  }
}
