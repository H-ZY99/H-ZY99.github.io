/* ==========================================================================
   Ziyang Hong - portfolio behavior

   Classic script (never a module) so the page also works when opened
   straight off the filesystem.

   There is deliberately no scroll listener anywhere in this file. Every
   scroll-driven behavior uses IntersectionObserver, ResizeObserver, or a
   CSS scroll-driven animation.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* ----------------------------------------------------------------------
     Theme
     The key 'theme' and the values 'dark' / 'light' are load-bearing: a
     returning visitor's stored preference depends on them. The initial
     value is already applied by the inline bootstrap in <head>.
     ---------------------------------------------------------------------- */

  var themeToggle = document.getElementById('themeToggle');
  var themeColor = document.getElementById('themeColor');
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  var THEME_COLORS = { dark: '#0a0a0c', light: '#fbfbfc' };

  function currentTheme() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function paintTheme(theme) {
    root.setAttribute('data-theme', theme);
    if (themeColor) themeColor.setAttribute('content', THEME_COLORS[theme]);
    if (themeToggle) {
      themeToggle.setAttribute(
        'aria-label',
        theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
      );
    }
  }

  function setTheme(theme) {
    paintTheme(theme);
    try { localStorage.setItem('theme', theme); } catch (e) { /* private mode */ }
  }

  function hasExplicitChoice() {
    try {
      var t = localStorage.getItem('theme');
      return t === 'dark' || t === 'light';
    } catch (e) { return false; }
  }

  paintTheme(currentTheme());

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });
  }

  // Follow the OS only while the visitor has not made an explicit choice.
  systemDark.addEventListener('change', function (e) {
    if (!hasExplicitChoice()) paintTheme(e.matches ? 'dark' : 'light');
  });

  /* ----------------------------------------------------------------------
     Mobile menu
     ---------------------------------------------------------------------- */

  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');
  var nav = document.getElementById('nav');

  function menuOpen() {
    return navToggle && navToggle.getAttribute('aria-expanded') === 'true';
  }

  function setMenu(open) {
    if (!navToggle || !navLinks) return;
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    navLinks.classList.toggle('is-open', open);
    // Lock the page behind the panel without losing scroll position.
    document.body.style.overflow = open ? 'hidden' : '';
  }

  if (navToggle) {
    navToggle.addEventListener('click', function () { setMenu(!menuOpen()); });
  }

  // Delegated: replaces six inline onclick="closeMenu()" handlers.
  if (navLinks) {
    navLinks.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menuOpen()) {
      setMenu(false);
      navToggle.focus();
    }
  });

  document.addEventListener('click', function (e) {
    if (!menuOpen()) return;
    if (e.target.closest('#navLinks') || e.target.closest('#navToggle')) return;
    setMenu(false);
  });

  // Leaving the mobile breakpoint while the panel is open would otherwise
  // leave the body scroll-locked.
  window.matchMedia('(min-width: 768px)').addEventListener('change', function (e) {
    if (e.matches) setMenu(false);
  });

  /* ----------------------------------------------------------------------
     Observer A - nav condense
     A 1px sentinel at the top of <main> replaces a scroll listener.
     ---------------------------------------------------------------------- */

  var topSentinel = document.getElementById('topSentinel');

  if (nav && topSentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      nav.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(topSentinel);
  }

  /* ----------------------------------------------------------------------
     Observer B - scroll reveal, one shot
     threshold 0 with a negative bottom margin, never threshold 0.1: a
     section taller than the viewport can never reach a 10% ratio.
     ---------------------------------------------------------------------- */

  var revealTargets = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));

  // Index each target among its reveal siblings, so a group of peers (the
  // four skill rows, the four project cards) cascades rather than landing
  // together, while unrelated groups each start from zero.
  (function assignStagger() {
    var seen = new Map();
    revealTargets.forEach(function (el) {
      var parent = el.parentElement;
      var n = seen.get(parent) || 0;
      el.style.setProperty('--i', n);
      seen.set(parent, n + 1);
    });
  })();

  if (!('IntersectionObserver' in window) || reduceMotion.matches) {
    revealTargets.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });

    revealTargets.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ----------------------------------------------------------------------
     Observer C - scroll spy and sliding nav indicator

     Geometry is read in measure(), which runs on load and on resize only.
     The observer callback writes custom properties and never reads layout,
     so reads and writes never interleave and no forced reflow occurs.
     ---------------------------------------------------------------------- */

  var links = Array.prototype.slice.call(document.querySelectorAll('.nav__link'));
  var indicator = document.querySelector('.nav__indicator');
  var sections = links
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  var metrics = [];
  var activeId = null;

  function measure() {
    metrics = links.map(function (a) {
      return {
        id: a.getAttribute('href').slice(1),
        x: a.offsetLeft,
        w: a.offsetWidth
      };
    });
    if (activeId) paintIndicator(activeId);
  }

  function paintIndicator(id) {
    if (!indicator || !navLinks) return;
    var m = null;
    for (var i = 0; i < metrics.length; i++) {
      if (metrics[i].id === id) { m = metrics[i]; break; }
    }
    if (!m || !m.w) { indicator.classList.remove('is-on'); return; }
    navLinks.style.setProperty('--ind-x', m.x + 'px');
    navLinks.style.setProperty('--ind-w', m.w + 'px');
    indicator.classList.add('is-on');
  }

  function setActive(id) {
    if (id === activeId) return;
    activeId = id;
    links.forEach(function (a) {
      var on = a.getAttribute('href') === '#' + id;
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    paintIndicator(id);
  }

  if (sections.length && 'IntersectionObserver' in window) {
    // A thin band across the middle of the viewport. During a smooth scroll
    // two sections can cross it in the same callback, so track the set of
    // crossing sections and resolve by document order rather than letting
    // whichever entry arrived last win.
    var crossing = Object.create(null);

    var spyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        crossing[entry.target.id] = entry.isIntersecting;
      });
      for (var i = sections.length - 1; i >= 0; i--) {
        if (crossing[sections[i].id]) { setActive(sections[i].id); return; }
      }
    }, { threshold: 0, rootMargin: '-45% 0px -45% 0px' });

    sections.forEach(function (s) { spyObserver.observe(s); });

    // A tall final section may never reach the middle band, so the page
    // bottom force-activates contact.
    var bottomSentinel = document.getElementById('bottomSentinel');
    if (bottomSentinel) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) setActive('contact');
      }, { threshold: 0 }).observe(bottomSentinel);
    }

    measure();
    if ('ResizeObserver' in window && navLinks) {
      new ResizeObserver(measure).observe(navLinks);
    } else {
      window.addEventListener('resize', measure);
    }
  }

  /* ----------------------------------------------------------------------
     Magnetic primary CTA
     Fine pointers only, and never wired under reduced motion.
     ---------------------------------------------------------------------- */

  var cta = document.getElementById('heroCta');

  function wireMagnet() {
    if (!cta || reduceMotion.matches || !finePointer.matches) return;

    var rect = null;
    var frame = 0;
    var pending = null;

    function onEnter() {
      rect = cta.getBoundingClientRect();
    }

    function onMove(e) {
      if (!rect) return;
      pending = e;
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = 0;
        if (!rect || !pending) return;
        var dx = pending.clientX - (rect.left + rect.width / 2);
        var dy = pending.clientY - (rect.top + rect.height / 2);
        cta.style.setProperty('--mx', Math.max(-8, Math.min(8, dx * 0.22)) + 'px');
        cta.style.setProperty('--my', Math.max(-8, Math.min(8, dy * 0.22)) + 'px');
      });
    }

    function onLeave() {
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      rect = null;
      pending = null;
      cta.style.setProperty('--mx', '0px');
      cta.style.setProperty('--my', '0px');
    }

    cta.addEventListener('pointerenter', onEnter);
    cta.addEventListener('pointermove', onMove, { passive: true });
    cta.addEventListener('pointerleave', onLeave);

    return function () {
      cta.removeEventListener('pointerenter', onEnter);
      cta.removeEventListener('pointermove', onMove);
      cta.removeEventListener('pointerleave', onLeave);
      onLeave();
    };
  }

  /* ----------------------------------------------------------------------
     Cursor spotlight on the project cards

     One delegated listener on the grid rather than one per card. Rects are
     cached page-relative so scrolling never invalidates them, and writes
     are rAF-latched to at most one batch per frame.
     ---------------------------------------------------------------------- */

  var grid = document.getElementById('projectsGrid');

  function wireSpotlight() {
    if (!grid || reduceMotion.matches || !finePointer.matches) return;

    var cards = Array.prototype.slice.call(grid.querySelectorAll('.pcard'));
    var rects = new WeakMap();
    var frame = 0;
    var pending = null;

    function measureCards() {
      var sx = window.scrollX;
      var sy = window.scrollY;
      cards.forEach(function (card) {
        var r = card.getBoundingClientRect();
        rects.set(card, { left: r.left + sx, top: r.top + sy });
      });
    }

    function onMove(e) {
      var card = e.target.closest ? e.target.closest('.pcard') : null;
      if (!card) return;
      pending = { card: card, x: e.pageX, y: e.pageY };
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = 0;
        if (!pending) return;
        var r = rects.get(pending.card);
        if (!r) return;
        pending.card.style.setProperty('--px', (pending.x - r.left) + 'px');
        pending.card.style.setProperty('--py', (pending.y - r.top) + 'px');
      });
    }

    measureCards();
    grid.addEventListener('pointermove', onMove, { passive: true });

    var ro = null;
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(measureCards);
      ro.observe(grid);
    }

    return function () {
      grid.removeEventListener('pointermove', onMove);
      if (ro) ro.disconnect();
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
    };
  }

  /* ----------------------------------------------------------------------
     Wire and rewire the pointer effects when the environment changes
     ---------------------------------------------------------------------- */

  var teardown = [];

  function buildPointerEffects() {
    teardown.forEach(function (fn) { if (fn) fn(); });
    teardown = [wireMagnet(), wireSpotlight()];
  }

  buildPointerEffects();
  reduceMotion.addEventListener('change', buildPointerEffects);
  finePointer.addEventListener('change', buildPointerEffects);
})();
