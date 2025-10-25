(function () {
  // ====== DOM queries / setup ======
  const animatedBlocks = document.querySelectorAll('[data-animate]');
  const navLinks = new Map(
    Array.from(document.querySelectorAll('[data-nav]')).map((link) => [
      link.getAttribute('data-nav'),
      link
    ])
  );
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  const mosaicOverlay = document.querySelector('.mosaic-overlay');
  const mosaicField = document.getElementById('mosaic-field');
  const mosaicStage = document.getElementById('mosaic-stage');
  const mosaicShell = document.querySelector('.mosaic-shell');
  const heroSection = document.getElementById('hero');
  const mosaicData = window.MOSAIC_DATA || {};
  const colorMap = mosaicData.colorMap || {};
  const pattern = mosaicData.pattern || [];

  // meta about the mosaic grid
  const mosaicMeta = pattern.length
    ? { cols: pattern[0].length, rows: pattern.length, baseWidth: 1200 }
    : { cols: 0, rows: 0, baseWidth: 1200 };

  const orderGlyph = document.querySelector('.order-glyph');

  // runtime state
  let dots = [];
  let currentProgress = 0;
  let targetProgress = 0;
  let progressFrame = null;
  let orderState = false;

  // lazy-build guard
  let mosaicBuilt = false;
  
  // Scroll throttle tracking
  let scrollTicking = false;
  let resizeTicking = false;

  // ====== INIT ======
  initRevealAnimations();
  initNavHighlight();
  initYearStamp();
  initMosaicLazy();
  handleScrollProgress(); // prime progress calc

  // ====== Reveal-on-scroll using IntersectionObserver ======
  function initRevealAnimations() {
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
  }

  // ====== Nav highlighting based on current section ======
  function initNavHighlight() {
    const sections = Array.from(
      document.querySelectorAll('main section[id]')
    );

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
  }

  // ====== Footer year ======
  function initYearStamp() {
    const yearEl = document.getElementById('year');
    if (yearEl) {
      yearEl.textContent = new Date().getFullYear();
    }
  }

  // ====== Mosaic lazy init ======
  function initMosaicLazy() {
    if (mosaicField && pattern.length) {
      window.addEventListener('resize', () => {
        if (!resizeTicking) {
          resizeTicking = true;
          setTimeout(() => {
            if (mosaicBuilt) {
              buildMosaic();
            }
            resizeTicking = false;
          }, 200);
        }
      });
    }

    // Build the mosaic only once: either on first scroll OR when fully loaded.
    function buildOnceIfNeeded() {
      if (mosaicBuilt) return;
      mosaicBuilt = true;
      buildMosaic();
      handleScrollProgress();
    }

    window.addEventListener('scroll', buildOnceIfNeeded, { passive: true, once: true });
    window.addEventListener('load', buildOnceIfNeeded, { once: true });
  }

  // ====== Build mosaic DOM (optimized) ======
  function buildMosaic() {
    if (!mosaicField || !pattern.length) return;

    // clear existing dots
    mosaicField.innerHTML = '';
    dots = [];

    // measure + set layout vars
    const { width, scatterHeight, orderedHeight, orderOffsetY } =
      applyMosaicSize();

    // basic geometry for each tile
    const dotSize = 9;
    const cols = mosaicMeta.cols;
    const rows = mosaicMeta.rows;
    if (!cols || !rows) return;

    const tileW = width / cols;
    const orderedTileH = orderedHeight / rows;

    // Batch all dots into a fragment
    const frag = document.createDocumentFragment();

    // Aggressive downsampling on narrow screens
    const viewportWidth = window.innerWidth;
    const mobileSkip = viewportWidth < 480 ? 3 : viewportWidth < 768 ? 2 : 1;

    pattern.forEach((row, rowIdx) => {
      if (rowIdx % mobileSkip !== 0) return;

      row.forEach((tone, colIdx) => {
        if (colIdx % mobileSkip !== 0) return;
        if (tone === -1) return;

        // create a dot
        const dot = document.createElement('span');
        dot.className = 'mosaic-dot';

        // where this dot sits in the ordered (assembled) layout
        const orderXNum = colIdx * tileW + tileW / 2 - dotSize / 2;
        const orderYNum =
          orderOffsetY +
          rowIdx * orderedTileH +
          orderedTileH / 2 -
          dotSize / 2;

        // 10% of dots start as "travelers" (scattered then converge)
        const isTraveler = Math.random() < 0.1;
        const heroSpan = heroSection
          ? heroSection.offsetHeight
          : scatterHeight * 0.4;

        const scatterPoint = isTraveler
          ? sampleScatter(
              width - dotSize,
              Math.max(heroSpan - dotSize, dotSize)
            )
          : { x: orderXNum, y: orderYNum };

        const scatterXNum = scatterPoint.x;
        const scatterYNum = scatterPoint.y;

        const scatterScale = (0.6 + Math.random() * 0.8).toFixed(2);
        const startMuted = isTraveler;

        const orderColor = colorMap[tone] || colorMap[0];

        // Set all CSS properties in one go
        dot.style.cssText = `
          --scatter-x:${scatterXNum}px;
          --scatter-y:${scatterYNum}px;
          --scatter-scale:${scatterScale};
          --order-x:${orderXNum}px;
          --order-y:${orderYNum}px;
          --order-color:${orderColor};
          --dot-color:${orderColor};
        `;

        if (startMuted) {
          dot.classList.add('is-muted');
        }

        // keep per-dot state so we can animate with scroll
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

        frag.appendChild(dot);
      });
    });

    // append to the live DOM once
    mosaicField.appendChild(frag);

    // Use will-change hint for smoother animations
    mosaicField.style.willChange = 'transform';

    // initial positioning state
    const baseProgress = prefersReducedMotion ? 1 : calculateScrollProgress();
    currentProgress = baseProgress;
    targetProgress = baseProgress;
    updateDotBases(baseProgress);
  }

  // ====== Size / layout helpers ======
  function applyMosaicSize() {
    const layout = measureOverlayBounds();

    if (mosaicOverlay) {
      mosaicOverlay.style.top = `${layout.overlayTop}px`;
      mosaicOverlay.style.height = `${layout.overlayHeight}px`;
    }

    const parentWidth = mosaicShell
      ? mosaicShell.clientWidth
      : window.innerWidth;

    const width = Math.min(
      mosaicMeta.baseWidth,
      parentWidth,
      window.innerWidth * 0.95
    );

    const ratio =
      mosaicMeta.cols && mosaicMeta.rows
        ? mosaicMeta.rows / mosaicMeta.cols
        : 1;

    const orderedHeight = width * ratio;
    const scatterHeight = Math.max(layout.overlayHeight, orderedHeight);

    const maxOffset = Math.max(scatterHeight - orderedHeight, 0);
    const orderOffsetY = Math.min(
      Math.max(layout.orderOffsetY, 0),
      maxOffset
    );

    mosaicField.style.setProperty('--mosaic-width', `${width}px`);
    mosaicField.style.setProperty('--mosaic-height', `${scatterHeight}px`);

    return { width, scatterHeight, orderedHeight, orderOffsetY };
  }

  function measureOverlayBounds() {
    const heroTop = heroSection ? heroSection.offsetTop : 0;
    const heroHeight = heroSection ? heroSection.offsetHeight : 0;
    const stageTop = mosaicStage
      ? mosaicStage.offsetTop
      : heroTop + heroHeight;
    const stageHeight = mosaicStage
      ? mosaicStage.offsetHeight
      : heroHeight || 600;
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

  // ====== Scroll-driven assembly animation ======
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

    // Batch DOM reads and writes
    const updates = [];
    
    dots.forEach((dot) => {
      const baseX = dot.traveler
        ? lerp(dot.scatterX, dot.orderX, eased)
        : dot.orderX;
      const baseY = dot.traveler
        ? lerp(dot.scatterY, dot.orderY, eased)
        : dot.orderY;

      dot.baseX = baseX;
      dot.baseY = baseY;

      updates.push({
        el: dot.el,
        baseX,
        baseY,
        shouldUnmute: dot.muted && eased >= dot.revealThreshold
      });

      if (dot.muted && eased >= dot.revealThreshold) {
        dot.muted = false;
      }
    });

    // Apply all DOM writes together
    updates.forEach(({ el, baseX, baseY, shouldUnmute }) => {
      el.style.setProperty('--base-x', `${baseX}px`);
      el.style.setProperty('--base-y', `${baseY}px`);
      
      if (shouldUnmute) {
        el.classList.remove('is-muted');
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

  // ====== Scroll progress handling ======
  function handleScrollProgress() {
    // don't animate pre-build
    if (!mosaicBuilt && !prefersReducedMotion) return;

    if (!scrollTicking) {
      scrollTicking = true;
      
      requestAnimationFrame(() => {
        targetProgress = prefersReducedMotion ? 1 : calculateScrollProgress();
        
        if (!progressFrame) {
          progressFrame = requestAnimationFrame(stepProgress);
        }
        
        scrollTicking = false;
      });
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

    // where we consider the mosaic "fully assembled"
    const finish = heroStart + heroHeight * 0.8;

    const range = Math.max(finish - heroStart, 1);
    const raw = (scrollY + viewport * 0.1 - heroStart) / range;

    return clamp(raw, 0, 1);
  }

  // global scroll listener for morph animation
  window.addEventListener('scroll', handleScrollProgress, { passive: true });
})();