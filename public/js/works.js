/**
 * Works gallery — inspired by Made With GSAP "tutorial111".
 * A horizontal strip where the focused (centre) image is enlarged and the
 * neighbours are pushed aside. Browse by dragging, buttons, keyboard or autoplay.
 * The title above rolls between two text states whenever the focus changes.
 */
(function () {
  const AUTOPLAY_DELAY = 3.2; // seconds
  const LOOP_MIN = 7;         // loop infinitely only when there are enough images

  function init(root, items, { onOpen } = {}) {
    const stage = root.querySelector('.w-stage');
    const track = root.querySelector('.w-track');
    const titleA = root.querySelector('.text-state-1');
    const titleB = root.querySelector('.text-state-2');
    const locEl = root.querySelector('.w-location');
    const yearEl = root.querySelector('.w-year');
    const curEl = root.querySelector('.w-current');
    const totEl = root.querySelector('.w-total');
    const playBtn = root.querySelector('.w-play');
    const n = items.length;

    if (!n) {
      root.querySelector('.empty-note').hidden = false;
      root.querySelector('.w-controls').style.display = 'none';
      stage.style.setProperty('--stage-h', '200px');
      return;
    }

    const pad = (v) => String(v).padStart(2, '0');
    totEl.textContent = pad(n);

    const els = items.map((it) => {
      const el = document.createElement('div');
      el.className = 'w-item';
      const img = new Image();
      img.src = it.src;
      img.alt = it.title || '';
      img.decoding = 'async';
      img.draggable = false;
      el.appendChild(img);
      track.appendChild(el);
      return { el, img };
    });

    const loop = n >= LOOP_MIN;
    const state = { pos: 0 };
    let W = 220, G = 24, S = 2, active = -1, front = titleA, back = titleB;

    function layout() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (vw < 700) { W = vw * 0.3; G = 10; S = 2.1; }
      else { W = Math.min(vw * 0.13, 240); G = Math.max(14, vw * 0.012); S = 2.15; }
      // keep the enlarged image inside the viewport height
      const maxCenterH = vh * 0.68;
      if (W * (4 / 3) * S > maxCenterH) W = maxCenterH / ((4 / 3) * S);
      root.style.setProperty('--w', W + 'px');
      stage.style.setProperty('--stage-h', W * (4 / 3) * S + 40 + 'px');
    }

    const wrap = (d) => {
      if (!loop) return d;
      d = ((d % n) + n) % n;
      return d > n / 2 ? d - n : d;
    };
    const mod = (i) => ((i % n) + n) % n;

    function render() {
      const near = (W * (1 + S)) / 2 + G; // distance from centre to first neighbour
      for (let i = 0; i < n; i++) {
        const d = wrap(i - state.pos);
        const ad = Math.abs(d);
        const t = Math.max(0, 1 - ad);                 // 1 at centre → 0 at neighbour
        const scale = 1 + (S - 1) * t;
        const x = ad <= 1 ? d * near : Math.sign(d) * (near + (ad - 1) * (W + G));
        const { el, img } = els[i];
        el.style.transform = `translate3d(${x}px,0,0) scale(${scale})`;
        el.style.zIndex = String(100 - Math.round(ad * 10));
        img.style.filter = `grayscale(${(1 - t) * 0.9}) brightness(${0.92 + 0.08 * t})`;
        img.style.transform = `scale(${1.12 - 0.12 * t})`;
        el.style.visibility = ad > n / 2 - 0.5 && loop ? 'hidden' : '';
      }
      const idx = mod(Math.round(state.pos));
      if (idx !== active) setActive(idx);
    }

    function setActive(idx) {
      const first = active === -1;
      const dir = active === -1 ? 1 : Math.sign(wrap(idx - active)) || 1;
      active = idx;
      const it = items[idx];
      curEl.textContent = pad(idx + 1);
      locEl.textContent = it.location || '';
      yearEl.textContent = it.year || '';

      // roll title between the two text states
      back.textContent = it.title || 'Untitled';
      if (first) {
        gsap.set(back, { yPercent: 0 });
        gsap.set(front, { yPercent: 100 });
      } else {
        gsap.killTweensOf([front, back]);
        gsap.fromTo(back, { yPercent: 100 * dir }, { yPercent: 0, duration: 0.7, ease: 'expo.out' });
        gsap.to(front, { yPercent: -100 * dir, duration: 0.7, ease: 'expo.out' });
      }
      [front, back] = [back, front];
    }

    function goTo(target, duration = 1.1) {
      if (!loop) target = gsap.utils.clamp(0, n - 1, target);
      gsap.to(state, { pos: target, duration, ease: 'expo.out', onUpdate: render, overwrite: true });
    }
    const next = () => goTo(Math.round(state.pos) + 1 > n - 1 && !loop ? 0 : Math.round(state.pos) + 1);
    const prev = () => goTo(Math.round(state.pos) - 1 < 0 && !loop ? n - 1 : Math.round(state.pos) - 1);

    /* ---------- autoplay ---------- */
    let playing = true;
    let inView = false;
    const timer = gsap.delayedCall(AUTOPLAY_DELAY, function tick() {
      if (playing && inView && !dragging) next();
      timer.restart(true);
    });
    function setPlaying(v) {
      playing = v;
      playBtn.setAttribute('aria-pressed', String(v));
      timer.restart(true);
    }
    playBtn.addEventListener('click', () => setPlaying(!playing));
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; }, { threshold: 0.35 }).observe(stage);

    root.querySelector('.w-next').addEventListener('click', () => { next(); timer.restart(true); });
    root.querySelector('.w-prev').addEventListener('click', () => { prev(); timer.restart(true); });
    window.addEventListener('keydown', (e) => {
      if (!inView || document.body.classList.contains('modal-open')) return;
      if (e.key === 'ArrowRight') { next(); timer.restart(true); }
      if (e.key === 'ArrowLeft') { prev(); timer.restart(true); }
    });

    /* ---------- drag ---------- */
    let dragging = false, moved = 0, startX = 0, startPos = 0, lastX = 0, lastT = 0, vel = 0;
    stage.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      dragging = true; moved = 0;
      startX = lastX = e.clientX; lastT = performance.now();
      startPos = state.pos; vel = 0;
      gsap.killTweensOf(state);
      stage.classList.add('is-dragging');
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      const unit = W + G;
      let p = startPos - (dx / unit) * 0.9;
      if (!loop) { // rubber-band at the ends
        if (p < 0) p = p * 0.3;
        if (p > n - 1) p = n - 1 + (p - (n - 1)) * 0.3;
      }
      state.pos = p;
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      vel = vel * 0.6 + ((e.clientX - lastX) / dt) * 0.4;
      lastX = e.clientX; lastT = now;
      render();
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove('is-dragging');
      timer.restart(true);
      if (moved < 6) { handleClick(e); return; }
      const fling = (-vel * 220) / (W + G); // px/ms → items
      goTo(Math.round(state.pos + gsap.utils.clamp(-4, 4, fling)), 1.2);
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);

    function handleClick(e) {
      const hit = els.findIndex(({ el }) => el.contains(document.elementFromPoint(e.clientX, e.clientY)));
      if (hit === -1) { goTo(Math.round(state.pos)); return; }
      if (hit === active) {
        onOpen && onOpen(items[hit]);
      } else {
        goTo(Math.round(state.pos) + wrap(hit - active));
      }
    }

    layout();
    render();
    window.addEventListener('resize', () => { layout(); render(); });

    // entrance: the strip glides in from the right (item transforms are owned by render())
    gsap.from(track, {
      opacity: 0, x: () => window.innerWidth * 0.4, duration: 1.6, ease: 'expo.out',
      scrollTrigger: { trigger: stage, start: 'top 80%', once: true },
    });
  }

  window.Works = { init };
})();
