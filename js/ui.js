/**
 * UI module — modal dialogs, toasts, and global UI interactions.
 */

/* ---- Modal Management ---- */

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.classList.remove('open');
  });
  document.body.style.overflow = '';
}

// Delegate close buttons
document.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('[data-close]');
  if (closeBtn) {
    const modalId = closeBtn.dataset.close;
    closeModal(modalId);
  }

  // Close on overlay click
  if (e.target.classList.contains('modal-overlay')) {
    closeModal(e.target.id);
  }
});

// Escape key to close modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const openModal = document.querySelector('.modal-overlay.open');
    if (openModal) closeModal(openModal.id);
  }
});

/* ---- Toast Notifications ---- */

function showToast(message, type) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast toast-' + (type || 'success');
  toast.textContent = message;
  container.appendChild(toast);

  // Auto remove after animation
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 3000);
}

/* ---- Add Tape Modal ---- */

let musicFileData = null;
let photoFilesData = null;

function openAddTapeModal() {
  document.getElementById('input-tape-name').value = '';
  document.getElementById('input-tape-color').value = '#ff6b6b';
  document.getElementById('color-hex').textContent = '#ff6b6b';
  document.getElementById('music-preview').style.display = 'none';
  document.getElementById('upload-music-box').querySelector('.upload-placeholder').style.display = 'flex';
  document.getElementById('photos-preview').style.display = 'none';
  document.getElementById('upload-photos-box').querySelector('.upload-placeholder').style.display = 'flex';
  musicFileData = null;
  photoFilesData = null;
  openModal('modal-add-tape');
}

function initAddTapeModal() {
  const colorInput = document.getElementById('input-tape-color');
  const colorHex = document.getElementById('color-hex');
  colorInput.addEventListener('input', () => {
    colorHex.textContent = colorInput.value;
  });

  // Music file upload
  const musicBox = document.getElementById('upload-music-box');
  const musicInput = document.getElementById('input-music-file');
  musicBox.addEventListener('click', () => musicInput.click());
  musicInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    musicFileData = file;
    const placeholder = musicBox.querySelector('.upload-placeholder');
    const preview = document.getElementById('music-preview');
    placeholder.style.display = 'none';
    preview.style.display = 'flex';
    document.getElementById('music-preview-name').textContent = file.name;
  });
  document.getElementById('music-preview-remove').addEventListener('click', (e) => {
    e.stopPropagation();
    musicFileData = null;
    musicInput.value = '';
    musicBox.querySelector('.upload-placeholder').style.display = 'flex';
    document.getElementById('music-preview').style.display = 'none';
  });

  // Photo files upload
  const photosBox = document.getElementById('upload-photos-box');
  const photosInput = document.getElementById('input-photo-files');
  photosBox.addEventListener('click', () => photosInput.click());
  photosInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    photoFilesData = files;
    const placeholder = photosBox.querySelector('.upload-placeholder');
    const preview = document.getElementById('photos-preview');
    placeholder.style.display = 'none';
    preview.style.display = 'flex';
    document.getElementById('photos-preview-count').textContent =
      files.length + ' 张照片已选择';
  });
  document.getElementById('photos-preview-remove').addEventListener('click', (e) => {
    e.stopPropagation();
    photoFilesData = null;
    photosInput.value = '';
    photosBox.querySelector('.upload-placeholder').style.display = 'flex';
    document.getElementById('photos-preview').style.display = 'none';
  });

  // Confirm button
  document.getElementById('btn-confirm-add-tape').addEventListener('click', async () => {
    if (!musicFileData) {
      showToast('请先上传音乐文件', 'error');
      return;
    }

    const name = document.getElementById('input-tape-name').value.trim() || '未命名磁带';
    const color = document.getElementById('input-tape-color').value;

    try {
      const tape = await createTape(name, color, musicFileData, photoFilesData);
      closeModal('modal-add-tape');
      refreshGallery();
      showToast('磁带「' + tape.name + '」已创建');
    } catch (err) {
      console.error('Failed to create tape:', err);
      showToast('创建磁带失败，请重试', 'error');
    }
  });
}

/* ---- Edit Tape Modal ---- */

let editingTapeId = null;

function openEditTapeModal(tapeId) {
  const tape = getTapeById(tapeId);
  if (!tape) return;

  editingTapeId = tapeId;
  document.getElementById('input-edit-name').value = tape.name;
  document.getElementById('input-edit-color').value = tape.color;
  document.getElementById('color-hex-edit').textContent = tape.color;
  document.getElementById('input-edit-photos').value = '';
  openModal('modal-edit-tape');
}

