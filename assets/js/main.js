(() => {
  const preferReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Smooth scroll behavior (JS fallback for older browsers; CSS covers most)
  function smoothScrollTo(id){
    const el = document.getElementById(id);
    if(!el) return;
    el.scrollIntoView({ behavior: preferReduced ? 'auto' : 'smooth', block: 'start' });
  }

  // Hook up side nav clicks
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-target]');
    if(!a) return;
    const target = a.getAttribute('data-target');
    if(target){ e.preventDefault(); smoothScrollTo(target); }
  });

  // Scrollspy via IntersectionObserver
  const navLinks = Array.from(document.querySelectorAll('.side-nav a[data-target]'));
  const byId = Object.fromEntries(navLinks.map(a => [a.getAttribute('data-target'), a]));

  const observer = new IntersectionObserver((entries) => {
    // Choose the most visible section
    let topMost = entries
      .filter(e => e.isIntersecting)
      .sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
    if(!topMost) return;
    const id = topMost.target.id;
    navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('data-target') === id));
    // a11y hint
    navLinks.forEach(a => a.removeAttribute('aria-current'));
    if(byId[id]) byId[id].setAttribute('aria-current', 'true');
  }, { rootMargin: '0px 0px -60% 0px', threshold: [0.25, 0.5, 0.75, 1] });

  document.querySelectorAll('section.scene[id]').forEach(sec => observer.observe(sec));
})();

