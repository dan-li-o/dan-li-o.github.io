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
  let travelerDots = []; // Separate array for dots that actually move
  let staticDots = []; // Dots that never move
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
  handleScrollProgress();

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
    travelerDots = [];
    staticDots = [];

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

    // Keep original downsampling (not aggressive)
    const viewportWidth = window.innerWidth;
    const mobileSkip = viewportWidth < 480 ? 2 : 1;

    // Use TWO containers: one for static dots, one for animated
    const staticFrag = document.createDocumentFragment();
    const travelerFrag = document.createDocumentFragment();

    pattern.forEach((row, rowIdx) => {
      if (rowIdx % mobileSkip !== 0) return;

      row.forEach((tone, colIdx) => {
        if (colIdx % mobileSkip !== 0) return;
        if (tone === -1) return;

        const dot = document.createElement('span');
        dot.className = 'mosaic-dot';

        const orderXNum = colIdx * tileW + tileW / 2 - dotSize / 2;
        const orderYNum =
          orderOffsetY +
          rowIdx * orderedTileH +
          orderedTileH / 2 -
          dotSize / 2;

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

        // KEY OPTIMIZATION: Static dots get positioned once via transform
        // Travelers use CSS variables that we'll update
        if (isTraveler) {
          dot.style.cssText = `
            --scatter-x:${scatterXNum}px;
            --scatter-y:${scatterYNum}px;
            --scatter-scale:${scatterScale};
            --order-x:${orderXNum}px;
            --order-y:${orderYNum}px;
            --order-color:${orderColor};
            --dot-color:${orderColor};
            --base-x:${scatterXNum}px;
            --base-y:${scatterYNum}px;
          `;
          
          if (startMuted) {
            dot.classList.add('is-muted');
          }

          const dotData = {
            el: dot,
            scatterX: scatterXNum,
            scatterY: scatterYNum,
            orderX: orderXNum,
            orderY: orderYNum,
            baseX: scatterXNum,
            baseY: scatterYNum,
            muted: startMuted,
            revealThreshold: 0.2
          };

          travelerDots.push(dotData);
          dots.push(dotData);
          travelerFrag.appendChild(dot);
        } else {
          // Static dots: set transform directly, never update
          dot.style.cssText = `
            --order-color:${orderColor};
            --dot-color:${orderColor};
            transform: translate(${orderXNum}px, ${orderYNum}px);
          `;

          staticDots.push({ el: dot });
          dots.push({ el: dot, traveler: false });
          staticFrag.appendChild(dot);
        }
      });
    });

    // Append static dots first (they never change)
    mosaicField.appendChild(staticFrag);
    
    // Then travelers (we'll animate these)
    mosaicField.appendChild(travelerFrag);

    console.log(`Built mosaic: ${staticDots.length} static, ${travelerDots.length} travelers`);

    // Use CSS transform for animations (GPU accelerated)
    mosaicField.style.willChange = 'transform';

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

    // CRITICAL: Only update traveler dots (10% of total)
    // This is the KEY optimization - 90% of dots never need updating!
    
    // Pre-calculate all positions first (batch reads)
    const updates = new Array(travelerDots.length);
    
    for (let i = 0; i < travelerDots.length; i++) {
      const dot = travelerDots[i];
      const baseX = lerp(dot.scatterX, dot.orderX, eased);
      const baseY = lerp(dot.scatterY, dot.orderY, eased);
      
      dot.baseX = baseX;
      dot.baseY = baseY;
      
      updates[i] = {
        el: dot.el,
        x: baseX,
        y: baseY,
        shouldUnmute: dot.muted && eased >= dot.revealThreshold
      };
      
      if (updates[i].shouldUnmute) {
        dot.muted = false;
      }
    }

    // Now apply all DOM writes in one batch
    // Using transform directly is fastest
    for (let i = 0; i < updates.length; i++) {
      const { el, x, y, shouldUnmute } = updates[i];
      
      // Single style property write
      el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
      
      if (shouldUnmute) {
        el.classList.remove('is-muted');
      }
    }

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

    const finish = heroStart + heroHeight * 0.8;
    const range = Math.max(finish - heroStart, 1);
    const raw = (scrollY + viewport * 0.1 - heroStart) / range;

    return clamp(raw, 0, 1);
  }

  window.addEventListener('scroll', handleScrollProgress, { passive: true });
})();