function initEditTapeModal() {
  const colorInput = document.getElementById('input-edit-color');
  colorInput.addEventListener('input', () => {
    document.getElementById('color-hex-edit').textContent = colorInput.value;
  });

  // Photo upload for edit
  const photosBox = document.getElementById('upload-edit-photos-box');
  const photosInput = document.getElementById('input-edit-photos');
  photosBox.addEventListener('click', () => photosInput.click());
  photosInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    await addPhotosToTape(editingTapeId, files);
    showToast(files.length + ' 张照片已追加');
    photosInput.value = '';
    // If this tape is currently playing, restart breathing
    if (getActiveTapeId() === editingTapeId && isAudioPlaying()) {
      stopBreathing();
      startBreathing(editingTapeId);
    }
  });

  // Save
  document.getElementById('btn-confirm-edit-tape').addEventListener('click', async () => {
    const name = document.getElementById('input-edit-name').value.trim();
    const color = document.getElementById('input-edit-color').value;
    await updateTape(editingTapeId, { name, color });

    // Update player slot if this tape is loaded
    if (getActiveTapeId() === editingTapeId) {
      const slotEl = document.getElementById('player-tape-slot');
      slotEl.querySelector('.slot-name').textContent = name;
      slotEl.style.setProperty('--slot-color', color);
    }

    closeModal('modal-edit-tape');
    refreshGallery();
    showToast('磁带信息已更新');
  });

  // Delete
  document.getElementById('btn-delete-tape').addEventListener('click', () => {
    closeModal('modal-edit-tape');
    const tape = getTapeById(editingTapeId);
    document.getElementById('delete-tape-name').textContent = tape ? tape.name : '';
    openModal('modal-confirm-delete');
  });
}

/* ---- Delete Confirmation ---- */

function initDeleteModal() {
  document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
    const tapeId = editingTapeId;
    // Stop player if this tape is loaded
    if (getActiveTapeId() === tapeId) {
      stop();
      stopBreathing();
    }
    await removeTape(tapeId);
    closeModal('modal-confirm-delete');
    refreshGallery();
    showToast('磁带已删除');
  });
}

/* ---- Full Screen Gallery ---- */

function openFullGallery() {
  const tapes = tapesCache || [];
  renderFullGallery(tapes, '');
  openModal('modal-gallery-full');

  // Focus search
  setTimeout(() => {
    const searchInput = document.getElementById('gallery-search-input');
    if (searchInput) searchInput.focus();
  }, 100);
}

function initFullGallery() {
  const searchInput = document.getElementById('gallery-search-input');
  searchInput.addEventListener('input', () => {
    const query = searchInput.value;
    renderFullGallery(tapesCache, query);
  });

  document.getElementById('btn-expand-gallery').addEventListener('click', openFullGallery);
}

/* ---- Export / Import ---- */

async function handleExport() {
  try {
    const data = await exportAllData();
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'tape-memories-backup-' + new Date().toISOString().slice(0, 10) + '.tapebackup';
    a.click();

    URL.revokeObjectURL(url);
    showToast('备份已导出');
  } catch (err) {
    console.error('Export failed:', err);
    showToast('导出失败', 'error');
  }
}

async function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.tapebackup,.json';

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.tapes || !Array.isArray(data.tapes)) {
        showToast('无效的备份文件', 'error');
        return;
      }

      // Confirm overwrite
      if (tapesCache.length > 0) {
        if (!confirm('导入将覆盖现有的 ' + tapesCache.length + ' 盘磁带，确定继续？')) return;
      }

      // Stop any playing music
      stop();
      stopBreathing();

      await importAllData(data);
      await loadAllTapes();
      refreshGallery();
      showToast('备份已导入（' + data.tapes.length + ' 盘磁带）');
    } catch (err) {
      console.error('Import failed:', err);
      showToast('导入失败，文件格式不正确', 'error');
    }
  };

  input.click();
}

function initExportImport() {
  document.getElementById('btn-export').addEventListener('click', handleExport);
  document.getElementById('btn-import').addEventListener('click', handleImport);
}

/* ---- Gallery Refresh Helper ---- */

function refreshGallery() {
  renderGallery(tapesCache);
  // Also refresh full gallery if open
  const fullGrid = document.getElementById('gallery-full-grid');
  if (fullGrid && document.getElementById('modal-gallery-full').classList.contains('open')) {
    const query = document.getElementById('gallery-search-input')?.value || '';
    renderFullGallery(tapesCache, query);
  }
}
