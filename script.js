/**
 * FLORICULTURA MAH — SCRIPT.JS
 * Handles:
 *  1. Sticky hero + Red Trigger entrance animations
 *  2. Catalog card & section scroll reveals
 *  3. Navigation scroll state
 *  4. Optional: video scrubbing via scrollY (commented out)
 */

'use strict';

/* ═══════════════════════════════════════════════════════
   1. RED TRIGGER MECHANISM
   
   How it works:
   - `.red-trigger` elements are invisible dividers
     positioned at specific `top` offsets inside `.hero-wrapper`.
   - Because `.hero-sticky` is pinned (position:sticky), the
     triggers move THROUGH the viewport as the user scrolls
     the wrapper's 300vh runway.
   - An IntersectionObserver watches each trigger. When a
     trigger's top edge crosses 10% from the viewport top,
     it fires `animateTarget()`, which finds the matching
     hero element by its `data-target` ID and adds the
     `.is-revealed` class after an optional `data-delay` ms.
   
   To add a new trigger:
     <div class="red-trigger" data-target="MY_ELEMENT_ID" data-delay="600" style="top:120vh"></div>
   
   To remove an animation:
     Remove the `.red-reveal` class from the HTML element.
═══════════════════════════════════════════════════════ */

function initRedTriggers() {
  const triggers = document.querySelectorAll('.red-trigger');
  if (!triggers.length) return;

  const triggered = new Set(); // Prevent double-firing

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const el = entry.target;
        const targetId = el.dataset.target;
        const delay    = parseInt(el.dataset.delay, 10) || 0;

        if (triggered.has(targetId)) return;
        triggered.add(targetId);

        animateTarget(targetId, delay);
      });
    },
    {
      // Fire when the trigger's top edge reaches 10% down from viewport top.
      // Adjust threshold/rootMargin to fine-tune timing.
      threshold: 0,
      rootMargin: '-10% 0px -80% 0px',
    }
  );

  triggers.forEach((trigger) => observer.observe(trigger));
}

/**
 * Adds `.is-revealed` to the element with the given ID.
 * The CSS transition on `.red-reveal` handles the visual animation.
 *
 * @param {string} id      - The element's ID attribute
 * @param {number} delay   - Milliseconds to wait before revealing
 */
function animateTarget(id, delay) {
  const el = document.getElementById(id);
  if (!el) return;

  if (delay > 0) {
    setTimeout(() => el.classList.add('is-revealed'), delay);
  } else {
    el.classList.add('is-revealed');
  }
}


/* ═══════════════════════════════════════════════════════
   1b. IMMEDIATE HERO REVEAL (on page load)
   
   The very first trigger fires almost immediately (top:5vh).
   But for a fast-loading page, we also trigger the eyebrow
   directly on DOMContentLoaded so it doesn't require
   scrolling to see anything.
═══════════════════════════════════════════════════════ */

function initHeroImmediate() {
  // Stagger the initial reveals even without scrolling,
  // so the hero isn't completely blank on load.
  const initialOrder = [
    { id: 'hero-eyebrow',  delay: 400  },
    { id: 'hero-headline', delay: 700  },
    { id: 'hero-sub',      delay: 1050 },
    { id: 'hero-cta',      delay: 1350 },
  ];

  initialOrder.forEach(({ id, delay }) => animateTarget(id, delay));
}


/* ═══════════════════════════════════════════════════════
   2. NAVIGATION SCROLL STATE
   
   Adds `.scrolled` to `.nav` once the user scrolls past
   the initial viewport, switching from transparent/light
   to the opaque frosted-glass style.
═══════════════════════════════════════════════════════ */

function initNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  const updateNav = () => {
    if (window.scrollY > window.innerHeight * 0.6) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav(); // Run once on init
}


/* ═══════════════════════════════════════════════════════
   3. GENERAL SCROLL REVEAL
   
   Cards and section elements (`.card`, `.atelier__text`,
   `.atelier__visual`) start invisible via CSS and are
   revealed when they enter the viewport.
═══════════════════════════════════════════════════════ */

function initScrollReveal() {
  const revealEls = document.querySelectorAll(
    '.card, .atelier__text, .atelier__visual'
  );
  if (!revealEls.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target); // Reveal once only
        }
      });
    },
    {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px',
    }
  );

  revealEls.forEach((el) => observer.observe(el));
}


/* ═══════════════════════════════════════════════════════
   4. OPTIONAL: VIDEO SCRUBBING (Scroll-Controlled Playback)
   
   Uncomment this block if you want scrolling to CONTROL
   the video's playback position rather than letting it loop.
   
   This creates the illusion that the user is "dragging"
   the video through its frames by scrolling.
   
   Requirements:
   - Remove `loop` and `autoplay` from the <video> tag
   - Add `preload="auto"` (already present)
   - The video should be short (3–8s) for best effect
   
   FFMPEG tip for scrubbing: encode with keyframes every frame:
     ffmpeg -i input.mp4 -g 1 -vf fps=30 -crf 18 scrub.mp4
═══════════════════════════════════════════════════════ */

/*
function initVideoScrub() {
  const wrapper = document.getElementById('hero-wrapper');
  const video   = document.getElementById('hero-video');
  if (!wrapper || !video) return;

  // Wait for video metadata so duration is known
  video.addEventListener('loadedmetadata', () => {
    const updateScrub = () => {
      const wrapperRect   = wrapper.getBoundingClientRect();
      const totalScroll   = wrapper.offsetHeight - window.innerHeight;
      const scrolled      = Math.max(0, -wrapperRect.top);
      const progress      = Math.min(scrolled / totalScroll, 1);

      video.currentTime = progress * video.duration;
    };

    window.addEventListener('scroll', updateScrub, { passive: true });
    updateScrub();
  });
}
*/


/* ═══════════════════════════════════════════════════════
   5. MOBILE HAMBURGER (simple toggle)
═══════════════════════════════════════════════════════ */

function initHamburger() {
  const btn   = document.getElementById('hamburger');
  const links = document.querySelector('.nav__links');
  if (!btn || !links) return;

  btn.addEventListener('click', () => {
    const open = links.style.display === 'flex';
    links.style.display = open ? '' : 'flex';
    links.style.flexDirection = 'column';
    links.style.position = 'absolute';
    links.style.top = '100%';
    links.style.left = '0';
    links.style.right = '0';
    links.style.background = 'rgba(42, 31, 28, 0.97)';
    links.style.padding = '1.5rem 2rem';
    links.style.gap = '1.5rem';
    if (open) links.removeAttribute('style');
    btn.setAttribute('aria-expanded', !open);
  });

  // Close on link click
  links.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => links.removeAttribute('style'));
  });
}


/* ═══════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  initHeroImmediate();
  initRedTriggers();
  initNav();
  initScrollReveal();
  initHamburger();

  // Uncomment if using scroll-controlled video:
  // initVideoScrub();
});
