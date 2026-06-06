/**
 * Tape data management — orchestration layer between UI and IndexedDB.
 * Handles photo compression, tape CRUD, and state.
 */

// In-memory cache of all tapes
let tapesCache = [];
let activeTapeId = null; // currently loaded in player

/* ---- Photo compression ---- */
function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    // Skip compression for small files (< 500KB)
    if (file.size < 500 * 1024) {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const maxW = 1920;
      let w = img.width;
      let h = img.height;
      if (w > maxW) { h = h * (maxW / w); w = maxW; }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => resolve(blob || file),
        'image/jpeg',
        0.78
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback to original
    };

    img.src = url;
  });
}

function createThumbnail(blob) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const maxW = 200;
      let w = img.width;
      let h = img.height;
      if (w > maxW) { h = h * (maxW / w); w = maxW; }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((thumb) => resolve(thumb || blob), 'image/jpeg', 0.6);
    };

    img.onerror = () => resolve(blob);
    img.src = url;
  });
}

/* ---- Tape operations ---- */

async function loadAllTapes() {
  tapesCache = await getAllTapes();
  return tapesCache;
}

async function createTape(name, color, musicFile, photoFiles) {
  const id = 'tape_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const musicBlob = new Blob([musicFile], { type: musicFile.type });

  const tape = {
    id,
    name: name || '未命名磁带',
    color,
    musicBlob,
    musicFileName: musicFile.name,
    musicType: musicFile.type,
    photoIds: [],
    createdAt: Date.now()
  };

  // Compress and store photos
  if (photoFiles && photoFiles.length > 0) {
    for (const file of photoFiles) {
      const compressed = await compressPhoto(file);
      const photoId = 'photo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const photo = {
        id: photoId,
        tapeId: id,
        blob: compressed,
        fileName: file.name,
        mimeType: compressed.type || 'image/jpeg'
      };
      await savePhoto(photo);
      tape.photoIds.push(photoId);
    }
  }

  await saveTape(tape);
  tapesCache.unshift(tape);
  return tape;
}

async function updateTape(id, updates) {
  const tape = tapesCache.find(t => t.id === id);
  if (!tape) return null;

  Object.assign(tape, updates);
  await saveTape(tape);
  return tape;
}

async function addPhotosToTape(tapeId, files) {
  const tape = tapesCache.find(t => t.id === tapeId);
  if (!tape) return;

  for (const file of files) {
    const compressed = await compressPhoto(file);
    const photoId = 'photo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const photo = {
      id: photoId,
      tapeId,
      blob: compressed,
      fileName: file.name,
      mimeType: compressed.type || 'image/jpeg'
    };
    await savePhoto(photo);
    tape.photoIds.push(photoId);
  }

  await saveTape(tape);
}

async function removeTape(id) {
  await deletePhotosForTape(id);
  await deleteTape(id);
  tapesCache = tapesCache.filter(t => t.id !== id);
  if (activeTapeId === id) activeTapeId = null;
}

async function getPhotosForTapeId(tapeId) {
  return await getPhotosForTape(tapeId);
}

function setActiveTape(id) { activeTapeId = id; }
function getActiveTapeId() { return activeTapeId; }
function clearActiveTape() { activeTapeId = null; }

function getTapeById(id) {
  return tapesCache.find(t => t.id === id) || null;
}

function searchTapes(query) {
  if (!query) return tapesCache;
  const q = query.toLowerCase();
  return tapesCache.filter(t => t.name.toLowerCase().includes(q));
}

async function getPhotoBlobURL(photo) {
  const blob = new Blob([photo.blob], { type: photo.mimeType || 'image/jpeg' });
  return URL.createObjectURL(blob);
}

function getMusicURL(tape) {
  const blob = new Blob([tape.musicBlob], { type: tape.musicType || 'audio/mpeg' });
  return URL.createObjectURL(blob);
}
