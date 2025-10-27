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
  
  // PERFORMANCE OPTIMIZATION: Separate arrays for different dot types
  // This allows us to only iterate over dots that need updating (travelers)
  // rather than checking all dots every frame
  let travelerDots = []; // ~7% of dots that animate from scatter to order
  let staticDots = []; // ~93% of dots that stay in place
  
  let currentProgress = 0;
  let targetProgress = 0;
  let progressFrame = null;
  let orderState = false;

  // lazy-build guard
  let mosaicBuilt = false;
  
  // Scroll throttle tracking - prevents multiple calculations per frame
  let scrollTicking = false;
  let resizeTicking = false;

  // PERFORMANCE: Pre-allocated array for updates to avoid garbage collection
  // We'll reuse this array each frame instead of creating new ones
  let updateBuffer = [];

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
      // PERFORMANCE: Debounced resize handler
      // Only rebuilds after user stops resizing for 200ms
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

    // Build mosaic on first scroll or page load (lazy loading)
    // This improves initial page load performance
    function buildOnceIfNeeded() {
      if (mosaicBuilt) return;
      mosaicBuilt = true;
      buildMosaic();
      handleScrollProgress();
    }

    window.addEventListener('scroll', buildOnceIfNeeded, { passive: true, once: true });
    window.addEventListener('load', buildOnceIfNeeded, { once: true });
  }

  // ====== Build mosaic DOM (highly optimized) ======
  function buildMosaic() {
    if (!mosaicField || !pattern.length) return;

    // Clear existing dots and reset state
    mosaicField.innerHTML = '';
    dots = [];
    travelerDots = [];
    staticDots = [];

    // Measure layout dimensions once (avoid repeated reflows)
    const { width, scatterHeight, orderedHeight, orderOffsetY } =
      applyMosaicSize();

    // Basic geometry for each tile
    const dotSize = 9;
    const cols = mosaicMeta.cols;
    const rows = mosaicMeta.rows;
    if (!cols || !rows) return;

    const tileW = width / cols;
    const orderedTileH = orderedHeight / rows;

    // Mobile optimization: reduce dot count on smaller screens
    const viewportWidth = window.innerWidth;
    const mobileSkip = viewportWidth < 480 ? 2 : 1;

    // PERFORMANCE: Use DocumentFragment to batch DOM insertions
    // This creates elements in memory and adds them all at once,
    // causing only ONE reflow instead of hundreds
    const staticFrag = document.createDocumentFragment();
    const travelerFrag = document.createDocumentFragment();

    // Pre-allocate update buffer based on estimated traveler count
    const estimatedTravelers = Math.ceil((pattern.length * pattern[0].length * 0.07) / (mobileSkip * mobileSkip));
    updateBuffer = new Array(estimatedTravelers);

    pattern.forEach((row, rowIdx) => {
      if (rowIdx % mobileSkip !== 0) return;

      row.forEach((tone, colIdx) => {
        if (colIdx % mobileSkip !== 0) return;
        if (tone === -1) return; // Skip empty tiles

        // Create dot element
        const dot = document.createElement('span');
        dot.className = 'mosaic-dot';

        // Calculate final ordered position (where dot ends up)
        const orderXNum = colIdx * tileW + tileW / 2 - dotSize / 2;
        const orderYNum =
          orderOffsetY +
          rowIdx * orderedTileH +
          orderedTileH / 2 -
          dotSize / 2;

        // OPTIMIZATION: Reduced to 7% travelers (down from 10%)
        // Fewer moving dots = better performance during convergence
        const isTraveler = Math.random() < 0.07;
        const heroSpan = heroSection
          ? heroSection.offsetHeight
          : scatterHeight * 0.4;

        // For travelers: generate random scatter position
        // For static: use final position immediately
        const scatterPoint = isTraveler
          ? sampleScatter(
              width - dotSize,
              Math.max(heroSpan - dotSize, dotSize)
            )
          : { x: orderXNum, y: orderYNum };

        const scatterXNum = scatterPoint.x;
        const scatterYNum = scatterPoint.y;
        const scatterScale = isTraveler ? 0.5 + Math.random() * 0.9 : 1;
        const scatterScaleCss = scatterScale.toFixed(2);
        const startMuted = isTraveler;
        const orderColor = resolveDotColor(colorMap[tone] || colorMap[0]);
        const mutedColor = resolveMutedColor(orderColor);

        // CRITICAL OPTIMIZATION: Different setup for travelers vs static dots
        if (isTraveler) {
          // Travelers: Set CSS variables for animation
          // We'll update these via transform property for GPU acceleration
          dot.style.cssText = `
            --scatter-x:${scatterXNum}px;
            --scatter-y:${scatterYNum}px;
            --scatter-scale:${scatterScaleCss};
            --order-x:${orderXNum}px;
            --order-y:${orderYNum}px;
            --order-color:${orderColor};
            --dot-color:${orderColor};
            --muted-color:${mutedColor};
            --base-x:${scatterXNum}px;
            --base-y:${scatterYNum}px;
            --scale:${scatterScaleCss};
          `;
          
          if (startMuted) {
            dot.classList.add('is-muted');
          }

          // Store dot data for animation updates
          const dotData = {
            el: dot,
            scatterX: scatterXNum,
            scatterY: scatterYNum,
            orderX: orderXNum,
            orderY: orderYNum,
            scatterScale,
            muted: startMuted,
            traveler: true,
            revealThreshold: 0.15 // Reveal slightly earlier (was 0.2)
          };

          travelerDots.push(dotData);
          dots.push(dotData);
          travelerFrag.appendChild(dot);
        } else {
          // PERFORMANCE WIN: Static dots get transform set once and never touched again
          // This means 93% of dots cause ZERO work during animation frames
          dot.style.cssText = `
            --order-color:${orderColor};
            --dot-color:${orderColor};
            --muted-color:${mutedColor};
            transform: translate(${orderXNum}px, ${orderYNum}px);
          `;

          staticDots.push({ el: dot, traveler: false });
          dots.push({ el: dot, traveler: false });
          staticFrag.appendChild(dot);
        }
      });
    });

    // PERFORMANCE: Append all dots at once (single reflow)
    mosaicField.appendChild(staticFrag); // Static dots first (won't change)
    mosaicField.appendChild(travelerFrag); // Travelers second (will animate)

    console.log(`Mosaic built: ${staticDots.length} static, ${travelerDots.length} travelers (${((travelerDots.length / dots.length) * 100).toFixed(1)}%)`);

    // GPU acceleration hint - tells browser to optimize for transforms
    mosaicField.style.willChange = 'transform';

    // Set initial position based on scroll
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

  // Color utility functions
  function resolveDotColor(raw) {
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
    return '#d67b71';
  }

  function resolveMutedColor(color) {
    const normalized = normalizeHex(color);
    if (!normalized) {
      return `color-mix(in srgb, ${color} 20%, #777777)`;
    }

    const [r, g, b] = hexToRgb(normalized);
    const { h, s, l } = rgbToHsl(r, g, b);
    const mutedSaturation = Math.max(0, Math.min(s * 0.2, 1));

    return `hsl(${Math.round(h)}, ${(mutedSaturation * 100).toFixed(1)}%, ${(l * 100).toFixed(
      1
    )}%)`;
  }

  function normalizeHex(color) {
    if (typeof color !== 'string') return null;
    const trimmed = color.trim().toLowerCase();
    if (!trimmed.startsWith('#')) return null;

    const value = trimmed.slice(1);
    if (value.length === 3) {
      return value
        .split('')
        .map((char) => char + char)
        .join('');
    }

    if (value.length === 6) {
      return value;
    }

    return null;
  }

  function hexToRgb(hex) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16)
    ];
  }

  function rgbToHsl(r, g, b) {
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;

    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    const delta = max - min;

    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (delta !== 0) {
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

      switch (max) {
        case rNorm:
          h = (gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0);
          break;
        case gNorm:
          h = (bNorm - rNorm) / delta + 2;
          break;
        case bNorm:
          h = (rNorm - gNorm) / delta + 4;
          break;
      }

      h /= 6;
    }

    return { h: h * 360, s, l };
  }

  // ====== Scroll-driven assembly animation ======
  
  // Linear interpolation - smoothly transitions between two values
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Easing function for smooth acceleration/deceleration
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  // CORE ANIMATION FUNCTION - This is called every frame during scroll
  function updateDotBases(progress) {
    const eased = easeInOut(progress);

    // PERFORMANCE CRITICAL SECTION
    // We only update travelerDots (~7% of total) - this is the key optimization
    // 93% of dots (staticDots) are never touched during animation
    
    const len = travelerDots.length;
    
    // OPTIMIZATION: Separate calculation phase from DOM write phase
    // This prevents layout thrashing (alternating reads/writes that cause reflows)
    
    // Phase 1: Calculate all new positions (no DOM access)
    for (let i = 0; i < len; i++) {
      const dot = travelerDots[i];
      
      // Interpolate position from scatter to order based on progress
      const baseX = lerp(dot.scatterX, dot.orderX, eased);
      const baseY = lerp(dot.scatterY, dot.orderY, eased);
      
      // Interpolate scale from scattered size to full size
      const startScale = typeof dot.scatterScale === 'number' ? dot.scatterScale : 1;
      const baseScale = lerp(startScale, 1, eased);
      
      // Store calculated values in buffer
      updateBuffer[i] = {
        el: dot.el,
        x: baseX,
        y: baseY,
        scale: baseScale,
        shouldUnmute: dot.muted && eased >= dot.revealThreshold
      };
      
      // Update internal state
      if (updateBuffer[i].shouldUnmute) {
        dot.muted = false;
      }
    }

    // Phase 2: Apply all DOM updates in one batch (all writes together)
    // This causes a single reflow instead of multiple
    for (let i = 0; i < len; i++) {
      const { el, x, y, scale, shouldUnmute } = updateBuffer[i];
      
      // PERFORMANCE: Use transform directly (GPU accelerated)
      // Combining translate and scale in one property is faster than separate properties
      el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${scale.toFixed(3)})`;
      
      // Also update CSS variable for any CSS-based animations
      el.style.setProperty('--scale', scale.toFixed(3));
      
      // Remove muted state when threshold reached
      if (shouldUnmute) {
        el.classList.remove('is-muted');
      }
    }

    // Update order state for visual feedback
    setOrderState(eased);
  }

  function setOrderState(progress) {
    // FASTER ASSEMBLY: Trigger "assembled" state earlier (0.6 instead of 0.7)
    // This gives visual feedback sooner for fast scrollers
    const shouldOrder = progress > 0.6;
    
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

    // PERFORMANCE: Throttle scroll events using requestAnimationFrame
    // This ensures we only calculate once per frame, not multiple times
    if (!scrollTicking) {
      scrollTicking = true;
      
      requestAnimationFrame(() => {
        targetProgress = prefersReducedMotion ? 1 : calculateScrollProgress();
        
        // Start animation loop if not already running
        if (!progressFrame) {
          progressFrame = requestAnimationFrame(stepProgress);
        }
        
        scrollTicking = false;
      });
    }
  }

  function stepProgress() {
    const diff = targetProgress - currentProgress;

    // Stop animating when we're close enough to target
    if (Math.abs(diff) < 0.002) {
      currentProgress = targetProgress;
      updateDotBases(currentProgress);
      progressFrame = null;
      return;
    }

    // FASTER CONVERGENCE: Increased lerp speed from 0.35 to 0.45
    // This makes the animation respond faster to scrolling
    // Higher value = snappier, lower value = smoother but slower
    currentProgress += diff * 0.45;
    updateDotBases(currentProgress);
    progressFrame = requestAnimationFrame(stepProgress);
  }

  function calculateScrollProgress() {
    if (!heroSection || !mosaicStage) return 0;

    const scrollY = window.scrollY || window.pageYOffset;
    const viewport = window.innerHeight;

    const heroStart = heroSection.offsetTop;
    const heroHeight = heroSection.offsetHeight || viewport;

    // FASTER ASSEMBLY: Reduced from 0.8 to 0.6
    // Mosaic completes assembly earlier in the scroll range
    // This is better for fast scrollers who won't see the full animation
    const finish = heroStart + heroHeight * 0.6;

    const range = Math.max(finish - heroStart, 1);
    const raw = (scrollY + viewport * 0.1 - heroStart) / range;

    return clamp(raw, 0, 1);
  }

  // PERFORMANCE: Use passive scroll listener (doesn't block scrolling)
  window.addEventListener('scroll', handleScrollProgress, { passive: true });
})();