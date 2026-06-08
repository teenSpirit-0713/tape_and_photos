/**
 * Drag & Drop — simple and reliable.
 * Drag: left/top (natural feel). Fly: GSAP (one-shot, ok for animation).
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
  let isGallery = false;

  if (tapeEl) {
    tapeId = tapeEl.dataset.tapeId;
    isGallery = true;
  } else {
    const shell = e.target.closest('.slot-shell');
    if (shell) {
      const slot = document.getElementById('player-tape-slot');
      if (slot && slot.classList.contains('active')) {
        tapeEl = shell;
        tapeId = getCurrentTapeId();
      }
    }
  }

  if (!tapeEl || !tapeId) return;

  const rect = tapeEl.getBoundingClientRect();

  // Build ghost
  const ghost = document.createElement('div');
  ghost.className = 'tape-item dragging';
  ghost.style.position = 'fixed';
  ghost.style.left = rect.left + 'px';
  ghost.style.top = rect.top + 'px';
  ghost.style.width = rect.width + 'px';
  ghost.style.height = rect.height + 'px';
  ghost.style.margin = '0';
  ghost.style.zIndex = '200';
  ghost.style.pointerEvents = 'none';

  const tape = getTapeById(tapeId);
  ghost.style.setProperty('--tape-color', tape ? tape.color : '#ff6b6b');
  ghost.innerHTML =
    '<div class="tape-screw tl"></div><div class="tape-screw tr"></div>' +
    '<div class="tape-screw bl"></div><div class="tape-screw br"></div>' +
    '<div class="tape-label-top"></div><div class="tape-label-bottom"></div>' +
    '<div class="tape-window"><div class="tape-reel left"></div><div class="tape-path"></div><div class="tape-reel right"></div></div>' +
    '<div class="tape-name-label">' + escapeHtml(tape ? tape.name : '') + '</div>';

  document.body.appendChild(ghost);
  tapeEl.style.opacity = '0.3';

  dragState = {
    tapeId, tapeEl, ghost,
    startX: e.clientX, startY: e.clientY,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    width: rect.width, height: rect.height,
    playerRect: getPlayerRect(),
    isGallery, hasMoved: false
  };
}

function onPointerMove(e) {
  if (!dragState) return;

  if (!dragState.hasMoved) {
    var dx = e.clientX - dragState.startX;
    var dy = e.clientY - dragState.startY;
    if (Math.abs(dx) < MIN_DRAG_DIST && Math.abs(dy) < MIN_DRAG_DIST) return;
    dragState.hasMoved = true;
  }

  dragState.ghost.style.left = (e.clientX - dragState.offsetX) + 'px';
  dragState.ghost.style.top = (e.clientY - dragState.offsetY) + 'px';

  // Hit test from stored values (no reflow)
  var cx = (e.clientX - dragState.offsetX) + dragState.width / 2;
  var cy = (e.clientY - dragState.offsetY) + dragState.height / 2;
  var pr = dragState.playerRect;
  playerZoneEl.classList.toggle('drag-hover',
    cx > pr.left && cx < pr.right && cy > pr.top && cy < pr.bottom);
}

function onPointerUp(e) {
  if (!dragState) return;
  playerZoneEl.classList.remove('drag-hover');

  var ghost = dragState.ghost;
  var tapeEl = dragState.tapeEl;
  var tapeId = dragState.tapeId;
  var isGallery = dragState.isGallery;
  var hasMoved = dragState.hasMoved;

  if (!hasMoved) {
    ghost.remove();
    tapeEl.style.opacity = '1';
    dragState = null;
    if (isGallery) loadTapeToPlayer(tapeId);
    return;
  }

  // Where is the ghost right now?
  var ghostLeft = parseFloat(ghost.style.left);
  var ghostTop = parseFloat(ghost.style.top);
  var ghostW = dragState.width;
  var ghostH = dragState.height;
  var ghostCX = ghostLeft + ghostW / 2;
  var ghostCY = ghostTop + ghostH / 2;
  var pr = getPlayerRect();
  var overPlayer = ghostCX > pr.left && ghostCX < pr.right &&
                   ghostCY > pr.top && ghostCY < pr.bottom;

  var tape = getTapeById(tapeId);

  if (overPlayer && isGallery) {
    // Drop on player
    var slot = document.getElementById('player-tape-slot');
    slot.style.transition = 'none';
    slot.style.opacity = '0';
    slot.style.transform = 'scale(0.92)';

    flyGhostIn(ghost, pr, function () {
      tapeEl.style.opacity = '1';
      if (tape) {
        loadTape(tape);
        slot.style.transition = 'opacity 0.25s, transform 0.25s cubic-bezier(0.34,1.56,0.64,1)';
        slot.style.opacity = '1';
        slot.style.transform = 'scale(1)';
        ghost.style.transition = 'opacity 0.15s';
        ghost.style.opacity = '0';
        ghost.addEventListener('transitionend', function () { ghost.remove(); }, { once: true });
        play();
        if (typeof onTapeLoaded === 'function') onTapeLoaded(tape);
      } else {
        ghost.remove();
      }
      dragState = null;
    });
  } else if (!isGallery && !overPlayer) {
    // Eject from player
    stop();
    stopBreathing();
    var targetEl = document.querySelector('.tape-item[data-tape-id="' + tapeId + '"]');
    var targetRect = targetEl ? targetEl.getBoundingClientRect() : { left: ghostLeft, top: window.innerHeight - 140, width: ghostW, height: ghostH };
    flyGhostOut(ghost, targetRect, function () {
      ghost.remove();
      tapeEl.style.opacity = '1';
      if (targetEl) targetEl.style.opacity = '1';
      if (typeof onTapeUnloaded === 'function') onTapeUnloaded(tape);
      dragState = null;
    });
  } else if (!isGallery && overPlayer) {
    // Back onto player — cancel
    ghost.style.transition = 'opacity 0.2s';
    ghost.style.opacity = '0';
    ghost.addEventListener('transitionend', function () { ghost.remove(); tapeEl.style.opacity = '1'; dragState = null; }, { once: true });
  } else {
    // Spring back
    var origRect = tapeEl.getBoundingClientRect();
    gsap.to(ghost, { left: origRect.left, top: origRect.top, duration: 0.35, ease: 'back.out(1.5)',
      onComplete: function () { ghost.remove(); tapeEl.style.opacity = '1'; dragState = null; }
    });
  }
}

/* ---- Fly animations ---- */

