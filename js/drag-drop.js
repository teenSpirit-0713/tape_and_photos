/**
 * Drag & Drop — using native Pointer Events + GSAP for smooth animation.
 * Supports: mouse, touch, pen input.
 * Two directions: gallery → player (load), player → gallery (eject).
 */

let dragState = null;
let playerZoneEl = null;
const MIN_DRAG_DIST = 4; // px to distinguish click from drag

function initDragDrop() {
  playerZoneEl = document.getElementById('player-zone');

  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerUp);
}

function onPointerDown(e) {
  if (dragState) return;

  // Don't start drag on action buttons
  if (e.target.closest('.tape-actions')) return;

  // Try gallery tape first, then player slot
  let tapeEl = e.target.closest('.tape-item');
  let tapeId = null;
  let isFromPlayer = false;
  let isGalleryTape = false;

  if (tapeEl) {
    // Dragging from bottom gallery
    tapeId = tapeEl.dataset.tapeId;
    isGalleryTape = true;
  } else {
    // Check if dragging from the player slot
    const slotShell = e.target.closest('.slot-shell');
    if (slotShell) {
      const slot = document.getElementById('player-tape-slot');
      if (slot && slot.classList.contains('active')) {
        tapeId = getCurrentTapeId();
        tapeEl = slotShell;
        isFromPlayer = true;
      }
    }
  }

  if (!tapeEl || !tapeId) return;
  // Don't preventDefault — it would suppress click events for play/pause toggle

  const rect = tapeEl.getBoundingClientRect();

  // Create ghost
  const ghost = document.createElement('div');
  ghost.className = 'tape-item dragging';

  if (isFromPlayer) {
    // For player drag, create a gallery-sized ghost
    ghost.style.width = '160px';
    ghost.style.height = '110px';
    ghost.style.position = 'fixed';
    ghost.style.left = (e.clientX - 80) + 'px';
    ghost.style.top = (e.clientY - 55) + 'px';
    ghost.style.margin = '0';
    ghost.style.flex = 'none';
    ghost.style.zIndex = '200';
    ghost.style.pointerEvents = 'none';
    ghost.style.transition = 'box-shadow 0.15s ease';

    const tape = getTapeById(tapeId);
    if (tape) {
      ghost.style.setProperty('--tape-color', tape.color);
      ghost.innerHTML = `
        <div class="tape-screw tl"></div><div class="tape-screw tr"></div>
        <div class="tape-screw bl"></div><div class="tape-screw br"></div>
        <div class="tape-label-top"></div><div class="tape-label-bottom"></div>
        <div class="tape-window">
          <div class="tape-reel left"></div><div class="tape-path"></div><div class="tape-reel right"></div>
        </div>
        <div class="tape-name-label">${escapeHtml(tape.name)}</div>
      `;
    }

    document.body.appendChild(ghost);
    tapeEl.style.opacity = '0.4';

    dragState = {
      tapeId, tapeEl, ghost,
      startX: e.clientX, startY: e.clientY,
      offsetX: 80, offsetY: 55,
      originRect: rect,
      isFromPlayer: true,
      isGalleryTape: false,
      hasMoved: false
    };
  } else {
    // Gallery tape drag
    const clone = tapeEl.cloneNode(true);
    clone.classList.add('dragging');
    clone.style.position = 'fixed';
    clone.style.left = rect.left + 'px';
    clone.style.top = rect.top + 'px';
    clone.style.width = rect.width + 'px';
    clone.style.height = rect.height + 'px';
    clone.style.margin = '0';
    clone.style.flex = 'none';
    clone.style.zIndex = '200';
    clone.style.pointerEvents = 'none';
    clone.style.transition = 'box-shadow 0.15s ease';
    document.body.appendChild(clone);
    tapeEl.style.opacity = '0.3';

    dragState = {
      tapeId, tapeEl, ghost: clone,
      startX: e.clientX, startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      originRect: rect,
      isFromPlayer: false,
      isGalleryTape: true,
      hasMoved: false
    };
  }
}

function onPointerMove(e) {
  if (!dragState) return;

  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;

  if (!dragState.hasMoved && Math.abs(dx) < MIN_DRAG_DIST && Math.abs(dy) < MIN_DRAG_DIST) {
    return;
  }
  dragState.hasMoved = true;

  const x = e.clientX - dragState.offsetX;
  const y = e.clientY - dragState.offsetY;
  // Use left/top directly — gsap.set x/y uses translate which stacks on top of left/top
  dragState.ghost.style.left = x + 'px';
  dragState.ghost.style.top = y + 'px';

  // Highlight drop zone
  const playerRect = getPlayerRect();
  const ghostRect = dragState.ghost.getBoundingClientRect();
  const ghostCX = ghostRect.left + ghostRect.width / 2;
  const ghostCY = ghostRect.top + ghostRect.height / 2;

  const isOver = ghostCX > playerRect.left && ghostCX < playerRect.right &&
                 ghostCY > playerRect.top  && ghostCY < playerRect.bottom;

  playerZoneEl.classList.toggle('drag-hover', isOver);
}

