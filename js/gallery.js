/**
 * Gallery module — renders bottom gallery strip and full-screen grid.
 * Handles CSS Scroll Snap scrolling and tape card interactions.
 */

let galleryTrackEl = null;

function initGallery() {
  galleryTrackEl = document.getElementById('gallery-track');
}

function renderGallery(tapes) {
  if (!galleryTrackEl) return;
  galleryTrackEl.innerHTML = '';

  // Show at most 12 tapes in the strip (scroll overflow handles the rest)
  tapes.forEach((tape) => {
    const el = createTapeCard(tape);
    galleryTrackEl.appendChild(el);
  });

  // Add placeholder "+" at the end
  const addBtn = document.createElement('div');
  addBtn.className = 'tape-add-placeholder';
  addBtn.innerHTML = '<span class="add-icon">+</span>';
  addBtn.addEventListener('click', () => {
    if (typeof openAddTapeModal === 'function') openAddTapeModal();
  });
  galleryTrackEl.appendChild(addBtn);
}

function createTapeCard(tape) {
  const el = document.createElement('div');
  el.className = 'tape-item';
  el.dataset.tapeId = tape.id;
  el.style.setProperty('--tape-color', tape.color);

  // Is this tape currently playing?
  if (getActiveTapeId() === tape.id && isAudioPlaying()) {
    el.classList.add('playing');
  }

  el.innerHTML = `
    <div class="tape-screw tl"></div>
    <div class="tape-screw tr"></div>
    <div class="tape-screw bl"></div>
    <div class="tape-screw br"></div>
    <div class="tape-label-top"></div>
    <div class="tape-label-bottom"></div>
    <div class="tape-window">
      <div class="tape-reel left"></div>
      <div class="tape-path"></div>
      <div class="tape-reel right"></div>
    </div>
    <div class="tape-name-label">${escapeHtml(tape.name)}</div>
    <div class="tape-actions">
      <button class="tape-action-btn play-btn" data-action="play" title="播放">▶</button>
      <button class="tape-action-btn" data-action="edit" title="编辑">✎</button>
    </div>
  `;

  // Double-click to load into player
  el.addEventListener('dblclick', (e) => {
    e.preventDefault();
    loadTapeToPlayer(tape.id);
  });

  // Action buttons
  el.querySelector('[data-action="play"]').addEventListener('click', (e) => {
    e.stopPropagation();
    loadTapeToPlayer(tape.id);
  });

  el.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
    e.stopPropagation();
    if (typeof openEditTapeModal === 'function') openEditTapeModal(tape.id);
  });

  return el;
}

function updatePlayingState(tapeId) {
  // Update all gallery items to reflect playing state
  document.querySelectorAll('.tape-item').forEach(el => {
    el.classList.remove('playing');
    if (el.dataset.tapeId === tapeId && isAudioPlaying()) {
      el.classList.add('playing');
    }
  });
}

function scrollGalleryToTape(tapeId) {
  const el = document.querySelector(`.tape-item[data-tape-id="${tapeId}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

/* ---- Full Screen Gallery ---- */

function renderFullGallery(tapes, query) {
  const grid = document.getElementById('gallery-full-grid');
  const empty = document.getElementById('gallery-empty-state');
  const count = document.getElementById('gallery-count');

  if (!grid) return;

  const filtered = query
    ? tapes.filter(t => t.name.toLowerCase().includes(query.toLowerCase()))
    : tapes;

  count.textContent = filtered.length > 0
    ? filtered.length + ' 盘磁带'
    : '';

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  grid.innerHTML = '';

  filtered.forEach(tape => {
    const el = createTapeCard(tape);
    el.style.flex = 'none';
    // Click in full gallery to load into player
    el.addEventListener('click', () => {
      loadTapeToPlayer(tape.id);
      closeFullGallery();
    });
    grid.appendChild(el);
  });
}

function closeFullGallery() {
  const modal = document.getElementById('modal-gallery-full');
  if (modal) modal.classList.remove('open');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
