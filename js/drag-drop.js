/**
 * Drag & Drop — GPU-accelerated via CSS transform (translate + scale).
 * Pointer Events for input, GSAP for animation.
 */

let dragState = null;
let playerZoneEl = null;
const MIN_DRAG_DIST = 4;

function initDragDrop() {
  playerZoneEl = document.getElementById('player-zone');
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerUp);
}

function onPointerDown(e) {
  if (dragState) return;
  if (e.target.closest('.tape-actions')) return;

  let tapeEl = e.target.closest('.tape-item');
  let tapeId = null;
  let isFromPlayer = false;
  let isGalleryTape = false;

  if (tapeEl) {
    tapeId = tapeEl.dataset.tapeId;
    isGalleryTape = true;
  } else {
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

  const rect = tapeEl.getBoundingClientRect();
  const ghost = document.createElement('div');

  if (isFromPlayer) {
    ghost.className = 'tape-item dragging';
    ghost.style.position = 'fixed';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    ghost.style.margin = '0';
    ghost.style.flex = 'none';
    ghost.style.zIndex = '200';
    ghost.style.pointerEvents = 'none';
    ghost.style.willChange = 'transform';
    const tape = getTapeById(tapeId);
    if (tape) {
      ghost.style.setProperty('--tape-color', tape.color);
      ghost.innerHTML = `<div class="tape-screw tl"></div><div class="tape-screw tr"></div><div class="tape-screw bl"></div><div class="tape-screw br"></div><div class="tape-label-top"></div><div class="tape-label-bottom"></div><div class="tape-window"><div class="tape-reel left"></div><div class="tape-path"></div><div class="tape-reel right"></div></div><div class="tape-name-label">${escapeHtml(tape.name)}</div>`;
    }
    document.body.appendChild(ghost);
    ghost.style.transform = 'scale(1.08)';
    tapeEl.style.opacity = '0.4';
    dragState = {
      tapeId, tapeEl, ghost,
      startX: e.clientX, startY: e.clientY,
      originLeft: rect.left, originTop: rect.top,
      offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top,
      width: rect.width, height: rect.height,
      playerRect: getPlayerRect(),
      isFromPlayer: true, isGalleryTape: false, hasMoved: false
    };
  } else {
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
    clone.style.willChange = 'transform';
    document.body.appendChild(clone);
    clone.style.transform = 'scale(1.08)';
    tapeEl.style.opacity = '0.3';
    dragState = {
      tapeId, tapeEl, ghost: clone,
      startX: e.clientX, startY: e.clientY,
      originLeft: rect.left, originTop: rect.top,
      offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top,
      width: rect.width, height: rect.height,
      playerRect: getPlayerRect(),
      isFromPlayer: false, isGalleryTape: true, hasMoved: false
    };
  }
}

function onPointerMove(e) {
  if (!dragState) return;

  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;
  if (!dragState.hasMoved && Math.abs(dx) < MIN_DRAG_DIST && Math.abs(dy) < MIN_DRAG_DIST) return;
  dragState.hasMoved = true;

  // GPU-accelerated: direct transform string
  const screenX = e.clientX - dragState.offsetX;
  const screenY = e.clientY - dragState.offsetY;
  const tx = screenX - dragState.originLeft;
  const ty = screenY - dragState.originTop;
  dragState.ghost.style.transform = `translate(${tx}px, ${ty}px) scale(1.08)`;

  // Hit test via math (avoid getBoundingClientRect forced reflow)
  const scale = 1.08;
  const w = dragState.width * scale;
  const h = dragState.height * scale;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  const pr = dragState.playerRect;
  const isOver = cx > pr.left && cx < pr.right && cy > pr.top && cy < pr.bottom;
  playerZoneEl.classList.toggle('drag-hover', isOver);
}

function onPointerUp(e) {
  if (!dragState) return;
  playerZoneEl.classList.remove('drag-hover');

  const { ghost, tapeId, tapeEl, isFromPlayer, isGalleryTape, hasMoved } = dragState;

  if (!hasMoved) {
    ghost.remove();
    tapeEl.style.opacity = '1';
    dragState = null;
    if (isGalleryTape) loadTapeToPlayer(tapeId);
    return;
  }

  // Calculate ghost rect from drag state (avoid getBoundingClientRect reflow)
  const scale = 1.08;
  const gw = dragState.width * scale;
  const gh = dragState.height * scale;
  // Last known screenX/screenY from the pointer position
  const lastX = (e.clientX - dragState.offsetX) || dragState.originLeft;
  const lastY = (e.clientY - dragState.offsetY) || dragState.originTop;
  const ghostRect = {
    left: lastX, top: lastY, width: gw, height: gh
  };
  const ghostCX = ghostRect.left + ghostRect.width / 2;
  const ghostCY = ghostRect.top + ghostRect.height / 2;
  const playerRect = getPlayerRect();
  const isOverPlayer = ghostCX > playerRect.left && ghostCX < playerRect.right &&
                       ghostCY > playerRect.top  && ghostCY < playerRect.bottom;
  const tape = getTapeById(tapeId);

  if (isOverPlayer && !isFromPlayer) {
    // Drop on player: fly ghost in → crossfade to slot
    if (tape) {
      const slot = document.getElementById('player-tape-slot');
      slot.style.transition = 'none';
      slot.style.opacity = '0';
      slot.style.transform = 'scale(0.92)';
    }
    // Use a fresh getBoundingClientRect for the accurate fly animation
    const flyRect = ghost.getBoundingClientRect();
    flyGhostToPlayer(ghost, flyRect, playerRect, () => {
      tapeEl.style.opacity = '1';
      if (tape) {
        loadTape(tape);
        const slot = document.getElementById('player-tape-slot');
        // Slot pop-in
        slot.style.transition = 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease';
        slot.style.opacity = '1';
        slot.style.transform = 'scale(1)';
        // Ghost fades over it
        ghost.style.transition = 'opacity 0.18s';
        ghost.style.opacity = '0';
        ghost.addEventListener('transitionend', () => ghost.remove(), { once: true });
        play();
        if (typeof onTapeLoaded === 'function') onTapeLoaded(tape);
      } else {
        ghost.remove();
      }
      dragState = null;
    });
  } else if (isFromPlayer && !isOverPlayer) {
    stop();
    stopBreathing();
    const targetEl = document.querySelector(`.tape-item[data-tape-id="${tapeId}"]`);
    const flyRect = ghost.getBoundingClientRect();
    const targetRect = targetEl ? targetEl.getBoundingClientRect()
      : { left: ghostRect.left, top: window.innerHeight - 140, width: ghostRect.width, height: ghostRect.height };
    flyGhostToTarget(ghost, flyRect, targetRect, () => {
      ghost.remove();
      tapeEl.style.opacity = '1';
      if (targetEl) targetEl.style.opacity = '1';
      if (typeof onTapeUnloaded === 'function') onTapeUnloaded(tape);
      dragState = null;
    });
  } else if (isFromPlayer && isOverPlayer) {
    // Dropped back on player — just fade the ghost
    ghost.style.transition = 'opacity 0.25s';
    ghost.style.opacity = '0';
    ghost.addEventListener('transitionend', () => {
      ghost.remove();
      tapeEl.style.opacity = '1';
      dragState = null;
    }, { once: true });
  } else {
    // Spring back to gallery — use CSS transition (avoids GSAP state conflict)
    ghost.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    ghost.style.transform = 'scale(1.08)';
    ghost.addEventListener('transitionend', () => {
      ghost.remove();
      tapeEl.style.opacity = '1';
      dragState = null;
    }, { once: true });
  }
}

/* ---- GPU-accelerated fly animations ---- */

function flyGhostToPlayer(ghost, ghostRect, playerRect, onComplete) {
  const gw = ghostRect.width;
  const gh = ghostRect.height;
  const pcx = playerRect.left + playerRect.width / 2;
  const pcy = playerRect.top + playerRect.height / 2;
  const targetLeft = pcx - gw / 2;
  const targetTop = pcy - gh / 2;
  const curLeft = ghostRect.left;
  const curTop = ghostRect.top;
  const deltaX = curLeft - targetLeft;
  const deltaY = curTop - targetTop;
  const scaleW = playerRect.width / gw;
  const scaleH = playerRect.height / gh;
  const scale = Math.min(scaleW, scaleH, 3);

  // Set final position, then use transform to shift back to current visual spot.
  // CSS transition animates translate from deltaX→0 and scale from 1.08→target.
  ghost.style.left = targetLeft + 'px';
  ghost.style.top = targetTop + 'px';
  ghost.style.transformOrigin = '50% 50%';
  ghost.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(1.08)`;
  ghost.style.transition = 'none';

  // Force the above styles to render, then kick off the transition
  ghost.offsetHeight;
  ghost.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
  ghost.style.transform = `translate(0px, 0px) scale(${scale})`;

  ghost.addEventListener('transitionend', function handler() {
    ghost.removeEventListener('transitionend', handler);
    ghost.style.transition = 'none';
    ghost.style.transformOrigin = '';
    onComplete();
  });
}

function flyGhostToTarget(ghost, ghostRect, targetRect, onComplete) {
  const curLeft = ghostRect.left;
  const curTop = ghostRect.top;
  const deltaX = curLeft - targetRect.left;
  const deltaY = curTop - targetRect.top;

  ghost.style.left = targetRect.left + 'px';
  ghost.style.top = targetRect.top + 'px';
  ghost.style.transformOrigin = '50% 50%';
  ghost.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(1.08)`;
  ghost.style.transition = 'none';

  ghost.offsetHeight;
  ghost.style.transition = 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)';
  ghost.style.transform = 'translate(0px, 0px) scale(1)';

  ghost.addEventListener('transitionend', function handler() {
    ghost.removeEventListener('transitionend', handler);
    ghost.style.transition = 'none';
    ghost.style.transformOrigin = '';
    onComplete();
  });
}

/* ---- Public: click-to-load ---- */

let loadingTapeId = null;

function loadTapeToPlayer(tapeId) {
  if (loadingTapeId === tapeId) return;
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
    ghost.style.willChange = 'transform';
    document.body.appendChild(ghost);
    galleryTape.style.opacity = '0.3';

    const slot = document.getElementById('player-tape-slot');
    slot.style.transition = 'none';
    slot.style.opacity = '0';
    slot.style.transform = 'scale(0.92)';

    flyGhostToPlayer(ghost, rect, playerRect, () => {
      galleryTape.style.opacity = '1';
      loadTape(tape);
      slot.style.transition = 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease';
      slot.style.opacity = '1';
      slot.style.transform = 'scale(1)';
      ghost.style.transition = 'opacity 0.18s';
      ghost.style.opacity = '0';
      ghost.addEventListener('transitionend', () => ghost.remove(), { once: true });
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

let onTapeLoaded = null;
let onTapeUnloaded = null;