function onPointerUp(e) {
  if (!dragState) return;

  playerZoneEl.classList.remove('drag-hover');

  const { ghost, tapeId, tapeEl, isFromPlayer, isGalleryTape, hasMoved } = dragState;

  // If didn't move enough, treat as click
  if (!hasMoved) {
    ghost.remove();
    tapeEl.style.opacity = '1';
    dragState = null;

    if (isFromPlayer) {
      // Click on player tape = toggle play/pause
      // Handled by player click handler in app.js
    } else if (isGalleryTape) {
      // Click on gallery tape = load via animation
      loadTapeToPlayer(tapeId);
    }
    return;
  }

  const ghostRect = ghost.getBoundingClientRect();
  const ghostCX = ghostRect.left + ghostRect.width / 2;
  const ghostCY = ghostRect.top + ghostRect.height / 2;
  const playerRect = getPlayerRect();

  const isOverPlayer =
    ghostCX > playerRect.left && ghostCX < playerRect.right &&
    ghostCY > playerRect.top  && ghostCY < playerRect.bottom;

  const tape = getTapeById(tapeId);

  if (isOverPlayer && !isFromPlayer) {
    // Gallery tape dropped on player → load
    animateTapeToPlayer(ghost, playerRect, () => {
      ghost.remove();
      tapeEl.style.opacity = '1';
      if (tape) {
        loadTape(tape);
        play();
        if (typeof onTapeLoaded === 'function') onTapeLoaded(tape);
      }
      dragState = null;
    });
  } else if (isFromPlayer && !isOverPlayer) {
    // Player tape dragged out → eject back to gallery
    stop();
    stopBreathing();
    const targetGalleryTape = document.querySelector(`.tape-item[data-tape-id="${tapeId}"]`);
    const targetRect = targetGalleryTape
      ? targetGalleryTape.getBoundingClientRect()
      : { left: ghostRect.left, top: window.innerHeight - 120, width: 160, height: 110 };

    animateTapeToGallery(ghost, targetRect, () => {
      ghost.remove();
      tapeEl.style.opacity = '1';
      if (targetGalleryTape) targetGalleryTape.style.opacity = '1';
      if (typeof onTapeUnloaded === 'function') onTapeUnloaded(tape);
      dragState = null;
    });
  } else if (isFromPlayer && isOverPlayer) {
    // Dragged from player back onto player → cancel, stay
    ghost.style.transform = '';
    gsap.to(ghost, {
      left: ghostRect.left + 'px',
      top: (ghostRect.top - 20) + 'px',
      opacity: 0, duration: 0.3, ease: 'power2.in',
      onComplete: () => {
        ghost.remove();
        tapeEl.style.opacity = '1';
        dragState = null;
      }
    });
  } else {
    // Gallery tape dropped outside → spring back
    const targetRect = tapeEl.getBoundingClientRect();
    ghost.style.transform = '';
    gsap.to(ghost, {
      left: targetRect.left + 'px',
      top: targetRect.top + 'px',
      duration: 0.4,
      ease: 'elastic.out(1, 0.5)',
      onComplete: () => {
        ghost.remove();
        tapeEl.style.opacity = '1';
        dragState = null;
      }
    });
  }
}

function animateTapeToPlayer(ghost, playerRect, onComplete) {
  const ghostRect = ghost.getBoundingClientRect();
  const ghostW = ghostRect.width;
  const ghostH = ghostRect.height;
  const targetX = playerRect.left + playerRect.width / 2 - ghostW / 2;
  const targetY = playerRect.top + playerRect.height / 2 - ghostH / 2;
  const scaleX = Math.min(380 / ghostW, 2.2);
  const scaleY = Math.min(280 / ghostH, 2.2);
  const scale = Math.min(scaleX, scaleY);

  // Clear any transform from previous drag, animate left/top directly
  ghost.style.transform = '';
  gsap.to(ghost, {
    left: targetX + 'px',
    top: targetY + 'px',
    scaleX: scale, scaleY: scale,
    opacity: 0,
    duration: 0.5,
    ease: 'power2.inOut',
    onComplete
  });
}

function animateTapeToGallery(ghost, targetRect, onComplete) {
  ghost.style.transform = '';
  gsap.to(ghost, {
    left: targetRect.left + 'px',
    top: targetRect.top + 'px',
    scaleX: 1, scaleY: 1,
    opacity: 0.7,
    duration: 0.5,
    ease: 'power2.in',
    onComplete
  });
}

// Public: load a tape into player programmatically (click/dblclick, not drag)
let loadingTapeId = null; // prevent concurrent load animations

function loadTapeToPlayer(tapeId) {
  if (loadingTapeId === tapeId) return; // already animating this tape
  const tape = getTapeById(tapeId);
  if (!tape) return;

  loadingTapeId = tapeId;

  const playerRect = getPlayerRect();
  const galleryTape = document.querySelector(`.tape-item[data-tape-id="${tapeId}"]`);

  if (galleryTape) {
    const rect = galleryTape.getBoundingClientRect();
    const ghost = galleryTape.cloneNode(true);
    ghost.classList.add('dragging');
    ghost.style.position = 'fixed';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    ghost.style.margin = '0';
    ghost.style.flex = 'none';
    ghost.style.zIndex = '200';
    ghost.style.pointerEvents = 'none';
    document.body.appendChild(ghost);
    galleryTape.style.opacity = '0.3';

    animateTapeToPlayer(ghost, playerRect, () => {
      ghost.remove();
      galleryTape.style.opacity = '1';
      loadTape(tape);
      play();
      loadingTapeId = null;
      if (typeof onTapeLoaded === 'function') onTapeLoaded(tape);
    });
  } else {
    loadTape(tape);
    play();
    loadingTapeId = null;
    if (typeof onTapeLoaded === 'function') onTapeLoaded(tape);
  }
}

// Callbacks
let onTapeLoaded = null;
let onTapeUnloaded = null;
