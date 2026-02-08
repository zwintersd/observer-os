/**
 * Sparkle Trail on Cursor — Pastel Edition
 * Soft pastel four-pointed stars with glow that drift and fade.
 */

const canvas = document.getElementById('sparkle-canvas');
const ctx = canvas?.getContext('2d');

let sparkles = [];
let mouseX = 0;
let mouseY = 0;
let animFrame = null;

// Pastel sparkle colors matching the dreamy pixel art bg
const SPARKLE_COLORS = [
  'rgba(236, 190, 212, ',  // pink
  'rgba(200, 184, 224, ',  // lavender
  'rgba(168, 180, 216, ',  // periwinkle
  'rgba(160, 216, 196, ',  // mint
  'rgba(255, 220, 230, ',  // soft rose
  'rgba(255, 248, 252, ',  // cream white
];

class Sparkle {
  constructor(x, y) {
    this.x = x + (Math.random() - 0.5) * 12;
    this.y = y + (Math.random() - 0.5) * 12;
    this.size = Math.random() * 3.5 + 1.5;
    this.speedX = (Math.random() - 0.5) * 1.2;
    this.speedY = (Math.random() - 0.5) * 1.2 - 0.4;
    this.life = 1;
    this.decay = Math.random() * 0.018 + 0.012;
    this.color = SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)];
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.08;
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.speedY += 0.015; // very gentle gravity
    this.life -= this.decay;
    this.rotation += this.rotSpeed;
    this.size *= 0.995;
  }

  draw() {
    if (this.life <= 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = this.life * 0.8;

    const s = this.size;

    // Soft glow behind the star
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 3);
    glow.addColorStop(0, this.color + `${this.life * 0.25})`);
    glow.addColorStop(1, this.color + '0)');
    ctx.beginPath();
    ctx.arc(0, 0, s * 3, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Four-pointed star with curved edges
    ctx.beginPath();
    ctx.moveTo(0, -s * 2);
    ctx.quadraticCurveTo(s * 0.3, -s * 0.3, s * 2, 0);
    ctx.quadraticCurveTo(s * 0.3, s * 0.3, 0, s * 2);
    ctx.quadraticCurveTo(-s * 0.3, s * 0.3, -s * 2, 0);
    ctx.quadraticCurveTo(-s * 0.3, -s * 0.3, 0, -s * 2);
    ctx.closePath();

    ctx.fillStyle = this.color + `${this.life})`;
    ctx.fill();

    ctx.restore();
  }

  isDead() {
    return this.life <= 0;
  }
}

let lastSpawn = 0;
const SPAWN_INTERVAL = 45;

function resizeCanvas() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function animate(timestamp) {
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (timestamp - lastSpawn > SPAWN_INTERVAL) {
    sparkles.push(new Sparkle(mouseX, mouseY));
    if (Math.random() > 0.4) {
      sparkles.push(new Sparkle(mouseX, mouseY));
    }
    lastSpawn = timestamp;
  }

  for (let i = sparkles.length - 1; i >= 0; i--) {
    sparkles[i].update();
    sparkles[i].draw();
    if (sparkles[i].isDead()) {
      sparkles.splice(i, 1);
    }
  }

  if (sparkles.length > 100) {
    sparkles = sparkles.slice(-80);
  }

  animFrame = requestAnimationFrame(animate);
}

export function initSparkle() {
  if (!canvas) return;
  resizeCanvas();

  window.addEventListener('resize', resizeCanvas);

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  animFrame = requestAnimationFrame(animate);
}

export function destroySparkle() {
  if (animFrame) cancelAnimationFrame(animFrame);
}
