/**
 * Magic Move plugin for Reveal.js
 * Enables smooth animated transitions between code states
 *
 * Supports two modes:
 * 1. Div-based: Multiple code blocks in a ::: magic-move container (fragments)
 * 2. Slide-based: Consecutive slides with {.magic-move} class
 */
window.RevealMagicMove = window.RevealMagicMove || {
  id: 'magic-move',

  init: function(deck) {
    deck.on('ready', async function() {
      initDivBasedMagicMove(deck);
      initSlideBasedMagicMove(deck);
      await initSvgMagicMove(deck);
    });
  }
};

// =============================================================================
// SLIDE-BASED MAGIC MOVE
// =============================================================================

function initSlideBasedMagicMove(deck) {
  // Find all slides (sections) with .magic-move class
  const magicSlides = Array.from(document.querySelectorAll('section.magic-move'));

  if (magicSlides.length === 0) return;

  // Group consecutive magic-move slides into sequences
  const sequences = groupConsecutiveSlides(magicSlides, deck);

  if (sequences.length === 0) return;

  // Pre-parse tokens for each slide in each sequence
  for (const sequence of sequences) {
    for (let i = 0; i < sequence.slides.length; i++) {
      const slide = sequence.slides[i];
      const codeBlock = slide.querySelector('pre code');

      if (codeBlock) {
        let step = parseTokensFromHTML(codeBlock, i);
        step = splitTokensOnDelimiters(step);
        slide._magicMoveStep = step;
        slide._magicMoveSequence = sequence;
        slide.dataset.magicSequence = sequences.indexOf(sequence);
        slide.dataset.magicStep = i;
      }
    }

    // Assign keys across the sequence
    const steps = sequence.slides
      .map(s => s._magicMoveStep)
      .filter(Boolean);

    if (steps.length > 1) {
      assignTokenKeys(steps);
    }
  }

  // Create overlay container for animations
  const overlay = document.createElement('div');
  overlay.className = 'magic-move-slide-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1000;
  `;
  document.body.appendChild(overlay);

  // Track animation state
  let isAnimating = false;

  // Listen for slide changes
  deck.on('slidechanged', function(event) {
    const fromSlide = event.previousSlide;
    const toSlide = event.currentSlide;

    if (!fromSlide || !toSlide || isAnimating) return;

    const fromStep = fromSlide._magicMoveStep;
    const toStep = toSlide._magicMoveStep;
    const fromSequence = fromSlide._magicMoveSequence;
    const toSequence = toSlide._magicMoveSequence;

    // Only animate if both slides are in the same sequence
    if (!fromStep || !toStep || fromSequence !== toSequence) return;

    isAnimating = true;
    animateSlideMagicMove(fromSlide, toSlide, fromStep, toStep, overlay, deck, () => {
      isAnimating = false;
    });
  });
}

function groupConsecutiveSlides(magicSlides, deck) {
  // Get all slides in presentation order
  const allSlides = Array.from(deck.getSlides());
  const sequences = [];
  let currentSequence = null;

  for (let i = 0; i < allSlides.length; i++) {
    const slide = allSlides[i];
    const isMagic = magicSlides.includes(slide);

    if (isMagic) {
      // Check if this slide has a code block
      const hasCode = slide.querySelector('pre code') !== null;

      if (hasCode) {
        if (!currentSequence) {
          currentSequence = { slides: [], startIndex: i };
        }
        currentSequence.slides.push(slide);
      } else {
        // Magic slide without code - end current sequence
        if (currentSequence && currentSequence.slides.length > 1) {
          sequences.push(currentSequence);
        }
        currentSequence = null;
      }
    } else {
      // Non-magic slide - end current sequence
      if (currentSequence && currentSequence.slides.length > 1) {
        sequences.push(currentSequence);
      }
      currentSequence = null;
    }
  }

  // Don't forget the last sequence
  if (currentSequence && currentSequence.slides.length > 1) {
    sequences.push(currentSequence);
  }

  return sequences;
}

function animateSlideMagicMove(fromSlide, toSlide, fromStep, toStep, overlay, deck, onComplete) {
  const fromCodeBlock = fromSlide.querySelector('pre code');
  const toCodeBlock = toSlide.querySelector('pre code');

  if (!fromCodeBlock || !toCodeBlock) {
    onComplete();
    return;
  }

  const fromPre = fromCodeBlock.closest('pre');
  const toPre = toCodeBlock.closest('pre');

  // Temporarily show fromSlide to measure positions
  const fromSlideOriginalDisplay = fromSlide.style.display;
  const fromSlideOriginalVisibility = fromSlide.style.visibility;
  const fromSlideOriginalOpacity = fromSlide.style.opacity;

  fromSlide.style.display = 'block';
  fromSlide.style.visibility = 'visible';
  fromSlide.style.opacity = '0';

  // Capture the height of the from code block's sourceCode div
  const fromSourceCodeDiv = fromPre.closest('.sourceCode') || fromPre.parentElement;
  const fromHeight = fromSourceCodeDiv.getBoundingClientRect().height;

  // Get all tokens from the "from" code block and record their positions
  const fromTokens = getCodeTokens(fromCodeBlock);
  const fromTokenData = [];
  for (const token of fromTokens) {
    const rect = getTokenRect(token);
    const computedStyle = token.type === 'span'
      ? window.getComputedStyle(token.node)
      : window.getComputedStyle(token.node.parentElement);
    fromTokenData.push({
      content: token.content,
      classes: token.classes,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      computedStyle: computedStyle
    });
  }

  // Restore fromSlide
  fromSlide.style.display = fromSlideOriginalDisplay;
  fromSlide.style.visibility = fromSlideOriginalVisibility;
  fromSlide.style.opacity = fromSlideOriginalOpacity;

  // Get all tokens from the "to" code block
  const toTokens = getCodeTokens(toCodeBlock);
  const toSpanData = [];
  for (const token of toTokens) {
    const rect = getTokenRect(token);
    const computed = token.type === 'span'
      ? window.getComputedStyle(token.node)
      : window.getComputedStyle(token.node.parentElement);
    // Capture style VALUES (not live reference) since we'll modify styles later
    toSpanData.push({
      node: token.node,
      content: token.content,
      classes: token.classes,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      styles: {
        fontFamily: computed.fontFamily,
        fontSize: computed.fontSize,
        lineHeight: computed.lineHeight,
        letterSpacing: computed.letterSpacing,
        color: computed.color,
        fontWeight: computed.fontWeight,
        fontStyle: computed.fontStyle
      }
    });
  }

  // Match "to" tokens with "from" tokens by content + classes
  const usedFromIndices = new Set();
  for (const toData of toSpanData) {
    const matchKey = `${toData.content}|${toData.classes}`;

    // Find a matching "from" token that hasn't been used
    for (let i = 0; i < fromTokenData.length; i++) {
      if (usedFromIndices.has(i)) continue;
      const fromData = fromTokenData[i];
      const fromKey = `${fromData.content}|${fromData.classes}`;

      if (matchKey === fromKey) {
        toData.matchedFrom = fromData;
        usedFromIndices.add(i);
        break;
      }
    }
  }

  // Capture the natural height of the to code block's sourceCode div
  const toSourceCodeDiv = toPre.closest('.sourceCode') || toPre.parentElement;
  const toHeightMeasured = toSourceCodeDiv.getBoundingClientRect().height;

  // Get reveal.js scale factor - measurements are in screen pixels but CSS needs unscaled values
  const slidesContainer = document.querySelector('.reveal .slides');
  const slidesTransform = window.getComputedStyle(slidesContainer).transform;
  let scale = 1;
  if (slidesTransform && slidesTransform !== 'none') {
    const matrix = new DOMMatrix(slidesTransform);
    scale = matrix.a;
  }

  // Convert screen pixels to CSS pixels by dividing by scale
  const fromHeightCSS = fromHeight / scale;
  const toHeightCSS = toHeightMeasured / scale;

  // Animate height using the sourceCode div
  // Set initial height to match the from slide
  toSourceCodeDiv.style.height = `${fromHeightCSS}px`;
  toSourceCodeDiv.style.overflow = 'hidden';
  toSourceCodeDiv.style.transition = 'height 0.5s ease-in-out';

  // Use requestAnimationFrame to ensure layout is complete before animating
  requestAnimationFrame(() => {
    toSourceCodeDiv.style.height = `${toHeightCSS}px`;
  });

  // Make the code text transparent (but keep structure for line numbers)
  toCodeBlock.style.color = 'transparent';
  // Also hide any syntax-highlighted spans
  const codeSpans = toCodeBlock.querySelectorAll('span');
  for (const span of codeSpans) {
    span.style.color = 'transparent';
  }

  // Create animated clones in the overlay for ALL "to" spans
  const clones = [];

  for (const toData of toSpanData) {
    const hasMatch = !!toData.matchedFrom;
    const fromData = toData.matchedFrom;

    const clone = document.createElement('span');
    clone.textContent = toData.content;

    // Use captured style values (not live reference)
    const styles = toData.styles;

    // Starting position: from position if matched, to position if new
    const startX = hasMatch ? fromData.x : toData.x;
    const startY = hasMatch ? fromData.y : toData.y;
    const startOpacity = hasMatch ? 1 : 0;

    // Scale font size to match visual rendering (reveal.js uses CSS transforms)
    const fontSize = parseFloat(styles.fontSize) * scale;
    const lineHeight = parseFloat(styles.lineHeight) * scale;

    clone.style.cssText = `
      position: fixed;
      left: ${startX}px;
      top: ${startY}px;
      font-family: ${styles.fontFamily};
      font-size: ${fontSize}px;
      line-height: ${isNaN(lineHeight) ? 'normal' : lineHeight + 'px'};
      letter-spacing: ${styles.letterSpacing};
      color: ${styles.color};
      font-weight: ${styles.fontWeight};
      font-style: ${styles.fontStyle};
      white-space: pre;
      pointer-events: none;
      opacity: ${startOpacity};
    `;

    overlay.appendChild(clone);
    clones.push({ clone, toData, hasMatch });
  }

  // Force reflow
  overlay.offsetHeight;

  // Delay token animation to let height expand first
  const heightAnimationDelay = 250; // ms

  setTimeout(() => {
    // Add transitions to clones
    for (const { clone } of clones) {
      clone.style.transition = 'left 0.5s ease-in-out, top 0.5s ease-in-out, opacity 0.5s ease-in-out';
    }

    // Force reflow
    overlay.offsetHeight;

    // Animate to final positions
    for (const { clone, toData, hasMatch } of clones) {
      clone.style.left = `${toData.x}px`;
      clone.style.top = `${toData.y}px`;
      if (!hasMatch) {
        clone.style.opacity = '1';
      }
    }
  }, heightAnimationDelay);

  // Clean up after both animations complete
  setTimeout(() => {
    // Restore code text colors
    toCodeBlock.style.color = '';
    for (const span of codeSpans) {
      span.style.color = '';
    }


    // Remove clones
    for (const { clone } of clones) {
      clone.remove();
    }

    // Reset sourceCodeDiv styles
    toSourceCodeDiv.style.height = '';
    toSourceCodeDiv.style.overflow = '';
    toSourceCodeDiv.style.transition = '';

    onComplete();
  }, heightAnimationDelay + 550); // Height delay + token animation duration
}

// Get bounding rect for a token (handles partial text nodes)
function getTokenRect(token) {
  if (token.type === 'text') {
    const range = document.createRange();
    range.setStart(token.node, token.offset);
    range.setEnd(token.node, token.offset + token.length);
    return range.getBoundingClientRect();
  } else {
    return token.node.getBoundingClientRect();
  }
}

// Get all text content from a code block - both spans and text nodes
// Split text nodes into finer tokens for better matching
function getCodeTokens(codeElement) {
  const tokens = [];

  // Get line wrapper spans (they have id like "cb1-1", "cb2-3", etc.)
  const lineSpans = codeElement.querySelectorAll('span[id]');

  for (const lineSpan of lineSpans) {
    // Iterate through all child nodes of the line
    for (const node of lineSpan.childNodes) {
      // Skip anchor elements (line number links)
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'A') {
        continue;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        // Plain text node - split into smaller tokens
        const text = node.textContent;
        if (text) {
          // Split on delimiters but keep them as separate tokens
          // Each delimiter becomes its own token
          const parts = text.split(/([()[\]{},]|\s+)/);
          let offset = 0;

          for (const part of parts) {
            if (part === '') continue;

            tokens.push({
              type: 'text',
              node: node,
              content: part,
              classes: '',
              offset: offset,
              length: part.length
            });
            offset += part.length;
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SPAN') {
        // Span element
        tokens.push({
          type: 'span',
          node: node,
          content: node.textContent,
          classes: Array.from(node.classList).join(','),
          offset: 0,
          length: node.textContent.length
        });
      }
    }
  }

  return tokens;
}

// =============================================================================
// SVG MAGIC MOVE
// =============================================================================

async function initSvgMagicMove(deck) {
  // Find all slides with .magic-move class that contain SVGs (or will contain SVGs)
  const magicSlides = Array.from(document.querySelectorAll('section.magic-move'));

  if (magicSlides.length === 0) return;

  // Check which slides have SVGs (either already inlined or as img tags)
  // Note: Reveal.js uses data-src for lazy-loaded images
  for (const slide of magicSlides) {
    const hasSvg = slide.querySelector('svg') !== null;
    const hasSvgImg = slide.querySelector('img[src$=".svg"], img[data-src$=".svg"]') !== null;
    slide._hasSvgContent = hasSvg || hasSvgImg;
  }

  // Pre-inline ALL SVGs at initialization to avoid layout shifts later
  for (const slide of magicSlides) {
    if (slide._hasSvgContent) {
      await inlineSvgImages(slide);
    }
  }

  // Group consecutive magic-move slides that have SVG content
  const sequences = groupConsecutiveSvgSlides(magicSlides, deck);

  if (sequences.length === 0) return;

  // Track animation state
  let isAnimating = false;

  // Listen for slide changes
  deck.on('slidechanged', async function(event) {
    const fromSlide = event.previousSlide;
    const toSlide = event.currentSlide;

    if (!fromSlide || !toSlide || isAnimating) return;

    // Check if both slides are in the same SVG sequence
    const fromSeq = fromSlide._svgMagicSequence;
    const toSeq = toSlide._svgMagicSequence;

    if (!fromSeq || !toSeq || fromSeq !== toSeq) return;

    const fromSvg = fromSlide.querySelector('svg');
    const toSvg = toSlide.querySelector('svg');

    if (!fromSvg || !toSvg) return;

    isAnimating = true;
    animateSvgMagicMove(fromSlide, toSlide, fromSvg, toSvg, deck, () => {
      isAnimating = false;
    });
  });
}

async function inlineSvgImages(slide) {
  // Handle both src and data-src (Reveal.js lazy loading)
  const svgImages = slide.querySelectorAll('img[src$=".svg"], img[data-src$=".svg"]');

  for (const img of svgImages) {
    try {
      // Use src if available, otherwise data-src (for lazy-loaded images)
      const svgUrl = img.src || img.getAttribute('data-src');
      if (!svgUrl || !svgUrl.endsWith('.svg')) continue;

      // Capture computed dimensions BEFORE replacing
      const computedStyle = window.getComputedStyle(img);
      const rect = img.getBoundingClientRect();

      const response = await fetch(svgUrl);
      const svgText = await response.text();
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
      const svgElement = svgDoc.documentElement;

      // Copy classes from img (important for r-stretch)
      if (img.className) svgElement.setAttribute('class', img.className);

      // Copy inline styles from img
      if (img.style.cssText) {
        svgElement.style.cssText = img.style.cssText;
      }

      // Ensure SVG has a viewBox for proper scaling with r-stretch
      if (!svgElement.getAttribute('viewBox')) {
        const svgWidth = svgElement.getAttribute('width') || rect.width;
        const svgHeight = svgElement.getAttribute('height') || rect.height;
        if (svgWidth && svgHeight) {
          svgElement.setAttribute('viewBox', `0 0 ${parseFloat(svgWidth)} ${parseFloat(svgHeight)}`);
        }
      }

      // For r-stretch to work properly, remove fixed width/height and let CSS control sizing
      // But preserve aspect ratio via viewBox
      if (img.classList.contains('r-stretch')) {
        svgElement.removeAttribute('width');
        svgElement.removeAttribute('height');
        svgElement.style.width = '100%';
        svgElement.style.height = '100%';
      } else {
        // Preserve explicit dimensions if set
        if (rect.width > 0) svgElement.setAttribute('width', rect.width);
        if (rect.height > 0) svgElement.setAttribute('height', rect.height);
      }

      // Ensure SVG displays as block to avoid baseline alignment issues
      // (inline SVGs can cause extra spacing due to text baseline)
      svgElement.style.display = 'block';

      // Mark as inlined for identification
      svgElement.dataset.inlined = 'true';
      svgElement.dataset.originalSrc = svgUrl;

      img.replaceWith(svgElement);
    } catch (e) {
      console.warn('Failed to inline SVG:', svgUrl, e);
    }
  }
}

function groupConsecutiveSvgSlides(magicSlides, deck) {
  const allSlides = Array.from(deck.getSlides());
  const sequences = [];
  let currentSequence = null;

  for (let i = 0; i < allSlides.length; i++) {
    const slide = allSlides[i];
    const isMagic = magicSlides.includes(slide);

    if (isMagic) {
      // Use the pre-computed flag that checks for both svg and img[src$=".svg"]
      const hasSvg = slide._hasSvgContent === true;

      if (hasSvg) {
        if (!currentSequence) {
          currentSequence = { slides: [], startIndex: i };
        }
        currentSequence.slides.push(slide);
        slide._svgMagicSequence = currentSequence;
        slide.dataset.svgMagicStep = currentSequence.slides.length - 1;
      } else {
        if (currentSequence && currentSequence.slides.length > 1) {
          sequences.push(currentSequence);
        }
        currentSequence = null;
      }
    } else {
      if (currentSequence && currentSequence.slides.length > 1) {
        sequences.push(currentSequence);
      }
      currentSequence = null;
    }
  }

  if (currentSequence && currentSequence.slides.length > 1) {
    sequences.push(currentSequence);
  }

  return sequences;
}

function animateSvgMagicMove(fromSlide, toSlide, fromSvg, toSvg, deck, onComplete) {
  // Parse paths and rects from both SVGs
  const fromPaths = parseSvgPaths(fromSvg);
  const toPaths = parseSvgPaths(toSvg);
  const fromRects = parseSvgRects(fromSvg);
  const toRects = parseSvgRects(toSvg);

  // Match paths between SVGs
  const pathMatches = matchSvgPaths(fromPaths, toPaths);
  const rectMatches = matchSvgRects(fromRects, toRects);

  if (pathMatches.length === 0 && rectMatches.length === 0) {
    onComplete();
    return;
  }

  // Temporarily show fromSlide to get positions
  const fromSlideOriginalDisplay = fromSlide.style.display;
  const fromSlideOriginalVisibility = fromSlide.style.visibility;
  const fromSlideOriginalOpacity = fromSlide.style.opacity;

  fromSlide.style.display = 'block';
  fromSlide.style.visibility = 'visible';
  fromSlide.style.opacity = '0';

  // Capture "from" path data
  for (const match of pathMatches) {
    match.fromD = match.fromPath.getAttribute('d');
  }

  // Capture "from" rect data
  for (const match of rectMatches) {
    match.fromX = parseFloat(match.fromRect.getAttribute('x'));
    match.fromY = parseFloat(match.fromRect.getAttribute('y'));
    match.fromWidth = parseFloat(match.fromRect.getAttribute('width'));
    match.fromHeight = parseFloat(match.fromRect.getAttribute('height'));
  }

  // Restore fromSlide
  fromSlide.style.display = fromSlideOriginalDisplay;
  fromSlide.style.visibility = fromSlideOriginalVisibility;
  fromSlide.style.opacity = fromSlideOriginalOpacity;

  // Capture "to" path data and set up animation
  for (const match of pathMatches) {
    match.toD = match.toPath.getAttribute('d');

    // Set the "to" path to start at the "from" position
    match.toPath.setAttribute('d', match.fromD);
    match.toPath.style.transition = 'none';
  }

  // Capture "to" rect data and set up animation
  for (const match of rectMatches) {
    match.toX = parseFloat(match.toRect.getAttribute('x'));
    match.toY = parseFloat(match.toRect.getAttribute('y'));
    match.toWidth = parseFloat(match.toRect.getAttribute('width'));
    match.toHeight = parseFloat(match.toRect.getAttribute('height'));

    // Set the "to" rect to start at the "from" position
    match.toRect.setAttribute('x', match.fromX);
    match.toRect.setAttribute('y', match.fromY);
    match.toRect.setAttribute('width', match.fromWidth);
    match.toRect.setAttribute('height', match.fromHeight);
  }

  // Force reflow
  toSvg.getBoundingClientRect();

  // Animate to final positions
  requestAnimationFrame(() => {
    for (const match of pathMatches) {
      animatePath(match.toPath, match.fromD, match.toD, 500);
    }
    for (const match of rectMatches) {
      animateRect(match.toRect, match, 500);
    }
  });

  // Clean up after animation
  setTimeout(() => {
    onComplete();
  }, 550);
}

function parseSvgPaths(svg) {
  const paths = [];

  // Find all path elements
  const pathElements = svg.querySelectorAll('path');

  for (const path of pathElements) {
    const d = path.getAttribute('d');
    if (!d) continue;

    // Get parent clip-path for identification
    const parent = path.closest('g[clip-path]');
    const clipPath = parent ? parent.getAttribute('clip-path') : null;

    // Get stroke/fill properties for matching
    const stroke = path.getAttribute('stroke') ||
                   window.getComputedStyle(path).stroke;
    const fill = path.getAttribute('fill') ||
                 window.getComputedStyle(path).fill;
    const strokeWidth = path.getAttribute('stroke-width') ||
                        window.getComputedStyle(path).strokeWidth;

    paths.push({
      element: path,
      d: d,
      clipPath: clipPath,
      stroke: stroke,
      fill: fill,
      strokeWidth: strokeWidth,
      // Parse path type (M, L, C, etc.)
      pathType: getPathType(d),
      elementType: 'path'
    });
  }

  return paths;
}

function parseSvgRects(svg) {
  const rects = [];

  // Find all rect elements (used by ggplot2 for bars, histograms, etc.)
  const rectElements = svg.querySelectorAll('rect');

  for (const rect of rectElements) {
    const x = rect.getAttribute('x');
    const y = rect.getAttribute('y');
    const width = rect.getAttribute('width');
    const height = rect.getAttribute('height');

    // Skip background rects (usually full-size white backgrounds)
    if (!x || !y || !width || !height) continue;

    // Get parent clip-path for identification
    const parent = rect.closest('g[clip-path]');
    const clipPath = parent ? parent.getAttribute('clip-path') : null;

    // Get stroke/fill properties for matching
    const stroke = rect.getAttribute('stroke') ||
                   window.getComputedStyle(rect).stroke;
    const fill = rect.getAttribute('fill') ||
                 window.getComputedStyle(rect).fill;
    const strokeWidth = rect.getAttribute('stroke-width') ||
                        window.getComputedStyle(rect).strokeWidth;

    rects.push({
      element: rect,
      x: parseFloat(x),
      y: parseFloat(y),
      width: parseFloat(width),
      height: parseFloat(height),
      clipPath: clipPath,
      stroke: stroke,
      fill: fill,
      strokeWidth: strokeWidth,
      elementType: 'rect'
    });
  }

  return rects;
}

function getPathType(d) {
  // Simple classification of path type
  const commands = d.match(/[MLHVCSQTAZ]/gi) || [];
  return commands.join('');
}

function matchSvgPaths(fromPaths, toPaths) {
  const matches = [];
  const usedTo = new Set();

  // First pass: match clipped paths by clip-path + pathType (original logic)
  // This handles ablines and other clipped elements
  for (const fromPath of fromPaths) {
    if (!fromPath.clipPath) continue;  // Skip unclipped paths for now

    for (let i = 0; i < toPaths.length; i++) {
      if (usedTo.has(i)) continue;

      const toPath = toPaths[i];

      const sameClip = fromPath.clipPath === toPath.clipPath;
      const sameType = fromPath.pathType === toPath.pathType;
      const differentD = fromPath.d !== toPath.d;

      if (sameClip && sameType && differentD) {
        matches.push({
          fromPath: fromPath.element,
          toPath: toPath.element
        });
        usedTo.add(i);
        break;
      }
    }
  }

  // Second pass: match unclipped paths by visual signature (for circles, etc.)
  const unclippedFrom = fromPaths.filter(p => !p.clipPath);
  const unclippedTo = toPaths.filter((p, i) => !p.clipPath && !usedTo.has(i));

  const fromByType = groupPathsByType(unclippedFrom);
  const toByType = groupPathsByType(unclippedTo);

  for (const type of Object.keys(fromByType)) {
    const fromGroup = fromByType[type] || [];
    const toGroup = toByType[type] || [];

    const count = Math.min(fromGroup.length, toGroup.length);
    for (let i = 0; i < count; i++) {
      const fromPath = fromGroup[i];
      const toPath = toGroup[i];

      if (fromPath.d !== toPath.d) {
        matches.push({
          fromPath: fromPath.element,
          toPath: toPath.element
        });
      }
    }
  }

  return matches;
}

function groupPathsByType(paths) {
  const groups = {};

  for (const path of paths) {
    // Create a signature based on visual properties (not position)
    const signature = createPathSignature(path);

    if (!groups[signature]) {
      groups[signature] = [];
    }
    groups[signature].push(path);
  }

  return groups;
}

function createPathSignature(path) {
  // Create a signature that identifies "same kind" of path
  // Based on: clipPath, fill, stroke, stroke-width, path structure (commands used)
  const parts = [
    path.clipPath || 'none',  // Important: paths in different clip regions shouldn't match
    path.fill || 'none',
    path.stroke || 'none',
    path.strokeWidth || '0',
    path.pathType // e.g., "MCCC" for circles
  ];
  return parts.join('|');
}

function matchSvgRects(fromRects, toRects) {
  const matches = [];

  // Group rects by their visual characteristics
  const fromByType = groupRectsByType(fromRects);
  const toByType = groupRectsByType(toRects);

  // Match rects within each type group by x-position order (left to right)
  for (const type of Object.keys(fromByType)) {
    const fromGroup = fromByType[type] || [];
    const toGroup = toByType[type] || [];

    // Sort by x position to match bars left-to-right
    fromGroup.sort((a, b) => a.x - b.x);
    toGroup.sort((a, b) => a.x - b.x);

    // Match by position in sorted group
    const count = Math.min(fromGroup.length, toGroup.length);
    for (let i = 0; i < count; i++) {
      const fromRect = fromGroup[i];
      const toRect = toGroup[i];

      // Only animate if something differs
      const differs = fromRect.x !== toRect.x ||
                      fromRect.y !== toRect.y ||
                      fromRect.width !== toRect.width ||
                      fromRect.height !== toRect.height;

      if (differs) {
        matches.push({
          fromRect: fromRect.element,
          toRect: toRect.element
        });
      }
    }
  }

  return matches;
}

function groupRectsByType(rects) {
  const groups = {};

  for (const rect of rects) {
    // Create a signature based on visual properties
    const signature = createRectSignature(rect);

    if (!groups[signature]) {
      groups[signature] = [];
    }
    groups[signature].push(rect);
  }

  return groups;
}

function createRectSignature(rect) {
  // Create a signature that identifies "same kind" of rect
  const parts = [
    rect.clipPath || 'none',  // Rects in different clip regions shouldn't match
    rect.fill || 'none',
    rect.stroke || 'none',
    rect.strokeWidth || '0'
  ];
  return parts.join('|');
}

function animateRect(rectElement, match, duration) {
  const startTime = performance.now();

  const fromX = match.fromX;
  const fromY = match.fromY;
  const fromWidth = match.fromWidth;
  const fromHeight = match.fromHeight;
  const toX = match.toX;
  const toY = match.toY;
  const toWidth = match.toWidth;
  const toHeight = match.toHeight;

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing: ease-in-out
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    // Interpolate attributes
    const x = fromX + (toX - fromX) * eased;
    const y = fromY + (toY - fromY) * eased;
    const width = fromWidth + (toWidth - fromWidth) * eased;
    const height = fromHeight + (toHeight - fromHeight) * eased;

    rectElement.setAttribute('x', x);
    rectElement.setAttribute('y', y);
    rectElement.setAttribute('width', width);
    rectElement.setAttribute('height', height);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}

function animatePath(pathElement, fromD, toD, duration) {
  // Parse the path commands
  const fromCoords = parsePathCoordinates(fromD);
  const toCoords = parsePathCoordinates(toD);

  if (!fromCoords || !toCoords || fromCoords.length !== toCoords.length) {
    // Can't interpolate, just set final value
    pathElement.setAttribute('d', toD);
    return;
  }

  const startTime = performance.now();

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing: ease-in-out
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    // Interpolate coordinates
    const interpolated = interpolateCoordinates(fromCoords, toCoords, eased);

    // Reconstruct path
    const newD = reconstructPath(interpolated);
    pathElement.setAttribute('d', newD);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}

function parsePathCoordinates(d) {
  // Parse a simple path like "M x1 y1 L x2 y2"
  const result = [];

  // Match command letters and their following numbers
  const regex = /([MLHVCSQTAZ])\s*([-\d.\s,]*)/gi;
  let match;

  while ((match = regex.exec(d)) !== null) {
    const command = match[1];
    const coordString = match[2].trim();
    const coords = coordString.split(/[\s,]+/).filter(s => s).map(Number);

    result.push({ command, coords });
  }

  return result;
}

function interpolateCoordinates(from, to, t) {
  const result = [];

  for (let i = 0; i < from.length; i++) {
    const fromCmd = from[i];
    const toCmd = to[i];

    const interpolatedCoords = fromCmd.coords.map((val, j) => {
      return val + (toCmd.coords[j] - val) * t;
    });

    result.push({ command: fromCmd.command, coords: interpolatedCoords });
  }

  return result;
}

function reconstructPath(parsed) {
  return parsed.map(p => {
    return p.command + ' ' + p.coords.join(' ');
  }).join(' ');
}

// =============================================================================
// DIV-BASED MAGIC MOVE (existing implementation)
// =============================================================================

function initDivBasedMagicMove(deck) {
  const containers = document.querySelectorAll('.magic-move:not(section)');

  for (const container of containers) {
    const codeBlocks = container.querySelectorAll('pre code');
    if (codeBlocks.length < 2) continue;

    // Auto-generate fragment markers between code blocks
    const pres = container.querySelectorAll('pre');
    for (let i = 0; i < pres.length - 1; i++) {
      // Check if there's already a fragment after this pre
      let nextSibling = pres[i].nextElementSibling;
      while (nextSibling && nextSibling.tagName === 'DIV' && nextSibling.classList.contains('sourceCode')) {
        // Skip sourceCode wrapper divs
        nextSibling = nextSibling.nextElementSibling;
      }

      const hasFragment = nextSibling?.querySelector?.('.magic-move-step') ||
                          nextSibling?.classList?.contains('magic-move-step');

      if (!hasFragment) {
        // Insert a fragment marker
        const fragment = document.createElement('span');
        fragment.className = 'fragment magic-move-step';
        fragment.dataset.fragmentIndex = i;

        // Insert after the pre (or its wrapper)
        const insertAfter = pres[i].closest('.sourceCode') || pres[i];
        insertAfter.parentNode.insertBefore(fragment, insertAfter.nextSibling);
      }
    }

    // Re-sync reveal.js to recognize new fragments
    deck.sync();

    // Parse tokens from each highlighted code block
    let steps = Array.from(codeBlocks).map((block, stepIndex) => {
      return parseTokensFromHTML(block, stepIndex);
    });

    // Post-process: split tokens on delimiters (parens, brackets, commas) for better animations
    steps = steps.map(step => splitTokensOnDelimiters(step));

    // Assign keys to tokens for matching across steps
    assignTokenKeys(steps);

    // Calculate max height needed
    const maxLines = Math.max(...steps.map(s => s.lines.length));

    // Create render container - replicate Quarto's structure:
    // <div class="sourceCode"><pre class="sourceCode r"><code class="sourceCode r">
    const firstPre = container.querySelector('pre');
    const originalCode = container.querySelector('pre code');
    // Detect language from original code block classes (e.g., "sourceCode r" -> "r")
    const langClass = originalCode ? [...originalCode.classList].find(c => c !== 'sourceCode') : null;
    const lang = langClass || container.dataset.lang || 'r';

    // Outer div with sourceCode class
    const outerDiv = document.createElement('div');
    outerDiv.className = 'sourceCode magic-move-wrapper-outer';

    const wrapper = document.createElement('pre');
    wrapper.className = `sourceCode ${lang} magic-move-wrapper`;

    const computedStyle = window.getComputedStyle(firstPre);
    wrapper.style.background = computedStyle.backgroundColor || '#24292e';
    wrapper.style.color = computedStyle.color || '#e1e4e8';
    wrapper.style.minHeight = (maxLines * 1.5 + 2) + 'em';

    const renderTarget = document.createElement('code');
    renderTarget.className = `sourceCode ${lang} magic-move-render`;
    renderTarget.style.minHeight = (maxLines * 1.5) + 'em';
    wrapper.appendChild(renderTarget);
    outerDiv.appendChild(wrapper);

    // Hide original code blocks
    container.querySelectorAll('pre').forEach(pre => pre.style.display = 'none');
    container.querySelectorAll('p').forEach(p => {
      if (p.querySelector('.magic-move-step')) p.style.display = 'none';
    });
    container.insertBefore(outerDiv, container.firstChild);

    // Render first step
    let currentStep = 0;
    renderStep(renderTarget, steps[0]);

    const slide = container.closest('section');

    // Handle fragment navigation
    deck.on('fragmentshown', (event) => {
      if (slide.contains(event.fragment) && event.fragment.classList.contains('magic-move-step')) {
        currentStep++;
        if (currentStep < steps.length) {
          animateToStep(renderTarget, steps[currentStep - 1], steps[currentStep]);
        }
      }
    });

    deck.on('fragmenthidden', (event) => {
      if (slide.contains(event.fragment) && event.fragment.classList.contains('magic-move-step')) {
        currentStep--;
        if (currentStep >= 0) {
          animateToStep(renderTarget, steps[currentStep + 1], steps[currentStep]);
        }
      }
    });
  }
}

// =============================================================================
// SHARED UTILITIES
// =============================================================================

// Post-process tokens: split on delimiters for finer-grained matching
function splitTokensOnDelimiters(step) {
  const delimiters = /([()[\]{},])/;

  const newLines = [];
  const newTokens = [];
  let tokenIndex = 0;

  for (const line of step.lines) {
    const newLine = [];

    for (const token of line) {
      // Split the content on delimiters, keeping the delimiters
      const parts = token.content.split(delimiters).filter(p => p !== '');

      if (parts.length === 1) {
        // No split needed
        const newToken = { ...token, tokenIndex: tokenIndex++ };
        newLine.push(newToken);
        newTokens.push(newToken);
      } else {
        // Create a token for each part
        for (const part of parts) {
          const newToken = {
            content: part,
            classes: [...token.classes],
            stepIndex: token.stepIndex,
            tokenIndex: tokenIndex++
          };
          newLine.push(newToken);
          newTokens.push(newToken);
        }
      }
    }

    newLines.push(newLine);
  }

  return { lines: newLines, tokens: newTokens };
}

// Parse tokens from Quarto's syntax highlighting output
function parseTokensFromHTML(codeElement, stepIndex) {
  const lines = [];
  const allTokens = [];
  let tokenIndex = 0;

  // Get line spans (they have id like "cb1-1", "cb1-2", etc.)
  const lineSpans = codeElement.querySelectorAll(':scope > span[id]');

  if (lineSpans.length === 0) {
    // Fallback: no line spans, parse directly
    const lineTokens = [];
    for (const node of codeElement.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (text) {
          const token = {
            content: text,
            classes: [],
            stepIndex,
            tokenIndex: tokenIndex++
          };
          lineTokens.push(token);
          allTokens.push(token);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SPAN') {
        const classes = Array.from(node.classList);
        const text = node.textContent;
        if (text) {
          const token = {
            content: text,
            classes: classes,
            stepIndex,
            tokenIndex: tokenIndex++
          };
          lineTokens.push(token);
          allTokens.push(token);
        }
      }
    }
    lines.push(lineTokens);
  } else {
    for (const lineSpan of lineSpans) {
      const lineTokens = [];

      for (const node of lineSpan.childNodes) {
        // Skip anchor elements
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'A') {
          continue;
        }

        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent;
          if (text) {
            const token = {
              content: text,
              classes: [],
              stepIndex,
              tokenIndex: tokenIndex++
            };
            lineTokens.push(token);
            allTokens.push(token);
          }
        } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SPAN') {
          const classes = Array.from(node.classList);
          const text = node.textContent;
          if (text) {
            const token = {
              content: text,
              classes: classes,
              stepIndex,
              tokenIndex: tokenIndex++
            };
            lineTokens.push(token);
            allTokens.push(token);
          }
        }
      }

      lines.push(lineTokens);
    }
  }

  return { lines, tokens: allTokens };
}

// Assign keys to tokens for matching
function assignTokenKeys(steps) {
  let keyCounter = 0;

  // First pass: assign unique keys to first step
  for (const token of steps[0].tokens) {
    token.key = `token-${keyCounter++}`;
  }

  // For subsequent steps, try to match with previous step
  for (let stepIdx = 1; stepIdx < steps.length; stepIdx++) {
    const prevStep = steps[stepIdx - 1];
    const currStep = steps[stepIdx];

    // Match tokens globally
    matchSteps(prevStep, currStep);

    // Assign new keys to unmatched tokens
    for (const token of currStep.tokens) {
      if (!token.key) {
        token.key = `token-${keyCounter++}`;
      }
    }
  }
}

function matchSteps(prevStep, currStep) {
  // Global token matching by content + classes
  const usedPrev = new Set();

  // First pass: exact match (content + classes)
  for (const currToken of currStep.tokens) {
    for (let i = 0; i < prevStep.tokens.length; i++) {
      if (usedPrev.has(i)) continue;

      const prevToken = prevStep.tokens[i];
      if (prevToken.content === currToken.content &&
          arraysEqual(prevToken.classes, currToken.classes)) {
        currToken.key = prevToken.key;
        usedPrev.add(i);
        break;
      }
    }
  }

  // Second pass: content-only match for remaining unmatched tokens
  for (const currToken of currStep.tokens) {
    if (currToken.key) continue; // already matched

    for (let i = 0; i < prevStep.tokens.length; i++) {
      if (usedPrev.has(i)) continue;

      const prevToken = prevStep.tokens[i];
      if (prevToken.content === currToken.content) {
        currToken.key = prevToken.key;
        usedPrev.add(i);
        break;
      }
    }
  }
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function renderStep(container, step) {
  container.innerHTML = '';

  for (let lineIdx = 0; lineIdx < step.lines.length; lineIdx++) {
    const line = step.lines[lineIdx];

    // Create line wrapper span (like Quarto's <span id="cb1-1">)
    const lineSpan = document.createElement('span');
    lineSpan.id = `mm-${container.closest('.magic-move')?.dataset.lang || 'code'}-${lineIdx + 1}`;

    for (const token of line) {
      const span = document.createElement('span');
      span.className = token.classes.join(' ');
      span.textContent = token.content;
      span.dataset.key = token.key;
      lineSpan.appendChild(span);
    }

    container.appendChild(lineSpan);

    // Add newline between lines (except after last line)
    if (lineIdx < step.lines.length - 1) {
      container.appendChild(document.createTextNode('\n'));
    }
  }
}

function animateToStep(container, fromStep, toStep) {
  const fromKeys = new Set(fromStep.tokens.map(t => t.key));
  const toKeys = new Set(toStep.tokens.map(t => t.key));

  // FLIP: First - record current positions
  const oldPositions = new Map();
  const currentSpans = container.querySelectorAll('span > span[data-key]');
  for (const span of currentSpans) {
    const rect = span.getBoundingClientRect();
    oldPositions.set(span.dataset.key, { x: rect.left, y: rect.top });
  }

  // Render new state (Last)
  container.innerHTML = '';

  for (let lineIdx = 0; lineIdx < toStep.lines.length; lineIdx++) {
    const line = toStep.lines[lineIdx];

    const lineSpan = document.createElement('span');
    lineSpan.id = `mm-${container.closest('.magic-move')?.dataset.lang || 'code'}-${lineIdx + 1}`;

    for (const token of line) {
      const span = document.createElement('span');
      span.className = token.classes.join(' ');
      span.textContent = token.content;
      span.dataset.key = token.key;
      lineSpan.appendChild(span);
    }

    container.appendChild(lineSpan);

    if (lineIdx < toStep.lines.length - 1) {
      container.appendChild(document.createTextNode('\n'));
    }
  }

  // Invert & Play
  const newSpans = container.querySelectorAll('span > span[data-key]');
  for (const span of newSpans) {
    const key = span.dataset.key;

    if (oldPositions.has(key)) {
      // FLIP: Invert - calculate delta and apply transform
      const oldPos = oldPositions.get(key);
      const newRect = span.getBoundingClientRect();
      const deltaX = oldPos.x - newRect.left;
      const deltaY = oldPos.y - newRect.top;

      if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
        // Apply inverted position (no transition)
        span.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        span.style.transition = 'none';

        // Force reflow
        span.offsetHeight;

        // Play - animate to final position
        span.style.transition = 'transform 0.5s ease-in-out';
        span.style.transform = '';
      }
    } else {
      // New token - fade in
      span.dataset.entering = 'true';
    }
  }
}
