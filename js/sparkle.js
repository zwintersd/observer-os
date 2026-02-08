/**
 * Sparkle Trail on Cursor
 * Signature visual — soft sparkles follow the cursor.
 */

const canvas = document.getElementById('sparkle-canvas');
const ctx = canvas?.getContext('2d');

let sparkles = [];
let mouseX = 0;
let mouseY = 0;
let animFrame = null;

const SPARKLE_COLORS = [
  'rgba(212, 200, 239, ',  // lavender
  'rgba(232, 192, 212, ',  // pink
  'rgba(123, 196, 184, ',  // teal
  'rgba(232, 224, 240, ',  // warm white
];

class Sparkle {
  constructor(x, y) {
    this.x = x + (Math.random() - 0.5) * 10;
    this.y = y + (Math.random() - 0.5) * 10;
    this.size = Math.random() * 3 + 1;
    this.speedX = (Math.random() - 0.5) * 1.5;
    this.speedY = (Math.random() - 0.5) * 1.5 - 0.5;
    this.life = 1;
    this.decay = Math.random() * 0.02 + 0.015;
    this.color = SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)];
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.1;
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.speedY += 0.02; // gentle gravity
    this.life -= this.decay;
    this.rotation += this.rotSpeed;
    this.size *= 0.99;
  }

  draw() {
    if (this.life <= 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = this.life;

    // Draw a four-pointed star
    const s = this.size;
    ctx.beginPath();
    ctx.moveTo(0, -s * 2);
    ctx.lineTo(s * 0.4, -s * 0.4);
    ctx.lineTo(s * 2, 0);
    ctx.lineTo(s * 0.4, s * 0.4);
    ctx.lineTo(0, s * 2);
    ctx.lineTo(-s * 0.4, s * 0.4);
    ctx.lineTo(-s * 2, 0);
    ctx.lineTo(-s * 0.4, -s * 0.4);
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
const SPAWN_INTERVAL = 50; // ms between spawns

function resizeCanvas() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function animate(timestamp) {
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Spawn new sparkles
  if (timestamp - lastSpawn > SPAWN_INTERVAL) {
    sparkles.push(new Sparkle(mouseX, mouseY));
    if (Math.random() > 0.5) {
      sparkles.push(new Sparkle(mouseX, mouseY));
    }
    lastSpawn = timestamp;
  }

  // Update and draw
  for (let i = sparkles.length - 1; i >= 0; i--) {
    sparkles[i].update();
    sparkles[i].draw();
    if (sparkles[i].isDead()) {
      sparkles.splice(i, 1);
    }
  }

  // Cap sparkle count
  if (sparkles.length > 80) {
    sparkles = sparkles.slice(-60);
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