function flyGhostIn(ghost, playerRect, done) {
  var r = ghost.getBoundingClientRect();
  var pcx = playerRect.left + playerRect.width / 2;
  var pcy = playerRect.top + playerRect.height / 2;
  var targetLeft = pcx - r.width / 2;
  var targetTop = pcy - r.height / 2;
  var scale = Math.min(playerRect.width / r.width, playerRect.height / r.height, 3);

  gsap.to(ghost, {
    left: targetLeft, top: targetTop,
    scaleX: scale, scaleY: scale,
    duration: 0.5, ease: 'power3.inOut',
    onComplete: done
  });
}

function flyGhostOut(ghost, targetRect, done) {
  gsap.to(ghost, {
    left: targetRect.left, top: targetRect.top,
    scaleX: 1, scaleY: 1,
    duration: 0.45, ease: 'power3.in',
    onComplete: done
  });
}

/* ---- Click-to-load ---- */

var loadingTapeId = null;

function loadTapeToPlayer(tapeId) {
  if (loadingTapeId === tapeId) return;
  var tape = getTapeById(tapeId);
  if (!tape) return;
  loadingTapeId = tapeId;

  var playerRect = getPlayerRect();
  var galleryTape = document.querySelector('.tape-item[data-tape-id="' + tapeId + '"]');

  if (galleryTape) {
    var rect = galleryTape.getBoundingClientRect();
    var ghost = galleryTape.cloneNode(true);
    ghost.classList.add('dragging');
    ghost.style.position = 'fixed';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    ghost.style.margin = '0';
    ghost.style.zIndex = '200';
    ghost.style.pointerEvents = 'none';
    document.body.appendChild(ghost);
    galleryTape.style.opacity = '0.3';

    var slot = document.getElementById('player-tape-slot');
    slot.style.transition = 'none';
    slot.style.opacity = '0';
    slot.style.transform = 'scale(0.92)';

    flyGhostIn(ghost, playerRect, function () {
      galleryTape.style.opacity = '1';
      loadTape(tape);
      slot.style.transition = 'opacity 0.25s, transform 0.25s cubic-bezier(0.34,1.56,0.64,1)';
      slot.style.opacity = '1';
      slot.style.transform = 'scale(1)';
      ghost.style.transition = 'opacity 0.15s';
      ghost.style.opacity = '0';
      ghost.addEventListener('transitionend', function () { ghost.remove(); }, { once: true });
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

var onTapeLoaded = null;
var onTapeUnloaded = null;
