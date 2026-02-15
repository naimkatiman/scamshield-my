/* ScamShield MY - Animation Engine */
import lottie from 'lottie-web';
import { ASCII_PATTERNS } from './ascii-assets.js';

/* ── ASCII Animation System ── */

class AsciiAnimator {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.chars = ['█', '▓', '▒', '░', '▄', '▀', '■', '□', '▪', '▫'];
    this.matrix = [];
    this.running = false;
  }

  start() {
    if (!this.container || this.running) return;
    this.running = true;
    this.initMatrix();
    this.animate();
  }

  initMatrix() {
    const cols = Math.floor(this.container.offsetWidth / 12);
    const rows = Math.floor(this.container.offsetHeight / 20);
    
    for (let i = 0; i < cols * 2; i++) {
      this.matrix.push({
        x: Math.random() * this.container.offsetWidth,
        y: Math.random() * this.container.offsetHeight - this.container.offsetHeight,
        speed: 1 + Math.random() * 3,
        char: this.chars[Math.floor(Math.random() * this.chars.length)],
        opacity: 0.1 + Math.random() * 0.3
      });
    }

    this.container.innerHTML = this.matrix.map((_, i) => 
      `<span class="ascii-char" data-idx="${i}"></span>`
    ).join('');
  }

  animate() {
    if (!this.running) return;

    this.matrix.forEach((item, i) => {
      item.y += item.speed;
      
      if (item.y > this.container.offsetHeight) {
        item.y = -20;
        item.x = Math.random() * this.container.offsetWidth;
        item.char = this.chars[Math.floor(Math.random() * this.chars.length)];
      }

      const el = this.container.querySelector(`[data-idx="${i}"]`);
      if (el) {
        el.textContent = item.char;
        el.style.left = `${item.x}px`;
        el.style.top = `${item.y}px`;
        el.style.opacity = item.opacity;
      }
    });

    requestAnimationFrame(() => this.animate());
  }

  stop() {
    this.running = false;
  }
}

/* ── Lottie Animations ── */

class LottieManager {
  constructor() {
    this.animations = new Map();
  }

  load(id, containerId, animationData, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const animation = lottie.loadAnimation({
      container,
      renderer: 'svg',
      loop: options.loop !== false,
      autoplay: options.autoplay !== false,
      animationData,
      ...options
    });

    this.animations.set(id, animation);
    return animation;
  }

  loadFromUrl(id, containerId, url, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const animation = lottie.loadAnimation({
      container,
      renderer: 'svg',
      loop: options.loop !== false,
      autoplay: options.autoplay !== false,
      path: url,
      ...options
    });

    this.animations.set(id, animation);
    return animation;
  }

  play(id) {
    this.animations.get(id)?.play();
  }

  pause(id) {
    this.animations.get(id)?.pause();
  }

  stop(id) {
    this.animations.get(id)?.stop();
  }

  destroy(id) {
    const anim = this.animations.get(id);
    if (anim) {
      anim.destroy();
      this.animations.delete(id);
    }
  }
}

/* ── Scroll-Triggered Animations ── */

class ScrollAnimator {
  constructor() {
    this.observers = new Map();
    this.setupIntersectionObserver();
  }

  setupIntersectionObserver() {
    const options = {
      root: null,
      rootMargin: '0px 0px -100px 0px',
      threshold: [0, 0.1, 0.5, 1.0]
    };

    this.io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.animateElement(entry.target, entry.intersectionRatio);
        }
      });
    }, options);
  }

  observe(selector, animationType = 'fadeUp') {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el, index) => {
      el.dataset.animType = animationType;
      el.dataset.animDelay = index * 100;
      el.style.opacity = '0';
      el.style.transform = this.getInitialTransform(animationType);
      this.io.observe(el);
    });
  }

  getInitialTransform(type) {
    const transforms = {
      fadeUp: 'translateY(40px)',
      fadeDown: 'translateY(-40px)',
      fadeLeft: 'translateX(40px)',
      fadeRight: 'translateX(-40px)',
      scale: 'scale(0.8)',
      rotate: 'rotate(-5deg) scale(0.9)'
    };
    return transforms[type] || transforms.fadeUp;
  }

  animateElement(el, ratio) {
    if (el.classList.contains('animated')) return;

    const delay = parseInt(el.dataset.animDelay) || 0;
    const type = el.dataset.animType || 'fadeUp';

    setTimeout(() => {
      el.style.transition = 'opacity 0.8s ease, transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0) translateX(0) scale(1) rotate(0)';
      el.classList.add('animated');

      // Add stagger effect for child elements
      const children = el.querySelectorAll('[data-stagger]');
      children.forEach((child, i) => {
        setTimeout(() => {
          child.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
          child.style.opacity = '1';
          child.style.transform = 'translateY(0)';
        }, i * 80);
      });
    }, delay);
  }

  disconnect() {
    this.io.disconnect();
  }
}

