// Home page interactions: mobile nav + stat counters
(() => {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  // Count-up animation when visible
  const els = [...document.querySelectorAll('[data-count]')];
  if (!els.length) return;

  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

  const animate = el => {
    const target = Number(el.getAttribute('data-count') || '0');
    const start = 0;
    const duration = 900;
    const t0 = performance.now();

    const tick = now => {
      const t = Math.min(1, (now - t0) / duration);
      const v = Math.round(start + (target - start) * easeOutCubic(t));
      el.textContent = String(v);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        animate(e.target);
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.35 });

  els.forEach(el => io.observe(el));
})();
