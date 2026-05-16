/**
 * ═══════════════════════════════════════════════════════════
 * FLORICULTURA MAH — SCRIPT.JS
 * Arquitetura Antigravity: Scroll-Driven Video Scrubbing
 * ═══════════════════════════════════════════════════════════
 *
 * MÓDULOS:
 *  1. Video Scrub Engine   — mapeia scrollY → video.currentTime
 *  2. Red Trigger System   — IntersectionObserver nas sentinelas
 *  3. Navigation State     — nav transparente → frosted ao rolar
 *  4. Scroll Reveal        — cards e seções entram com animação
 *  5. Scroll Hint          — esconde o hint ao começar a rolar
 *  6. Hamburger            — menu mobile
 *
 * ─── CALIBRAÇÃO DO SCRUBBING ────────────────────────────────
 *
 * A sincronização funciona assim:
 *
 *   scrollProgress = (scrollY - wrapperTop) / (wrapperHeight - viewportHeight)
 *   video.currentTime = scrollProgress * video.duration
 *
 * Isso garante que:
 *   - scroll em 0%  → frame 0 do vídeo (lírio inteiro)
 *   - scroll em 50% → meio do vídeo (lírio parcialmente desmontado)
 *   - scroll em 100% → último frame (lírio completamente aberto/fechado)
 *
 * O vídeo deve ser encodado com -g 1 (keyframe a cada frame)
 * para que o seek seja imediato, sem artefatos de decodificação.
 *
 * ─── PERFORMANCE ────────────────────────────────────────────
 *
 * Usamos requestAnimationFrame (rAF) em vez de ouvir 'scroll'
 * diretamente. O loop de rAF roda a ~60fps e lê o scrollY
 * mais recente, evitando janks e desenfileiramento de eventos.
 *
 * A variável `targetTime` armazena o tempo desejado e
 * `displayTime` faz lerp (interpolação linear) suave
 * até o target, criando a fluidez "hand-crafted".
 */

'use strict';

/* ═══════════════════════════════════════════════════════════
   1. VIDEO SCRUB ENGINE
   ═══════════════════════════════════════════════════════════ */

/**
 * CONFIGURAÇÃO DO SCRUB
 * Ajuste aqui para calibrar o comportamento sem mexer na lógica.
 */
var SCRUB_CONFIG = {
  /**
   * Velocidade do lerp (interpolação suave).
   * 0.0 = ultra suave (lento para acompanhar o scroll)
   * 1.0 = sem lerp (instantâneo, mais seco)
   * 0.08–0.12 = sweet spot para sensação "hand-controlled"
   */
  lerpFactor: 0.10,

  /**
   * Tolerância mínima para atualizar currentTime.
   * Evita writes desnecessários no elemento de vídeo.
   * Valor em segundos.
   */
  seekThreshold: 0.016, // ~1 frame a 60fps

  /**
   * Porcentagem do wrapper que é "ativa" para o scrub.
   * 0.0–1.0. Ex: 0.9 = últimos 10% do wrapper pausam no último frame.
   */
  activeRange: 1.0,
};