/* ── Motion Effects for Interactive Elements ── */

class MotionEffects {
  static addHoverLift(selector) {
    document.querySelectorAll(selector).forEach(el => {
      el.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease';
      
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'translateY(-4px) scale(1.02)';
        el.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.15)';
      });

      el.addEventListener('mouseleave', () => {
        el.style.transform = 'translateY(0) scale(1)';
        el.style.boxShadow = '';
      });
    });
  }

  static addMagneticEffect(selector) {
    document.querySelectorAll(selector).forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        
        btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translate(0, 0)';
      });
    });
  }

  static addParallax(selector, speed = 0.5) {
    const elements = document.querySelectorAll(selector);
    
    window.addEventListener('scroll', () => {
      const scrolled = window.pageYOffset;
      
      elements.forEach(el => {
        const offset = el.offsetTop;
        const distance = scrolled - offset;
        el.style.transform = `translateY(${distance * speed}px)`;
      });
    });
  }

  static addPulse(selector, duration = 2000) {
    document.querySelectorAll(selector).forEach(el => {
      el.style.animation = `pulse ${duration}ms ease-in-out infinite`;
    });
  }

  static addGlitch(selector) {
    document.querySelectorAll(selector).forEach(el => {
      const originalText = el.textContent;
      
      setInterval(() => {
        if (Math.random() > 0.95) {
          const glitchChars = '█▓▒░!@#$%^&*';
          let glitched = '';
          
          for (let i = 0; i < originalText.length; i++) {
            if (Math.random() > 0.7) {
              glitched += glitchChars[Math.floor(Math.random() * glitchChars.length)];
            } else {
              glitched += originalText[i];
            }
          }
          
          el.textContent = glitched;
          
          setTimeout(() => {
            el.textContent = originalText;
          }, 50);
        }
      }, 3000);
    });
  }

  static addTypewriter(selector, speed = 50) {
    document.querySelectorAll(selector).forEach(el => {
      const text = el.textContent;
      el.textContent = '';
      el.style.opacity = '1';
      
      let index = 0;
      const type = () => {
        if (index < text.length) {
          el.textContent += text[index];
          index++;
          setTimeout(type, speed + Math.random() * 30);
        }
      };
      
      // Start when element is visible
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          type();
          observer.disconnect();
        }
      });
      
      observer.observe(el);
    });
  }
}

/* ── Particle System ── */

class ParticleSystem {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      count: options.count || 50,
      color: options.color || 'rgba(79, 70, 229, 0.3)',
      minSize: options.minSize || 2,
      maxSize: options.maxSize || 4,
      speed: options.speed || 1,
      ...options
    };
    this.particles = [];
    this.canvas = null;
    this.ctx = null;
  }

  init() {
    if (!this.container) return;

    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '1';
    
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.createParticles();
    this.animate();
  }

  resize() {
    this.canvas.width = this.container.offsetWidth;
    this.canvas.height = this.container.offsetHeight;
  }

  createParticles() {
    for (let i = 0; i < this.options.count; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: this.options.minSize + Math.random() * (this.options.maxSize - this.options.minSize),
        speedX: (Math.random() - 0.5) * this.options.speed,
        speedY: (Math.random() - 0.5) * this.options.speed,
        opacity: 0.3 + Math.random() * 0.5
      });
    }
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles.forEach(p => {
      p.x += p.speedX;
      p.y += p.speedY;

      if (p.x < 0 || p.x > this.canvas.width) p.speedX *= -1;
      if (p.y < 0 || p.y > this.canvas.height) p.speedY *= -1;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = this.options.color;
      this.ctx.globalAlpha = p.opacity;
      this.ctx.fill();
    });

    this.ctx.globalAlpha = 1;
    requestAnimationFrame(() => this.animate());
  }
}

