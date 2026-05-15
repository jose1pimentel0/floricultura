/**
 * FLORICULTURA MAH — SCRIPT.JS (VERSÃO ATUALIZADA)
 * Handles:
 * 1. Sticky hero + Red Trigger entrance animations
 * 2. Video scrubbing via scrollY (Controle do Lírio)
 * 3. Navigation scroll state
 * 4. Catalog card & section scroll reveals
 * 5. Mobile hamburger
 */

'use strict';

/* ═══════════════════════════════════════════════════════
   1. RED TRIGGER MECHANISM
═══════════════════════════════════════════════════════ */

function initRedTriggers() {
  const triggers = document.querySelectorAll('.red-trigger');
  if (!triggers.length) return;

  const triggered = new Set(); 

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
      threshold: 0,
      rootMargin: '-10% 0px -80% 0px',
    }
  );

  triggers.forEach((trigger) => observer.observe(trigger));
}

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
   2. VIDEO SCRUBBING (Controle do Lírio pelo Scroll)
═══════════════════════════════════════════════════════ */

function initVideoScrub() {
  const wrapper = document.getElementById('hero-wrapper');
  const video   = document.getElementById('hero-video');
  if (!wrapper || !video) return;

  // Garante que o vídeo não toque sozinho para não quebrar o efeito
  video.pause();

  const updateScrub = () => {
    const wrapperRect   = wrapper.getBoundingClientRect();
    const totalScroll   = wrapper.offsetHeight - window.innerHeight;
    
    // Calcula o progresso baseado na posição do topo do wrapper
    const scrolled      = Math.max(0, -wrapperRect.top);
    const progress      = Math.min(scrolled / totalScroll, 1);

    if (video.duration) {
      // Sincroniza o tempo do vídeo com a porcentagem da rolagem
      video.currentTime = progress * video.duration;
    }
  };

  window.addEventListener('scroll', updateScrub, { passive: true });
  updateScrub(); // Executa uma vez no início
}

/* ═══════════════════════════════════════════════════════
   3. NAVIGATION SCROLL STATE
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
  updateNav();
}

/* ═══════════════════════════════════════════════════════
   4. GENERAL SCROLL REVEAL (Cards e Atelier)
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
          observer.unobserve(entry.target);
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
   5. MOBILE HAMBURGER
═══════════════════════════════════════════════════════ */

function initHamburger() {
  const btn   = document.getElementById('hamburger');
  const links = document.querySelector('.nav__links');
  if (!btn || !links) return;

  btn.addEventListener('click', () => {
    const open = links.style.display === 'flex';
    links.style.display = open ? '' : 'flex';
    // Estilos rápidos via JS para o menu mobile
    if (!open) {
        links.style.flexDirection = 'column';
        links.style.position = 'absolute';
        links.style.top = '100%';
        links.style.left = '0';
        links.style.right = '0';
        links.style.background = 'rgba(42, 31, 28, 0.97)';
        links.style.padding = '1.5rem 2rem';
        links.style.gap = '1.5rem';
    } else {
        links.removeAttribute('style');
    }
    btn.setAttribute('aria-expanded', !open);
  });

  links.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => links.removeAttribute('style'));
  });
}

/* ═══════════════════════════════════════════════════════
   INIT EXECUTION
═══════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  initVideoScrub();    // Ativado para controlar o lírio
  initRedTriggers();   // Ativado para as frases aparecerem no tempo certo
  initNav();
  initScrollReveal();
  initHamburger();
});
