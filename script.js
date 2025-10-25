(function () {
  const animatedBlocks = document.querySelectorAll('[data-animate]');
  const navLinks = new Map(
    Array.from(document.querySelectorAll('[data-nav]')).map((link) => [link.getAttribute('data-nav'), link])
  );
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mosaicOverlay = document.querySelector('.mosaic-overlay');
  const mosaicField = document.getElementById('mosaic-field');
  const mosaicStage = document.getElementById('mosaic-stage');
  const mosaicShell = document.querySelector('.mosaic-shell');
  const heroSection = document.getElementById('hero');
  const mosaicData = window.MOSAIC_DATA || {};
  const colorMap = mosaicData.colorMap || {};
  const pattern = mosaicData.pattern || [];
  const mosaicMeta = pattern.length
    ? { cols: pattern[0].length, rows: pattern.length, baseWidth: 1200 }
    : { cols: 0, rows: 0, baseWidth: 1200 };
  const orderGlyph = document.querySelector('.order-glyph');
  let dots = [];
  let currentProgress = 0;
  let targetProgress = 0;
  let progressFrame = null;
  let orderState = false;

  initMosaic();

  function revealEntries(entries, observer) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }

  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(revealEntries, {
      threshold: 0.2,
      rootMargin: '0px 0px -10% 0px'
    });
    animatedBlocks.forEach((el) => revealObserver.observe(el));
  } else {
    animatedBlocks.forEach((el) => el.classList.add('is-visible'));
  }

  const sections = Array.from(document.querySelectorAll('main section[id]'));

  function setActiveLink(id) {
    navLinks.forEach((link) => link.classList.remove('is-active'));
    if (navLinks.has(id)) {
      navLinks.get(id).classList.add('is-active');
    }
  }

  if ('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveLink(entry.target.id);
          }
        });
      },
      {
        threshold: 0.5
      }
    );

    sections.forEach((section) => navObserver.observe(section));
  }

  if (orderGlyph && prefersReducedMotion) {
    currentProgress = 1;
    targetProgress = 1;
    updateDotBases(1);
    setOrderState(1);
  }

  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  function initMosaic() {
    if (!mosaicField || !pattern.length) return;
    buildMosaic();
    window.addEventListener(
      'resize',
      debounce(() => {
        buildMosaic();
      }, 200)
    );
  }

  function buildMosaic() {
    mosaicField.innerHTML = '';
    dots = [];
    const { width, scatterHeight, orderedHeight, orderOffsetY } = applyMosaicSize();
    const dotSize = 9;
    const cols = mosaicMeta.cols;
    const rows = mosaicMeta.rows;
    if (!cols || !rows) {
      return;
    }
    const tileW = width / cols;
    const orderedTileH = orderedHeight / rows;

    pattern.forEach((row, rowIdx) => {
      row.forEach((tone, colIdx) => {
        if (tone === -1) return;
        const dot = document.createElement('span');
        dot.className = 'mosaic-dot';
        const orderXNum = colIdx * tileW + tileW / 2 - dotSize / 2;
        const orderYNum = orderOffsetY + rowIdx * orderedTileH + orderedTileH / 2 - dotSize / 2;
        const isTraveler = Math.random() < 0.1;
        const heroSpan = heroSection ? heroSection.offsetHeight : scatterHeight * 0.4;
        const scatterPoint = isTraveler
          ? sampleScatter(width - dotSize, Math.max(heroSpan - dotSize, dotSize))
          : { x: orderXNum, y: orderYNum };
        const scatterXNum = scatterPoint.x;
        const scatterYNum = scatterPoint.y;
        const scatterScale = (0.6 + Math.random() * 0.8).toFixed(2);
        const startMuted = isTraveler;
        const orderColor = colorMap[tone] || colorMap[0];

        dot.style.setProperty('--scatter-x', `${scatterXNum}px`);
        dot.style.setProperty('--scatter-y', `${scatterYNum}px`);
        dot.style.setProperty('--scatter-scale', scatterScale);
        dot.style.setProperty('--order-x', `${orderXNum}px`);
        dot.style.setProperty('--order-y', `${orderYNum}px`);
        dot.style.setProperty('--order-color', orderColor);
        dot.style.setProperty('--dot-color', orderColor);
        if (startMuted) {
          dot.classList.add('is-muted');
        }

        dots.push({
          el: dot,
          scatterX: scatterXNum,
          scatterY: scatterYNum,
          orderX: orderXNum,
          orderY: orderYNum,
          baseX: isTraveler ? scatterXNum : orderXNum,
          baseY: isTraveler ? scatterYNum : orderYNum,
          muted: startMuted,
          traveler: isTraveler,
          revealThreshold: isTraveler ? 0.2 : 0
        });

        mosaicField.appendChild(dot);
      });
    });

    const baseProgress = prefersReducedMotion ? 1 : calculateScrollProgress();
    currentProgress = baseProgress;
    targetProgress = baseProgress;
    updateDotBases(baseProgress);
  }

  function applyMosaicSize() {
    const layout = measureOverlayBounds();
    if (mosaicOverlay) {
      mosaicOverlay.style.top = `${layout.overlayTop}px`;
      mosaicOverlay.style.height = `${layout.overlayHeight}px`;
    }
    const parentWidth = mosaicShell ? mosaicShell.clientWidth : window.innerWidth;
    const width = Math.min(mosaicMeta.baseWidth, parentWidth, window.innerWidth * 0.95);
    const ratio = mosaicMeta.cols && mosaicMeta.rows ? mosaicMeta.rows / mosaicMeta.cols : 1;
    const orderedHeight = width * ratio;
    const scatterHeight = Math.max(layout.overlayHeight, orderedHeight);
    const maxOffset = Math.max(scatterHeight - orderedHeight, 0);
    const orderOffsetY = Math.min(Math.max(layout.orderOffsetY, 0), maxOffset);
    mosaicField.style.setProperty('--mosaic-width', `${width}px`);
    mosaicField.style.setProperty('--mosaic-height', `${scatterHeight}px`);
    return { width, scatterHeight, orderedHeight, orderOffsetY };
  }

  function measureOverlayBounds() {
    const heroTop = heroSection ? heroSection.offsetTop : 0;
    const heroHeight = heroSection ? heroSection.offsetHeight : 0;
    const stageTop = mosaicStage ? mosaicStage.offsetTop : heroTop + heroHeight;
    const stageHeight = mosaicStage ? mosaicStage.offsetHeight : heroHeight || 600;
    const stageBottom = stageTop + stageHeight;
    const overlayTop = Math.min(heroTop, stageTop);
    const overlayHeight = stageBottom - overlayTop;
    const orderOffsetY = stageTop - overlayTop;
    return { overlayTop, overlayHeight, orderOffsetY };
  }

  function sampleScatter(maxWidth, maxHeight) {
    return {
      x: Math.random() * maxWidth,
      y: Math.random() * maxHeight
    };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  function updateDotBases(progress) {
    const eased = easeInOut(progress);
    dots.forEach((dot) => {
      const baseX = dot.traveler ? lerp(dot.scatterX, dot.orderX, eased) : dot.orderX;
      const baseY = dot.traveler ? lerp(dot.scatterY, dot.orderY, eased) : dot.orderY;
      dot.baseX = baseX;
      dot.baseY = baseY;
      dot.el.style.setProperty('--base-x', `${baseX}px`);
      dot.el.style.setProperty('--base-y', `${baseY}px`);
      if (dot.muted && eased >= dot.revealThreshold) {
        dot.muted = false;
        dot.el.classList.remove('is-muted');
      }
    });
    setOrderState(eased);
  }

  function setOrderState(progress) {
    const shouldOrder = progress > 0.7;
    if (shouldOrder !== orderState) {
      orderState = shouldOrder;
      if (orderGlyph) {
        orderGlyph.classList.toggle('is-ordered', shouldOrder);
      }
      if (mosaicStage) {
        mosaicStage.classList.toggle('is-assembled', shouldOrder);
      }
    }
  }

  function handleScrollProgress() {
    targetProgress = prefersReducedMotion ? 1 : calculateScrollProgress();
    if (!progressFrame) {
      progressFrame = requestAnimationFrame(stepProgress);
    }
  }

  function stepProgress() {
    const diff = targetProgress - currentProgress;
    if (Math.abs(diff) < 0.002) {
      currentProgress = targetProgress;
      updateDotBases(currentProgress);
      progressFrame = null;
      return;
    }
    currentProgress += diff * 0.35;
    updateDotBases(currentProgress);
    progressFrame = requestAnimationFrame(stepProgress);
  }

  function calculateScrollProgress() {
    if (!heroSection || !mosaicStage) return 0;
    const scrollY = window.scrollY || window.pageYOffset;
    const viewport = window.innerHeight;
    const heroStart = heroSection.offsetTop;
    const heroHeight = heroSection.offsetHeight || viewport;
    const finish = heroStart + heroHeight * 0.8;
    const range = Math.max(finish - heroStart, 1);
    const raw = (scrollY + viewport * 0.1 - heroStart) / range;
    return clamp(raw, 0, 1);
  }

  window.addEventListener('scroll', handleScrollProgress, { passive: true });

  function debounce(fn, wait = 150) {
    let timeout;
    return function debounced(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  window.addEventListener('load', () => {
    buildMosaic();
    handleScrollProgress();
  });

  handleScrollProgress();
})();
