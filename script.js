/**
 * FLORICULTURA MAH — script.js
 * Antigravity Architecture — Scroll-Driven Video Engine
 *
 * Architecture overview:
 * ┌─────────────────────────────────────────────────────┐
 * │  RedTrigger (IntersectionObserver)                  │
 * │    → arms / disarms the scroll engine               │
 * │                                                     │
 * │  ScrollEngine (rAF loop)                            │
 * │    → maps scroll position → video.currentTime       │
 * │    → uses lerp for organic feel                     │
 * │                                                     │
 * │  NavController                                      │
 * │    → manages nav state as hero exits                │
 * │                                                     │
 * │  RevealController                                   │
 * │    → IntersectionObserver for below-fold content    │
 * └─────────────────────────────────────────────────────┘
 */

(function () {
  'use strict';

  /* ─── UTILITY ───────────────────────────────────────── */

  /**
   * Linear interpolation — the secret to organic scroll feel.
   * Instead of snapping video.currentTime to the exact mapped value,
   * we ease toward it each frame, making it feel hand-controlled.
   */
  const lerp = (current, target, factor) =>
    current + (target - current) * factor;

  /** Clamp a value between min and max */
  const clamp = (value, min, max) =>
    Math.min(Math.max(value, min), max);

  /** Map a value from one range to another */
  const mapRange = (value, inMin, inMax, outMin, outMax) => {
    const ratio = (value - inMin) / (inMax - inMin);
    return outMin + ratio * (outMax - outMin);
  };

  /* ─── DOM REFS ───────────────────────────────────────── */
  const $ = (id) => document.getElementById(id);

  const video         = $('hero-video');
  const pinSpacer     = document.querySelector('.hero__pin-spacer');
  const redTrigger    = $('red-trigger');
  const progressFill  = $('hero-progress-fill');
  const scrollCue     = document.querySelector('.hero__scroll-cue');
  const nav           = $('nav');

  /* ─── STATE ──────────────────────────────────────────── */
  const state = {
    // Is the scroll engine active?
    // Only true when redTrigger is in viewport.
    isArmed: false,

    // rAF handle — only one loop runs at a time
    rafId: null,

    // The precise scroll target we're easing toward
    targetTime: 0,

    // The smoothed value we actually write to video.currentTime
    smoothTime: 0,

    // Whether video metadata is loaded and we know its duration
    isReady: false,

    // Lerp factor — how quickly we chase the target (0–1)
    // 0.08 = silky smooth, feels like liquid
    // 0.15 = snappier, more responsive
    lerpFactor: 0.10,

    // Cached measurements (updated on resize)
    heroTop:    0,
    heroHeight: 0,
    scrollCanvas: 0, // heroHeight - 100vh (the effective scroll range)

    // Whether scroll cue has been hidden
    cueDismissed: false,
  };

  /* ─── 1. VIDEO READINESS ─────────────────────────────── */

  /**
   * We don't autoplay — we need metadata loaded so we can seek.
   * Once loadedmetadata fires, we show the video and arm the system.
   */
  function initVideo() {
    if (!video) {
      console.warn('[MAH] Hero video element not found.');
      return;
    }

    video.addEventListener('loadedmetadata', onVideoReady);

    // Fallback: if already loaded (cached)
    if (video.readyState >= 1) {
      onVideoReady();
    }
  }

  function onVideoReady() {
    state.isReady = true;
    video.classList.add('is-ready');
    video.currentTime = 0;

    // Pause explicitly — this video is scroll-controlled only
    video.pause();

    // Trigger a measurement in case scroll already happened
    measureHero();
    updateScrollTarget();
    console.log(
      `[MAH] Video ready. Duration: ${video.duration.toFixed(2)}s`
    );
  }

  /* ─── 2. RED TRIGGER — INTERSECTION OBSERVER ─────────── */

  /**
   * The Red Trigger is an invisible div at the top of the hero.
   * When it exits the viewport (meaning the hero pin-spacer has
   * started scrolling), we arm the engine.
   *
   * rootMargin: '0px' means: fire exactly when the element
   * crosses the viewport edge.
   */
  function initRedTrigger() {
    if (!redTrigger || !pinSpacer) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Trigger is visible → we're at the very top,
            // engine not yet needed
            disarmEngine();
          } else {
            // Trigger has left the viewport →
            // scroll canvas is active, arm the engine
            armEngine();
          }
        });
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0,
      }
    );

    observer.observe(redTrigger);
  }

  function armEngine() {
    if (state.isArmed) return;
    state.isArmed = true;
    startLoop();
    console.log('[MAH] Engine armed.');
  }

  function disarmEngine() {
    if (!state.isArmed) return;
    state.isArmed = false;
    stopLoop();
    console.log('[MAH] Engine disarmed.');
  }

  /* ─── 3. SCROLL ENGINE — rAF LOOP ───────────────────── */

  /**
   * The core of the Antigravity architecture.
   *
   * Each frame:
   * 1. Compute how far into the scroll canvas we are (0–1)
   * 2. Map that to video.currentTime
   * 3. Lerp toward the target for organic feel
   * 4. Write to video.currentTime
   * 5. Update UI chrome (progress bar)
   */
  function startLoop() {
    if (state.rafId) return;
    loop();
  }

  function stopLoop() {
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  }

  function loop() {
    state.rafId = requestAnimationFrame(loop);
    tick();
  }

  function tick() {
    if (!state.isReady || !video.duration) return;

    // Smooth toward target
    state.smoothTime = lerp(
      state.smoothTime,
      state.targetTime,
      state.lerpFactor
    );

    // Only write if meaningfully different (avoids micro-seeks)
    if (Math.abs(state.smoothTime - video.currentTime) > 0.001) {
      video.currentTime = state.smoothTime;
    }

    // Update progress bar
    const progress = clamp(state.smoothTime / video.duration, 0, 1);
    progressFill.style.height = `${progress * 100}%`;
  }

  /* ─── 4. SCROLL → TIME MAPPING ──────────────────────── */

  /**
   * On every scroll event, we update the targetTime.
   * The rAF loop then smoothly chases it.
   *
   * Formula:
   *   scrollProgress = (pageYOffset - heroTop) / scrollCanvas
   *   targetTime     = scrollProgress * video.duration
   */
  function updateScrollTarget() {
    if (!state.isReady || !video.duration) return;

    const scrollY = window.pageYOffset;
    const { heroTop, scrollCanvas } = state;

    // How far into the pin-spacer's scroll range are we?
    const scrollProgress = clamp(
      mapRange(scrollY, heroTop, heroTop + scrollCanvas, 0, 1),
      0,
      1
    );

    state.targetTime = scrollProgress * video.duration;

    // Dismiss scroll cue after first meaningful scroll into hero
    if (!state.cueDismissed && scrollProgress > 0.03) {
      state.cueDismissed = true;
      scrollCue.classList.add('is-hidden');
    }
  }

  function measureHero() {
    if (!pinSpacer) return;
    const rect = pinSpacer.getBoundingClientRect();
    state.heroTop    = rect.top + window.pageYOffset;
    state.heroHeight = pinSpacer.offsetHeight;
    // Scroll canvas = total height minus one viewport
    state.scrollCanvas = state.heroHeight - window.innerHeight;
  }

  /* ─── 5. NAV STATE ───────────────────────────────────── */

  /**
   * Nav darkens once the user scrolls past the hero section.
   * While inside the hero (dark video background), nav is transparent.
   */
  function updateNav() {
    const scrollY = window.pageYOffset;
    const heroBottom = state.heroTop + state.heroHeight;

    // Add scrolled class after tiny scroll (polishes the feel)
    if (scrollY > 40) {
      nav.classList.add('nav--scrolled');
    } else {
      nav.classList.remove('nav--scrolled');
    }

    // Switch nav color mode when below hero
    if (scrollY > heroBottom) {
      nav.classList.add('nav--light');
    } else {
      nav.classList.remove('nav--light');
    }
  }

  /* ─── 6. SCROLL REVEAL ───────────────────────────────── */

  function initReveal() {
    const elements = document.querySelectorAll(
      '.colecao__header, .card, .sobre__text, .sobre__visual, ' +
      '.contato__title, .contato__channel'
    );

    elements.forEach((el) => el.classList.add('reveal'));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -10% 0px',
        threshold: 0.1,
      }
    );

    elements.forEach((el) => observer.observe(el));
  }

  /* ─── 7. EVENT LISTENERS ─────────────────────────────── */

  /**
   * Scroll handler — split into two concerns:
   * a) Update video target time
   * b) Update nav state
   *
   * Using passive: true for better scroll performance.
   */
  function onScroll() {
    updateScrollTarget();
    updateNav();
  }

  /**
   * Resize handler — debounced.
   * Re-measure the hero on resize so scroll math stays accurate.
   */
  let resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      measureHero();
      updateScrollTarget();
    }, 150);
  }

  /* ─── 8. INIT ────────────────────────────────────────── */

  function init() {
    measureHero();
    initVideo();
    initRedTrigger();
    initReveal();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    // Initial state
    updateScrollTarget();
    updateNav();

    console.log('[MAH] Floricultura Mah — Antigravity Engine initialized.');
  }

  /* Fire on DOMContentLoaded */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
