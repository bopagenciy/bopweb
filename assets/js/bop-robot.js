/**
 * BOP AGENCIA — Módulo Robot Interactivo Desacoplado
 * Renderizado en Canvas 2D con interpolación física LERP
 * Soporta Desktop (cursor X), Mobile (touch scrub), e Idle Animation
 */
class BopRobot {
  constructor(options = {}) {
    this.container = document.getElementById(options.containerId || 'robotContainer');
    this.canvas = document.getElementById(options.canvasId || 'robotCanvas');
    this.initialImg = document.getElementById(options.initialImgId || 'robotInitial');
    
    this.totalFrames = options.totalFrames || 49;
    this.centerFrame = options.centerFrame || 24;
    this.basePath = options.basePath || 'assets/media/robot-sequence/frame_';
    this.lerpSpeed = options.lerpSpeed || 0.085;
    this.idleDelayMs = options.idleDelayMs || 2200;

    if (!this.canvas) {
      console.warn('BopRobot: Canvas no encontrado');
      return;
    }

    this.ctx = this.canvas.getContext('2d', { alpha: true });
    this.frames = new Array(this.totalFrames);
    this.loadedCount = 0;
    this.isReady = false;

    // Estado de orientación
    this.targetRatio = 0.5; // 0.0 = Izquierda, 0.5 = Centro, 1.0 = Derecha
    this.targetFrame = this.centerFrame;
    this.currentFrame = this.centerFrame;

    // Estado de interacción
    this.isInteracting = false;
    this.lastInteraction = performance.now();
    this.idleAccumulator = 0;
    this.rafId = null;
    this.reducedMotionQuery = window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : { matches: false };

    this.init();
  }

  init() {
    this.setupInitialFrame();
    this.bindEvents();
    // Diferir la precarga de los 48 frames secundarios tras el render inicial para no competir con LCP
    if (document.readyState === 'complete') {
      setTimeout(() => this.preloadFrames(), 60);
    } else {
      window.addEventListener('load', () => {
        setTimeout(() => this.preloadFrames(), 60);
      }, { once: true });
    }
    this.startLoop();
  }

  setupInitialFrame() {
    if (this.initialImg) {
      if (this.initialImg.complete && this.initialImg.naturalWidth > 0) {
        this.frames[this.centerFrame] = this.initialImg;
        this.loadedCount = 1;
        this.drawFrame(this.centerFrame);
      } else {
        this.initialImg.addEventListener('load', () => {
          this.frames[this.centerFrame] = this.initialImg;
          this.loadedCount = Math.max(1, this.loadedCount);
          this.drawFrame(this.currentFrame);
        }, { once: true });
      }
    }
  }

  getFrameUrl(idx) {
    const padded = String(idx).padStart(2, '0');
    return `${this.basePath}${padded}.webp`;
  }

  preloadFrames() {
    if (this.preloadStarted) return;
    this.preloadStarted = true;
    // Carga progresiva en abanico desde el centro hacia los extremos
    const order = [];
    for (let offset = 1; offset < this.totalFrames; offset++) {
      if (this.centerFrame - offset >= 0) order.push(this.centerFrame - offset);
      if (this.centerFrame + offset < this.totalFrames) order.push(this.centerFrame + offset);
    }

    order.forEach((idx) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = this.getFrameUrl(idx);
      img.onload = () => {
        this.frames[idx] = img;
        this.loadedCount++;
        if (this.loadedCount >= this.totalFrames) {
          this.isReady = true;
          if (this.initialImg) {
            this.initialImg.style.opacity = '0';
          }
        }
      };
    });
  }

  setRatio(normalizedX) {
    this.isInteracting = true;
    this.lastInteraction = performance.now();
    this.targetRatio = Math.max(0, Math.min(1, normalizedX));
    // Mapeo corregido a la orientación visual real:
    // ratio = 0.0 (Izquierda de pantalla) -> Frame 48 (Robot mira hacia la izquierda)
    // ratio = 0.5 (Centro de pantalla)    -> Frame 24 (Robot mira al frente)
    // ratio = 1.0 (Derecha de pantalla)   -> Frame 00 (Robot mira hacia la derecha)
    this.targetFrame = (1 - this.targetRatio) * (this.totalFrames - 1);
  }

  bindEvents() {
    // Desktop mousemove
    window.addEventListener('mousemove', (e) => {
      const norm = e.clientX / window.innerWidth;
      this.setRatio(norm);
    }, { passive: true });

    // Touch events para mobile
    const handleTouch = (e) => {
      if (e.touches && e.touches.length > 0) {
        const norm = e.touches[0].clientX / window.innerWidth;
        this.setRatio(norm);
      }
    };

    window.addEventListener('touchstart', handleTouch, { passive: true });
    window.addEventListener('touchmove', handleTouch, { passive: true });
    window.addEventListener('touchend', () => {
      this.isInteracting = false;
      this.lastInteraction = performance.now();
    }, { passive: true });

    // En caso de cambio de tamaño de ventana
    window.addEventListener('resize', () => {
      this.drawFrame(this.currentFrame);
    }, { passive: true });
  }

  drawFrame(frameIdx) {
    const validIdx = Math.max(0, Math.min(this.totalFrames - 1, Math.round(frameIdx)));
    const img = this.frames[validIdx] || this.frames[this.centerFrame] || this.initialImg;

    if (img && img.complete && img.naturalWidth > 0) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
    }
  }

  startLoop() {
    const loop = (now) => {
      // Idle Animation: respiración sutil si no hay interacción y no se prefiere movimiento reducido
      const idleTime = now - this.lastInteraction;
      const reduceMotion = Boolean(this.reducedMotionQuery && this.reducedMotionQuery.matches);
      if (!this.isInteracting && !reduceMotion && idleTime > this.idleDelayMs) {
        this.idleAccumulator += 0.016;
        // Ondulación suave de baja amplitud (±15% del arco horizontal)
        const wave = Math.sin(this.idleAccumulator) * 0.16;
        this.targetRatio = 0.5 + wave;
        this.targetFrame = (1 - this.targetRatio) * (this.totalFrames - 1);
      }

      // Física LERP
      this.currentFrame += (this.targetFrame - this.currentFrame) * this.lerpSpeed;

      // Render
      this.drawFrame(this.currentFrame);

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
  }
}

// Exportar global para uso directo o en módulos
if (typeof window !== 'undefined') {
  window.BopRobot = BopRobot;
}
