/**
 * Ambient Background System — Pastel Edition
 * Renders soft floating particles (like dust motes / pollen) over the bg image.
 * Shifts overlay opacity based on time of day and evening phase.
 */

const canvas = document.getElementById('ambient-canvas');
const ctx = canvas?.getContext('2d');
const root = document.documentElement;
const bgEl = document.getElementById('ambient-bg');

let particles = [];
let animFrame = null;

// Evening phases — controls overlay dimming and particle behavior
const PHASE_VISUALS = {
  arrival: {
    overlayOpacity: 0.05,
    filterBrightness: 1.0,
    particleColor: 'rgba(255, 230, 240, ',
    particleSpeed: 0.25,
    particleGlow: true,
  },
  settling: {
    overlayOpacity: 0.1,
    filterBrightness: 0.97,
    particleColor: 'rgba(240, 210, 230, ',
    particleSpeed: 0.2,
    particleGlow: true,
  },
  active: {
    overlayOpacity: 0.15,
    filterBrightness: 0.93,
    particleColor: 'rgba(200, 184, 224, ',
    particleSpeed: 0.18,
    particleGlow: true,
  },
  winddown: {
    overlayOpacity: 0.3,
    filterBrightness: 0.82,
    particleColor: 'rgba(210, 190, 230, ',
    particleSpeed: 0.12,
    particleGlow: false,
  },
  rest: {
    overlayOpacity: 0.5,
    filterBrightness: 0.65,
    particleColor: 'rgba(190, 170, 210, ',
    particleSpeed: 0.08,
    particleGlow: false,
  },
};

let currentPhase = 'arrival';
let targetVisuals = PHASE_VISUALS.arrival;
let currentVisuals = { ...PHASE_VISUALS.arrival };

class Particle {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 2.5 + 0.8;
    this.speedX = (Math.random() - 0.5) * 0.25;
    this.speedY = (Math.random() - 0.5) * 0.15 - 0.08; // gentle drift upward
    this.opacity = Math.random() * 0.4 + 0.15;
    this.pulse = Math.random() * Math.PI * 2;
    this.pulseSpeed = Math.random() * 0.008 + 0.003;
    this.twinkle = Math.random() > 0.85; // some particles sparkle
  }

  update(speed) {
    this.x += this.speedX * speed;
    this.y += this.speedY * speed;
    this.pulse += this.pulseSpeed;

    if (this.x < -10) this.x = canvas.width + 10;
    if (this.x > canvas.width + 10) this.x = -10;
    if (this.y < -10) this.y = canvas.height + 10;
    if (this.y > canvas.height + 10) this.y = -10;
  }

  draw(color, glow) {
    const pulsedOpacity = this.opacity * (0.5 + 0.5 * Math.sin(this.pulse));

    if (glow && this.twinkle) {
      // Soft glow around twinkle particles
      const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 4);
      gradient.addColorStop(0, color + `${pulsedOpacity * 0.5})`);
      gradient.addColorStop(1, color + '0)');
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 4, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = color + `${pulsedOpacity})`;
    ctx.fill();
  }
}

function resizeCanvas() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function initParticles() {
  particles = [];
  const count = Math.floor((canvas.width * canvas.height) / 20000);
  for (let i = 0; i < Math.min(count, 50); i++) {
    particles.push(new Particle());
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function animate() {
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Smooth transition toward target visuals
  const t = 0.003;
  currentVisuals.overlayOpacity = lerp(currentVisuals.overlayOpacity, targetVisuals.overlayOpacity, t);
  currentVisuals.filterBrightness = lerp(currentVisuals.filterBrightness, targetVisuals.filterBrightness, t);
  currentVisuals.particleSpeed = lerp(currentVisuals.particleSpeed, targetVisuals.particleSpeed, t);

  // Update CSS ambient overlay
  root.style.setProperty('--ambient-opacity', currentVisuals.overlayOpacity.toFixed(3));

  // Dim the background image via filter
  if (bgEl) {
    bgEl.style.filter = `brightness(${currentVisuals.filterBrightness.toFixed(3)})`;
  }

  // Draw particles
  for (const p of particles) {
    p.update(currentVisuals.particleSpeed);
    p.draw(targetVisuals.particleColor, targetVisuals.particleGlow);
  }

  animFrame = requestAnimationFrame(animate);
}

export function setPhase(phase) {
  if (PHASE_VISUALS[phase]) {
    currentPhase = phase;
    targetVisuals = { ...PHASE_VISUALS[phase] };
  }
}

export function getPhase() {
  return currentPhase;
}

export function applyTimeShift(hour) {
  // Late evening — dim further and warm the overlay
  if (hour >= 21) {
    targetVisuals.overlayOpacity = Math.max(targetVisuals.overlayOpacity, 0.25);
    targetVisuals.filterBrightness = Math.min(targetVisuals.filterBrightness, 0.85);
  }
  if (hour >= 22) {
    targetVisuals.overlayOpacity = Math.max(targetVisuals.overlayOpacity, 0.4);
    targetVisuals.filterBrightness = Math.min(targetVisuals.filterBrightness, 0.7);
    targetVisuals.particleSpeed *= 0.6;
  }
  if (hour >= 23) {
    targetVisuals.overlayOpacity = Math.max(targetVisuals.overlayOpacity, 0.55);
    targetVisuals.filterBrightness = Math.min(targetVisuals.filterBrightness, 0.55);
  }
}

export function initAmbient() {
  if (!canvas) return;
  resizeCanvas();
  initParticles();

  window.addEventListener('resize', () => {
    resizeCanvas();
    initParticles();
  });

  // Determine initial phase from time
  const hour = new Date().getHours();
  if (hour < 18) {
    setPhase('arrival');
  } else if (hour < 19) {
    setPhase('settling');
  } else if (hour < 21) {
    setPhase('active');
  } else if (hour < 22) {
    setPhase('winddown');
  } else {
    setPhase('rest');
  }

  applyTimeShift(hour);
  animate();
}

export function destroyAmbient() {
  if (animFrame) cancelAnimationFrame(animFrame);
}
