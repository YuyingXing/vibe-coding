/**
 * Inspiration gallery — inspired by Made With GSAP "effect119" (Push Away Gallery).
 * Images keep their natural proportions in a loose, airy grid. Clicking one
 * enlarges it to the centre of the viewport while every other image is pushed
 * outward, away from the click point, along its own direction. A caption is
 * revealed beneath it; clicking again (or Esc / scrolling) brings everything back.
 */
(function () {
  // loose rhythm so the wall feels hand-pinned rather than gridded
  const HEIGHTS = [17, 12, 21, 14, 18, 11, 15, 20, 13, 16];   // vw
  const OFFSETS = [0, 5, 0, 3, 7, 0, 2, 5, 0, 4];               // vw (margin-top)

  function init(list, items, { lenis, head } = {}) {
    const capBox = document.querySelector('.i-caption');
    const capCount = capBox.querySelector('.i-caption-count');
    const capText = capBox.querySelector('.i-caption-text');

    if (!items.length) {
      list.nextElementSibling.hidden = false;
      return;
    }

    const pad = (v) => String(v).padStart(2, '0');
    const els = items.map((it, i) => {
      const el = document.createElement('figure');
      el.className = 'i-item';
      el.style.margin = '0';
      el.style.setProperty('--h', HEIGHTS[i % HEIGHTS.length] + 'vw');
      el.style.setProperty('--mt', OFFSETS[i % OFFSETS.length] + 'vw');
      el.innerHTML = `<img alt="" draggable="false" decoding="async" loading="lazy"><span class="i-num">${pad(i + 1)}</span>`;
      const img = el.querySelector('img');
      img.src = it.src;
      img.alt = it.caption || '';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        openIndex === null ? open(i) : close();
      });
      list.appendChild(el);
      return el;
    });

    // entrance
    gsap.set(els, { opacity: 0, y: 60 });
    ScrollTrigger.batch(els, {
      start: 'top 92%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08 }),
    });

    let openIndex = null;
    let busy = false;

    function open(i) {
      if (busy) return;
      busy = true;
      openIndex = i;
      lenis && lenis.stop();
      document.body.classList.add('inspo-open', 'modal-open');

      const el = els[i];
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const capSpace = 90;
      const maxW = vw < 700 ? vw * 0.86 : vw * 0.56;
      const maxH = vh - 150 - capSpace;
      const scale = Math.min(maxW / r.width, maxH / r.height);
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const targetY = (vh - capSpace) / 2 + 24;
      const push = Math.max(vw, vh) * 0.9;

      el.classList.add('is-open');
      const tl = gsap.timeline({ onComplete: () => { busy = false; } });
      tl.to(el, { x: vw / 2 - cx, y: targetY - cy, scale, duration: 1.3, ease: 'expo.inOut' }, 0);

      els.forEach((o, j) => {
        if (j === i) return;
        const ro = o.getBoundingClientRect();
        const dx = ro.left + ro.width / 2 - cx;
        const dy = ro.top + ro.height / 2 - cy;
        const len = Math.hypot(dx, dy) || 1;
        tl.to(o, { x: `+=${(dx / len) * push}`, y: `+=${(dy / len) * push}`, duration: 1.3, ease: 'expo.inOut' }, 0);
      });
      if (head) tl.to(head, { opacity: 0.08, duration: 0.8, ease: 'power2.out' }, 0);

      // caption under the enlarged image
      const it = items[i];
      capCount.textContent = `( ${pad(i + 1)} / ${pad(items.length)} )`;
      capText.innerHTML = '';
      const span = document.createElement('span');
      span.textContent = it.caption || it.title || '';
      capText.appendChild(span);
      capBox.style.top = targetY + (r.height * scale) / 2 + 14 + 'px';
      tl.to(capBox, { opacity: 1, duration: 0.4 }, 0.85)
        .fromTo(span, { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: 'expo.out' }, 0.85)
        .fromTo(capCount, { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0.95);
    }

    function close(instant = false) {
      if (openIndex === null) return;
      const el = els[openIndex];
      openIndex = null;
      busy = true;
      const d = instant ? 0 : 1.1;
      const tl = gsap.timeline({
        onComplete: () => {
          busy = false;
          el.classList.remove('is-open');
          lenis && lenis.start();
          document.body.classList.remove('inspo-open', 'modal-open');
        },
      });
      tl.to(capBox, { opacity: 0, duration: instant ? 0 : 0.3 }, 0)
        .to(els, { x: 0, y: 0, scale: 1, duration: d, ease: 'expo.inOut', overwrite: true }, instant ? 0 : 0.1);
      if (head) tl.to(head, { opacity: 1, duration: d * 0.8 }, instant ? 0 : 0.3);
    }

    document.addEventListener('click', () => { if (openIndex !== null && !busy) close(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    window.addEventListener('wheel', () => { if (openIndex !== null && !busy) close(); }, { passive: true });
    window.addEventListener('touchmove', () => { if (openIndex !== null && !busy) close(); }, { passive: true });
    window.addEventListener('resize', () => close(true));
  }

  window.Inspiration = { init };
})();
