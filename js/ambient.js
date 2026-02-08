/**
 * Ambient Background System
 * Shifts colors based on time of day, evening phase, and cycle day.
 * Renders soft floating particles on the background canvas.
 */

const canvas = document.getElementById('ambient-canvas');
const ctx = canvas?.getContext('2d');
const root = document.documentElement;

let particles = [];
let animFrame = null;

// Evening phases mapped to visual states
const PHASE_VISUALS = {
  arrival: {
    hue: 260,
    saturation: 30,
    lightness: 14,
    particleColor: 'rgba(184, 169, 212, 0.15)',
    particleSpeed: 0.3,
  },
  settling: {
    hue: 265,
    saturation: 28,
    lightness: 13,
    particleColor: 'rgba(184, 169, 212, 0.12)',
    particleSpeed: 0.25,
  },
  active: {
    hue: 270,
    saturation: 25,
    lightness: 12,
    particleColor: 'rgba(184, 169, 212, 0.1)',
    particleSpeed: 0.2,
  },
  winddown: {
    hue: 275,
    saturation: 22,
    lightness: 10,
    particleColor: 'rgba(212, 160, 180, 0.08)',
    particleSpeed: 0.15,
  },
  rest: {
    hue: 280,
    saturation: 20,
    lightness: 7,
    particleColor: 'rgba(212, 160, 180, 0.05)',
    particleSpeed: 0.1,
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
    this.size = Math.random() * 3 + 1;
    this.speedX = (Math.random() - 0.5) * 0.3;
    this.speedY = (Math.random() - 0.5) * 0.2 - 0.1;
    this.opacity = Math.random() * 0.5 + 0.1;
    this.pulse = Math.random() * Math.PI * 2;
    this.pulseSpeed = Math.random() * 0.01 + 0.005;
  }

  update(speed) {
    this.x += this.speedX * speed;
    this.y += this.speedY * speed;
    this.pulse += this.pulseSpeed;

    // Wrap around
    if (this.x < -10) this.x = canvas.width + 10;
    if (this.x > canvas.width + 10) this.x = -10;
    if (this.y < -10) this.y = canvas.height + 10;
    if (this.y > canvas.height + 10) this.y = -10;
  }

  draw(color) {
    const pulsedOpacity = this.opacity * (0.5 + 0.5 * Math.sin(this.pulse));
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = color.replace(/[\d.]+\)$/, `${pulsedOpacity})`);
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
  const count = Math.floor((canvas.width * canvas.height) / 15000);
  for (let i = 0; i < Math.min(count, 60); i++) {
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
  const t = 0.005;
  currentVisuals.hue = lerp(currentVisuals.hue, targetVisuals.hue, t);
  currentVisuals.saturation = lerp(currentVisuals.saturation, targetVisuals.saturation, t);
  currentVisuals.lightness = lerp(currentVisuals.lightness, targetVisuals.lightness, t);
  currentVisuals.particleSpeed = lerp(currentVisuals.particleSpeed, targetVisuals.particleSpeed, t);

  // Update CSS variables
  root.style.setProperty('--ambient-hue', Math.round(currentVisuals.hue));
  root.style.setProperty('--ambient-saturation', `${Math.round(currentVisuals.saturation)}%`);
  root.style.setProperty('--ambient-lightness', `${Math.round(currentVisuals.lightness)}%`);

  // Draw particles
  for (const p of particles) {
    p.update(currentVisuals.particleSpeed);
    p.draw(targetVisuals.particleColor);
  }

  animFrame = requestAnimationFrame(animate);
}

export function setPhase(phase) {
  if (PHASE_VISUALS[phase]) {
    currentPhase = phase;
    targetVisuals = PHASE_VISUALS[phase];
  }
}

export function getPhase() {
  return currentPhase;
}

// Apply time-of-day adjustments on top of phase
export function applyTimeShift(hour) {
  // After 9pm, shift warmer
  if (hour >= 21) {
    targetVisuals = {
      ...PHASE_VISUALS[currentPhase],
      hue: PHASE_VISUALS[currentPhase].hue + 10,
      saturation: PHASE_VISUALS[currentPhase].saturation - 5,
      lightness: Math.max(5, PHASE_VISUALS[currentPhase].lightness - 3),
    };
  }
  // After 10pm, even dimmer
  if (hour >= 22) {
    targetVisuals = {
      ...targetVisuals,
      lightness: Math.max(4, targetVisuals.lightness - 3),
      particleSpeed: targetVisuals.particleSpeed * 0.7,
    };
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
