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
    deck.on('ready', function() {
      initDivBasedMagicMove(deck);
      initSlideBasedMagicMove(deck);
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

  // Capture the height of the from code block
  const fromPreHeight = fromPre.getBoundingClientRect().height;

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
    const computedStyle = token.type === 'span'
      ? window.getComputedStyle(token.node)
      : window.getComputedStyle(token.node.parentElement);
    toSpanData.push({
      node: token.node,
      content: token.content,
      classes: token.classes,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      computedStyle: computedStyle
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

  // Capture the natural height of the to code block
  const toPreNaturalHeight = toPre.getBoundingClientRect().height;

  // Set up height animation: start at fromHeight, animate to toHeight
  toPre.style.height = `${fromPreHeight}px`;
  toPre.style.overflow = 'hidden';
  toPre.style.transition = 'none';

  // Force reflow to apply initial height
  toPre.offsetHeight;

  // Now enable transition and set target height
  toPre.style.transition = 'height 0.5s ease-in-out';
  toPre.style.height = `${toPreNaturalHeight}px`;

  // Hide the target code block temporarily
  toCodeBlock.style.visibility = 'hidden';

  // Create animated clones in the overlay for ALL "to" spans
  const clones = [];

  for (const toData of toSpanData) {
    const hasMatch = !!toData.matchedFrom;
    const fromData = toData.matchedFrom;

    const clone = document.createElement('span');
    clone.textContent = toData.content;

    // Copy computed styles from target span
    const computed = toData.computedStyle;

    // Starting position: from position if matched, to position if new
    const startX = hasMatch ? fromData.x : toData.x;
    const startY = hasMatch ? fromData.y : toData.y;
    const startOpacity = hasMatch ? 1 : 0;

    clone.style.cssText = `
      position: fixed;
      left: ${startX}px;
      top: ${startY}px;
      font-family: ${computed.fontFamily};
      font-size: ${computed.fontSize};
      color: ${computed.color};
      font-weight: ${computed.fontWeight};
      font-style: ${computed.fontStyle};
      white-space: pre;
      pointer-events: none;
      opacity: ${startOpacity};
      transition: left 0.5s ease-in-out, top 0.5s ease-in-out, opacity 0.5s ease-in-out;
    `;

    overlay.appendChild(clone);
    clones.push({ clone, toData, hasMatch });
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

  // Clean up after animation
  setTimeout(() => {
    // Show the target code block
    toCodeBlock.style.visibility = 'visible';

    // Reset height styles on toPre
    toPre.style.height = '';
    toPre.style.overflow = '';
    toPre.style.transition = '';

    // Remove clones
    for (const { clone } of clones) {
      clone.remove();
    }

    onComplete();
  }, 550); // Slightly longer than animation duration
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
