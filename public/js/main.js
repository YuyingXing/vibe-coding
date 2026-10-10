/* =========================================================
   Main — loader, smooth scroll, menu, reveals, data
   ========================================================= */
(function () {
  gsap.registerPlugin(ScrollTrigger);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- smooth scroll (Lenis) ---------- */
  const lenis = new Lenis({ lerp: 0.09, smoothWheel: !reduced });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();

  /* ---------- anchor links ---------- */
  document.querySelectorAll('[data-scroll]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || !id.startsWith('#')) return;
      e.preventDefault();
      const go = () => lenis.scrollTo(id === '#top' ? 0 : id, { offset: id === '#top' ? 0 : -40, duration: 1.6 });
      if (document.body.classList.contains('menu-open')) { toggleMenu(false); setTimeout(go, 700); }
      else go();
    });
  });

  /* ---------- overlay menu ---------- */
  const menu = document.querySelector('.menu');
  const menuBtn = document.querySelector('.menu-toggle');
  const menuText = menuBtn.querySelector('.menu-toggle-text');
  const menuTl = gsap.timeline({ paused: true })
    .set(menu, { visibility: 'visible', pointerEvents: 'auto' })
    .to('.menu-bg', { scaleY: 1, duration: 0.9, ease: 'expo.inOut' })
    .from('.menu-links .menu-word, .menu-links .menu-num, .menu-links .menu-jp', {
      yPercent: 110, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.03,
    }, 0.45)
    .from('.menu-foot > div', { opacity: 0, y: 20, duration: 0.6, stagger: 0.06 }, 0.7);

  function toggleMenu(force) {
    const open = typeof force === 'boolean' ? force : !document.body.classList.contains('menu-open');
    document.body.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    menuText.textContent = open ? 'Close' : 'Menu';
    if (open) { lenis.stop(); menuTl.timeScale(1).play(); }
    else { lenis.start(); menuTl.timeScale(1.6).reverse(); }
  }
  menuBtn.addEventListener('click', () => toggleMenu());
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) toggleMenu(false); });

  /* ---------- custom cursor ---------- */
  const cursor = document.querySelector('.cursor');
  const cursorLabel = cursor.querySelector('.cursor-label');
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const xTo = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' });
    const yTo = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });
    window.addEventListener('pointermove', (e) => {
      xTo(e.clientX); yTo(e.clientY);
      const zone = e.target.closest && e.target.closest('[data-cursor]');
      const overImg = zone && e.target.closest('.w-stage, .i-item');
      const label = overImg ? zone.dataset.cursor : '';
      cursor.classList.toggle('is-label', !!label);
      cursorLabel.textContent = label;
      cursor.classList.toggle('is-hidden', !!e.target.closest('.lightbox'));
    });
    document.addEventListener('mouseleave', () => cursor.classList.add('is-hidden'));
    document.addEventListener('mouseenter', () => cursor.classList.remove('is-hidden'));
  }

  /* ---------- lightbox for works ---------- */
  const lb = document.querySelector('.lightbox');
  const lbImg = lb.querySelector('img');
  function openLightbox(item) {
    lbImg.src = item.src;
    lbImg.alt = item.title || '';
    lb.querySelector('.lightbox-title').textContent = item.title || '';
    lb.querySelector('.lightbox-sub').textContent = [item.location, item.year].filter(Boolean).join(' — ');
    document.body.classList.add('modal-open');
    lenis.stop();
    gsap.to(lb, { autoAlpha: 1, duration: 0.5, ease: 'power2.out' });
    gsap.fromTo(lbImg, { scale: 0.94, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.9, ease: 'expo.out', delay: 0.1 });
    lb.setAttribute('aria-hidden', 'false');
  }
  function closeLightbox() {
    if (lb.getAttribute('aria-hidden') === 'true') return;
    gsap.to(lb, { autoAlpha: 0, duration: 0.4, ease: 'power2.in' });
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    lenis.start();
  }
  lb.addEventListener('click', closeLightbox);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

  /* ---------- small details ---------- */
  document.querySelector('.footer .year').textContent = new Date().getFullYear();
  const clock = document.querySelector('.clock');
  const tick = () => {
    clock.textContent = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo',
    }).format(new Date()) + ' JST';
  };
  tick(); setInterval(tick, 30000);

  /* ---------- scroll animations ---------- */
  function setupScrollAnimations() {
    // marquee
    const track = document.querySelector('.marquee-track');
    track.innerHTML += track.innerHTML;
    const marquee = gsap.to(track, { xPercent: -50, duration: 28, ease: 'none', repeat: -1 });
    ScrollTrigger.create({
      onUpdate: (self) => {
        // scroll direction & speed nudge the marquee
        const v = gsap.utils.clamp(-6, 6, self.getVelocity() / 300);
        gsap.to(marquee, { timeScale: (self.direction || 1) * (1 + Math.abs(v)), duration: 0.4, overwrite: true });
      },
    });

    // hero image parallax
    gsap.to('#heroImage', {
      yPercent: 10, ease: 'none',
      scrollTrigger: { trigger: '.hero-media', start: 'top bottom', end: 'bottom top', scrub: true },
    });
    gsap.from('.hero-media-inner', {
      clipPath: 'inset(18% 12% 18% 12%)', ease: 'none',
      scrollTrigger: { trigger: '.hero-media', start: 'top bottom', end: 'top 30%', scrub: true },
    });

    // generic reveals
    gsap.utils.toArray('[data-reveal]').forEach((el) => {
      gsap.from(el, {
        y: 60, opacity: 0, duration: 1.3, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });

    // about portrait parallax
    gsap.fromTo('.about-portrait img', { yPercent: -8 }, {
      yPercent: 0, ease: 'none',
      scrollTrigger: { trigger: '.about-portrait', start: 'top bottom', end: 'bottom top', scrub: true },
    });
    gsap.from('.services li', {
      y: 30, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08,
      scrollTrigger: { trigger: '.services', start: 'top 85%', once: true },
    });

    // stats counters
    document.querySelectorAll('[data-count]').forEach((el) => {
      const obj = { v: 0 };
      gsap.to(obj, {
        v: +el.dataset.count, duration: 2, ease: 'power3.out',
        onUpdate: () => { el.textContent = Math.round(obj.v); },
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
    });

    // footer headline
    gsap.from('.footer-cta-line', {
      yPercent: 40, opacity: 0, duration: 1.4, ease: 'expo.out', stagger: 0.1,
      scrollTrigger: { trigger: '.footer-cta', start: 'top 85%', once: true },
    });
  }

  /* ---------- hero intro ---------- */
  function playIntro() {
    const tl = gsap.timeline();
    tl.to('.loader', { yPercent: -100, duration: 1.1, ease: 'expo.inOut' })
      .from('.hero-title .line-inner', { yPercent: 110, duration: 1.4, ease: 'expo.out', stagger: 0.09 }, '-=0.45')
      .from('.hero-top .label, .hero-intro, .scroll-cue, .site-header', { opacity: 0, y: 14, duration: 1, ease: 'expo.out', stagger: 0.05 }, '-=1.1')
      .from('.hero-vertical', { opacity: 0, y: -30, duration: 1.4, ease: 'expo.out' }, '-=1.1')
      .add(() => { lenis.start(); document.querySelector('.loader').remove(); });
  }

  /* ---------- data ---------- */
  async function getJSON(url) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) {
      console.warn('Failed to load', url, e);
      return [];
    }
  }

  function preload(srcs, onProgress) {
    let done = 0;
    return Promise.all(srcs.map((src) => new Promise((res) => {
      const img = new Image();
      img.onload = img.onerror = () => { done++; onProgress(done / srcs.length); res(); };
      img.src = src;
    })));
  }

  async function boot() {
    const counter = document.querySelector('.loader-count');
    const [works, inspiration] = await Promise.all([getJSON('/api/works'), getJSON('/api/inspiration')]);

    if (works[0]) {
      document.getElementById('heroImage').src = works[0].src;
      document.getElementById('heroCaption').textContent =
        [works[0].title, works[0].location].filter(Boolean).join(' — ');
    }

    // preload the first images so the intro feels clean (max ~3.5s)
    const first = [works[0] && works[0].src, ...works.slice(0, 5).map((w) => w.src)].filter(Boolean);
    const shown = { v: 0 };
    await Promise.race([
      preload(first, (p) => gsap.to(shown, {
        v: p * 100, duration: 0.4, overwrite: true,
        onUpdate: () => { counter.textContent = String(Math.round(shown.v)).padStart(3, '0'); },
      })),
      new Promise((r) => setTimeout(r, 3500)),
    ]);
    counter.textContent = '100';

    window.Works.init(document.querySelector('.w-gallery'), works, { onOpen: openLightbox });
    window.Inspiration.init(document.querySelector('.i-list'), inspiration, {
      lenis,
      head: document.querySelector('#inspiration .section-head'),
    });
    setupScrollAnimations();
    playIntro();
    window.addEventListener('load', () => ScrollTrigger.refresh());
    // images in the inspiration wall change layout height as they load
    let refreshId;
    document.querySelectorAll('.i-item img').forEach((img) =>
      img.addEventListener('load', () => {
        clearTimeout(refreshId);
        refreshId = setTimeout(() => ScrollTrigger.refresh(), 200);
      }, { once: true }));
  }

  boot();
})();
