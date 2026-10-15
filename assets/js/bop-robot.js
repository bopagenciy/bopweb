/**
 * BOP AGENCIA — Módulo Robot Interactivo Desacoplado
 * Renderizado en Canvas 2D con interpolación física LERP
 * Soporta Desktop (cursor X), Mobile (touch scrub), e Idle Animation
 * Carga progresiva en 2 etapas (Phase 11A.7):
 *   Etapa 1: Frame canónico 24 instantáneo + Ventana prioritaria 20..28 (máx 3 concurrentes)
 *   Etapa 2: Frames restantes tras reposo post-carga en idle callback (máx 3 concurrentes)
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

    // Control de concurrencia y carga progresiva en 2 etapas (Phase 11A.7)
    this.maxConcurrency = options.maxConcurrency || 3;
    this.activeRequests = 0;
    this.requestedFrames = new Set();
    this.priorityLoaded = false;
    this.isDestroyed = false;

    if (!this.canvas) {
      console.warn('BopRobot: Canvas no encontrado');
      return;
    }

    this.ctx = this.canvas.getContext('2d', { alpha: true });
    this.frames = new Array(this.totalFrames);
    this.loadedCount = 0;
    this.isReady = false;
    this.lastDrawnImg = null;

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

  scheduleIdle(fn, delayMs = 0) {
    const runInIdle = () => {
      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(fn, { timeout: 1500 });
      } else {
        setTimeout(fn, 50);
      }
    };

    if (delayMs > 0) {
      setTimeout(runInIdle, delayMs);
    } else {
      runInIdle();
    }
  }

  init() {
    this.setupInitialFrame();
    this.bindEvents();

    // Etapa 1: Iniciar carga de la pequeña ventana prioritaria (20..28) una vez interactivo el viewport
    const startStage1 = () => {
      this.scheduleIdle(() => {
        this.loadPriorityWindow();
      }, 250);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startStage1, { once: true });
    } else {
      startStage1();
    }

    this.startLoop();
  }

  setupInitialFrame() {
    if (this.initialImg) {
      this.requestedFrames.add(this.centerFrame);
      if (this.initialImg.complete && this.initialImg.naturalWidth > 0) {
        this.frames[this.centerFrame] = this.initialImg;
        this.loadedCount = Math.max(1, this.loadedCount);
        this.lastDrawnImg = this.initialImg;
        this.drawFrame(this.centerFrame);
      } else {
        this.initialImg.addEventListener('load', () => {
          this.frames[this.centerFrame] = this.initialImg;
          this.loadedCount = Math.max(1, this.loadedCount);
          this.lastDrawnImg = this.initialImg;
          this.drawFrame(this.currentFrame);
        }, { once: true });
      }
    }
  }

  getFrameUrl(idx) {
    const padded = String(idx).padStart(2, '0');
    return `${this.basePath}${padded}.webp`;
  }

  loadPriorityWindow() {
    if (this.isDestroyed) return;

    // Ventana de prioridad inmediata (frames 20 a 28, radio ±4 alrededor del centro)
    const priority = [23, 25, 22, 26, 21, 27, 20, 28];
    const needed = priority.filter(idx => !this.isFrameReady(idx) && !this.requestedFrames.has(idx));

    if (needed.length === 0) {
      this.onPriorityComplete();
      return;
    }

    let remainingInPriority = needed.length;
    const pumpPriority = () => {
      if (this.isDestroyed) return;
      while (this.activeRequests < this.maxConcurrency && needed.length > 0) {
        const idx = needed.shift();
        this.fetchFrame(idx, () => {
          remainingInPriority--;
          if (remainingInPriority <= 0) {
            this.onPriorityComplete();
          } else {
            this.scheduleIdle(pumpPriority, 0);
          }
        });
      }
    };

    pumpPriority();
  }

  onPriorityComplete() {
    this.priorityLoaded = true;

    // Etapa 2: Esperar a que la página complete su ciclo de carga (window.load)
    // y un reposo prudencial de 1.2 segundos antes de descargar los frames secundarios periféricos
    const startStage2 = () => {
      this.scheduleIdle(() => {
        this.pumpRemainingFrames();
      }, 1200);
    };

    if (document.readyState === 'complete') {
      startStage2();
    } else {
      window.addEventListener('load', startStage2, { once: true });
    }
  }

  pumpRemainingFrames() {
    if (this.isDestroyed) return;

    const unrequested = [];
    for (let i = 0; i < this.totalFrames; i++) {
      if (!this.isFrameReady(i) && !this.requestedFrames.has(i)) {
        unrequested.push(i);
      }
    }

    if (unrequested.length === 0) {
      if (this.loadedCount >= this.totalFrames) {
        this.isReady = true;
        if (this.initialImg) {
          this.initialImg.style.opacity = '0';
        }
      }
      return;
    }

    // Ordenar por proximidad al targetFrame actual (adaptativo a la interacción del usuario)
    unrequested.sort((a, b) => {
      const distA = Math.abs(a - this.targetFrame);
      const distB = Math.abs(b - this.targetFrame);
      return distA - distB;
    });

    while (this.activeRequests < this.maxConcurrency && unrequested.length > 0) {
      const nextIdx = unrequested.shift();
      this.fetchFrame(nextIdx, () => {
        if (this.loadedCount >= this.totalFrames) {
          this.isReady = true;
          if (this.initialImg) {
            this.initialImg.style.opacity = '0';
          }
        }
        // Programación cooperativa respetuosa con la CPU y red del navegador
        this.scheduleIdle(() => {
          this.pumpRemainingFrames();
        }, 80);
      });
    }
  }

  fetchFrame(idx, callback) {
    if (this.requestedFrames.has(idx)) {
      if (callback) callback();
      return;
    }
    this.requestedFrames.add(idx);
    this.activeRequests++;

    const img = new Image();
    img.decoding = 'async';
    img.src = this.getFrameUrl(idx);

    const done = () => {
      this.activeRequests--;
      this.loadedCount++;
      if (callback) callback();
    };

    img.onload = () => {
      this.frames[idx] = img;
      done();
    };

    img.onerror = () => {
      console.warn(`BopRobot: frame no disponible ${idx}`);
      done();
    };
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

  isFrameReady(idx) {
    const f = this.frames[idx];
    return Boolean(f && f.complete && f.naturalWidth > 0);
  }

  getBestFrame(targetIdx) {
    const rounded = Math.max(0, Math.min(this.totalFrames - 1, Math.round(targetIdx)));
    if (this.isFrameReady(rounded)) {
      return this.frames[rounded];
    }

    // Degradación elegante: buscar el frame cargado más cercano
    for (let dist = 1; dist < this.totalFrames; dist++) {
      const left = rounded - dist;
      const right = rounded + dist;
      if (left >= 0 && this.isFrameReady(left)) {
        return this.frames[left];
      }
      if (right < this.totalFrames && this.isFrameReady(right)) {
        return this.frames[right];
      }
    }

    // Si aún no hay otros frames cargados, usar el frame central canónico
    if (this.isFrameReady(this.centerFrame)) {
      return this.frames[this.centerFrame];
    }
    // O la imagen inicial del DOM
    if (this.initialImg && this.initialImg.complete && this.initialImg.naturalWidth > 0) {
      return this.initialImg;
    }
    // O el último frame dibujado con éxito (evita destellos o lienzos en blanco)
    return this.lastDrawnImg || null;
  }

  drawFrame(frameIdx) {
    const img = this.getBestFrame(frameIdx);
    if (img && img.complete && img.naturalWidth > 0) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
      this.lastDrawnImg = img;
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
    this.isDestroyed = true;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

// Exportar global para uso directo o en módulos
if (typeof window !== 'undefined') {
  window.BopRobot = BopRobot;
}