/* ── Shield Animation Data (Simple Lottie JSON) ── */

export const SHIELD_LOTTIE = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 90,
  w: 200,
  h: 200,
  nm: "Shield Protection",
  ddd: 0,
  assets: [],
  layers: [{
    ddd: 0,
    ind: 1,
    ty: 4,
    nm: "Shield",
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      r: { a: 0, k: 0 },
      p: { a: 0, k: [100, 100, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: {
        a: 1,
        k: [
          { t: 0, s: [80, 80, 100] },
          { t: 30, s: [100, 100, 100] },
          { t: 60, s: [80, 80, 100] },
          { t: 90, s: [80, 80, 100] }
        ]
      }
    },
    ao: 0,
    shapes: [{
      ty: "gr",
      it: [{
        ty: "sh",
        ks: {
          a: 0,
          k: {
            i: [[0,0],[0,0],[0,0],[0,0]],
            o: [[0,0],[0,0],[0,0],[0,0]],
            v: [[0,-50],[-30,20],[0,50],[30,20]],
            c: true
          }
        }
      }, {
        ty: "st",
        c: { a: 0, k: [0.31, 0.27, 0.9, 1] },
        o: { a: 0, k: 100 },
        w: { a: 0, k: 3 }
      }, {
        ty: "fl",
        c: { a: 0, k: [0.31, 0.27, 0.9, 0.2] },
        o: { a: 0, k: 100 }
      }],
      nm: "Shield Shape"
    }],
    ip: 0,
    op: 90,
    st: 0,
    bm: 0
  }]
};

/* ── Export Animation Manager ── */

export class AnimationManager {
  constructor() {
    this.ascii = null;
    this.lottie = new LottieManager();
    this.scroll = new ScrollAnimator();
    this.particles = null;
  }

  initAll() {
    // ASCII Background
    this.ascii = new AsciiAnimator('ascii-bg');
    this.ascii.start();

    // Scroll animations
    this.scroll.observe('[data-animate]', 'fadeUp');
    this.scroll.observe('.card', 'scale');
    this.scroll.observe('.flow-step-badge', 'fadeRight');

    // Motion effects
    MotionEffects.addHoverLift('.card');
    MotionEffects.addMagneticEffect('.btn-primary');
    MotionEffects.addParallax('.bg-shape', 0.3);
    MotionEffects.addPulse('.trust-badge', 3000);

    // Typewriter for hero
    setTimeout(() => {
      const heroTitle = document.querySelector('#phase-hero-ai h1');
      if (heroTitle && !heroTitle.classList.contains('typed')) {
        heroTitle.classList.add('typed');
        MotionEffects.addTypewriter('#phase-hero-ai h1', 40);
      }
    }, 500);

    // Particles
    this.particles = new ParticleSystem('ascii-bg', {
      count: 30,
      color: 'rgba(79, 70, 229, 0.15)',
      speed: 0.3
    });
    this.particles.init();

    // Load Lottie animations
    this.loadLottieAnimations();
  }

  loadLottieAnimations() {
    // Shield animation in hero
    const heroShield = document.querySelector('.hero-badge .icon-lg');
    if (heroShield) {
      const container = document.createElement('div');
      container.id = 'hero-shield-lottie';
      container.style.width = '48px';
      container.style.height = '48px';
      container.style.display = 'inline-block';
      heroShield.parentNode.replaceChild(container, heroShield);
      
      this.lottie.load('hero-shield', 'hero-shield-lottie', SHIELD_LOTTIE, {
        loop: true,
        autoplay: true
      });
    }

    // You can add more Lottie animations from URLs or files
    // this.lottie.loadFromUrl('checkmark', 'success-icon', 'https://assets.lottie.com/checkmark.json');
  }

  destroy() {
    this.ascii?.stop();
    this.scroll?.disconnect();
    this.lottie.animations.forEach((_, id) => this.lottie.destroy(id));
  }
}

export { MotionEffects, ParticleSystem };