function initVideoScrub() {
  var wrapper       = document.getElementById('hero-wrapper');
  var video         = document.getElementById('hero-video');
  var progressEl    = document.getElementById('hero-progress');
  var progressFill  = document.getElementById('hero-progress-fill');
  var progressLabel = document.getElementById('hero-progress-label');

  if (!wrapper || !video) return;

  // Estado interno do engine
  var targetTime     = 0;   // currentTime desejado (mapeado do scroll)
  var displayTime    = 0;   // currentTime atual com lerp aplicado
  var rafId          = null;
  var videoDuration  = 0;
  var isEngineActive = false;

  // ── Aguarda metadados do vídeo (necessário para .duration) ──────
  function onVideoReady() {
    videoDuration = video.duration;

    if (!videoDuration || isNaN(videoDuration)) {
      // Tenta novamente quando os metadados chegarem
      video.addEventListener('loadedmetadata', onVideoReady, { once: true });
      return;
    }

    // Pausa: o scroll controla a reprodução, não o autoplay
    video.pause();
    video.currentTime = 0;

    startEngine();
  }

  if (video.readyState >= 1) {
    onVideoReady(); // Metadados já disponíveis (cache)
  } else {
    video.addEventListener('loadedmetadata', onVideoReady, { once: true });
  }

  // ── Engine principal: loop de requestAnimationFrame ──────────────
  //
  // Por que rAF em vez de 'scroll' listener?
  // O evento 'scroll' pode disparar várias vezes por frame
  // ou ser engolido em momentum scroll em iOS.
  // O rAF sincroniza com o repaint do navegador, garantindo
  // que cada escrita em video.currentTime seja visual e eficiente.
  //
  function startEngine() {
    isEngineActive = true;

    function tick() {
      if (!isEngineActive) return;
      rafId = requestAnimationFrame(tick);

      // ── Calcula posição do wrapper na viewport ─────────────────
      var wrapperRect   = wrapper.getBoundingClientRect();
      var wrapperHeight = wrapper.offsetHeight;
      var viewH         = window.innerHeight;

      // scrolled = pixels que o wrapper já ultrapassou o topo
      var scrolled  = Math.max(0, -wrapperRect.top);
      var maxScroll = wrapperHeight - viewH;

      // progress: 0.0 = início da pista → 1.0 = fim da pista
      var rawProgress = maxScroll > 0
        ? Math.min(scrolled / maxScroll, 1)
        : 0;

      // Aplica activeRange (ex: 0.9 trava no último frame mais cedo)
      var scrollProgress = Math.min(rawProgress / SCRUB_CONFIG.activeRange, 1.0);

      // Tempo-alvo correspondente no vídeo
      targetTime = scrollProgress * videoDuration;

      // ── Lerp: interpolação suave entre displayTime e targetTime ─
      //
      // A fórmula é:  novo = atual + (alvo - atual) × fator
      // Isso cria uma curva exponencial de aproximação:
      //   frame 1:  60% da diferença percorrida
      //   frame 5:  99.9% percorrida (usando fator 0.6)
      //   com fator 0.10: suave, demora ~20 frames para convergir
      //
      var delta = targetTime - displayTime;
      if (Math.abs(delta) > SCRUB_CONFIG.seekThreshold) {
        displayTime += delta * SCRUB_CONFIG.lerpFactor;

        // Garante que não ultrapasse os limites do vídeo
        displayTime = Math.max(0, Math.min(displayTime, videoDuration));
        video.currentTime = displayTime;
      }

      // ── Atualiza indicador de progresso lateral ────────────────
      if (progressFill && progressLabel) {
        var pct = (scrollProgress * 100).toFixed(1);
        progressFill.style.height = pct + '%';
        progressLabel.textContent = Math.round(scrollProgress * 100) + '%';

        if (progressEl && scrollProgress > 0.01) {
          progressEl.classList.add('is-active');
        }
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  // ── Pausa o engine quando o wrapper sai da viewport ────────────
  // Economia de bateria em mobile e quando o usuário está
  // navegando nas seções abaixo do hero.
  var wrapperObserver = new IntersectionObserver(
    function(entries) {
      var entry = entries[0];
      isEngineActive = entry.isIntersecting;

      if (isEngineActive && !rafId) {
        startEngine();
      } else if (!isEngineActive && rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
    { threshold: 0 }
  );
  wrapperObserver.observe(wrapper);
}


/* ═══════════════════════════════════════════════════════════
   2. RED TRIGGER SYSTEM — GATILHOS VERMELHOS
   ═══════════════════════════════════════════════════════════
   
   COMO FUNCIONA:
   
   As `.red-trigger` são divs absolutas posicionadas na pista
   de rolagem (hero-wrapper, 500vh). Como o hero-sticky está
   travado no topo, essas divs "passam" pela viewport enquanto
   o usuário rola, como um filme passando por uma janela fixa.
   
   O IntersectionObserver monitora cada sentinela. Quando ela
   cruza o limiar de rootMargin configurado, dispara a animação
   do elemento identificado por `data-target` (ID no DOM),
   com atraso opcional via `data-delay` (ms).
   
   COMO ADICIONAR NOVOS GATILHOS:
   No HTML, dentro de .hero-wrapper:
   
     <div class="red-trigger"
          data-target="ID_DO_ELEMENTO"
          data-delay="200"
          style="top: 200vh"
          aria-hidden="true">
     </div>
   
   DEPURAÇÃO: descomente em style.css:
     .red-trigger { background: rgba(255,0,0,0.5) !important; height:4px !important; }
*/

function initRedTriggers() {
  var triggers = document.querySelectorAll('.red-trigger');
  if (!triggers.length) return;

  // Set de IDs já revelados — cada gatilho dispara apenas uma vez
  var fired = new Set();

  var observer = new IntersectionObserver(
    function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) return;

        var el       = entry.target;
        var targetId = el.dataset.target;
        var delay    = parseInt(el.dataset.delay, 10) || 0;

        // Ignora se já foi disparado (evita re-animação ao rolar de volta)
        if (fired.has(targetId)) return;
        fired.add(targetId);

        revealElement(targetId, delay);
      });
    },
    {
      // rootMargin: '-5% 0px -85% 0px'
      // O trigger dispara quando está entre 5% e 15% da viewport,
      // ou seja, logo que entra pelo topo da tela.
      rootMargin: '-5% 0px -85% 0px',
      threshold: 0,
    }
  );

  triggers.forEach(function(t) { observer.observe(t); });
}

/**
 * Adiciona `.is-revealed` ao elemento com o ID especificado.
 * A transição CSS em `.red-reveal` executa a animação visual.
 *
 * @param {string} id    - ID do elemento a animar
 * @param {number} delay - Atraso em ms
 */
function revealElement(id, delay) {
  var el = document.getElementById(id);
  if (!el) return;

  if (delay > 0) {
    setTimeout(function() { el.classList.add('is-revealed'); }, delay);
  } else {
    el.classList.add('is-revealed');
  }
}


/* ═══════════════════════════════════════════════════════════
   2b. ENTRADA CINEMATOGRÁFICA DO HERO (carga da página)
   ═══════════════════════════════════════════════════════════
   
   Revela eyebrow e headline imediatamente ao carregar,
   sem depender de scroll. Os elementos restantes (sub e cta)
   são controlados pelos Red Triggers posicionados
   em pontos mais avançados da pista de scroll.
*/

function initHeroEntrance() {
  revealElement('hero-eyebrow',  600);
  revealElement('hero-headline', 1050);
}


/* ═══════════════════════════════════════════════════════════
   3. NAVIGATION SCROLL STATE
   ═══════════════════════════════════════════════════════════ */

function initNav() {
  var nav = document.getElementById('nav');
  if (!nav) return;

  // Ativa o estilo frosted quando sai da zona do hero
  var threshold = window.innerHeight * 0.4;

  function update() {
    nav.classList.toggle('scrolled', window.scrollY > threshold);
  }

  window.addEventListener('scroll', update, { passive: true });
  update(); // estado inicial
}


/* ═══════════════════════════════════════════════════════════
   4. SCROLL REVEAL — CATÁLOGO E SEÇÕES
   ═══════════════════════════════════════════════════════════ */

function initScrollReveal() {
  var els = document.querySelectorAll(
    '.card, .atelier__text, .atelier__visual'
  );
  if (!els.length) return;

  var observer = new IntersectionObserver(
    function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  els.forEach(function(el) { observer.observe(el); });
}


/* ═══════════════════════════════════════════════════════════
   5. SCROLL HINT — desaparece ao começar a rolar
   ═══════════════════════════════════════════════════════════ */

function initScrollHint() {
  var hint = document.getElementById('hero-scroll-hint');
  if (!hint) return;

  function hide() {
    if (window.scrollY > 80) {
      hint.classList.add('is-hidden');
      window.removeEventListener('scroll', hide);
    }
  }

  window.addEventListener('scroll', hide, { passive: true });
}


/* ═══════════════════════════════════════════════════════════
   6. HAMBURGER MOBILE
   ═══════════════════════════════════════════════════════════ */

function initHamburger() {
  var btn   = document.getElementById('hamburger');
  var links = document.querySelector('.nav__links');
  if (!btn || !links) return;

  var isOpen = false;

  btn.addEventListener('click', function() {
    isOpen = !isOpen;
    btn.setAttribute('aria-expanded', isOpen);

    if (isOpen) {
      links.style.cssText = [
        'display: flex',
        'flex-direction: column',
        'position: absolute',
        'top: 100%',
        'left: 0',
        'right: 0',
        'background: rgba(10, 0, 8, 0.97)',
        'padding: 1.5rem 2rem',
        'gap: 1.5rem',
        'backdrop-filter: blur(12px)',
        'border-bottom: 1px solid rgba(196,122,155,0.2)',
        'z-index: 99',
      ].join('; ');
    } else {
      links.removeAttribute('style');
    }
  });

  // Fecha ao clicar em qualquer link
  links.querySelectorAll('a').forEach(function(a) {
    a.addEventListener('click', function() {
      isOpen = false;
      links.removeAttribute('style');
      btn.setAttribute('aria-expanded', false);
    });
  });
}


/* ═══════════════════════════════════════════════════════════
   INICIALIZAÇÃO — ordem importa
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function() {
  initVideoScrub();     // 1. Engine de vídeo — registra observer antes de qualquer scroll
  initRedTriggers();    // 2. Sentinelas de animação na pista
  initHeroEntrance();   // 3. Entrada cinematográfica na carga
  initNav();            // 4. Estado da barra de navegação
  initScrollReveal();   // 5. Reveal dos cards e seções abaixo
  initScrollHint();     // 6. Hint de scroll
  initHamburger();      // 7. Menu mobile
});
