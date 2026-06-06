/**
 * IndexedDB storage layer for tapes, music, and photos.
 * Uses a simple promise-based wrapper around IndexedDB.
 */

const DB_NAME = 'tape-memories';
const DB_VERSION = 2;

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) { resolve(db); return; }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains('tapes')) {
        const tapesStore = database.createObjectStore('tapes', { keyPath: 'id' });
        tapesStore.createIndex('createdAt', 'createdAt');
      }
      if (!database.objectStoreNames.contains('photos')) {
        const photoStore = database.createObjectStore('photos', { keyPath: 'id' });
        photoStore.createIndex('tapeId', 'tapeId');
      } else if (!database.objectStore('photos').indexNames.contains('tapeId')) {
        database.objectStore('photos').createIndex('tapeId', 'tapeId');
      }
    };

    req.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };

    req.onerror = () => reject(new Error('Failed to open IndexedDB'));
  });
}

// ---- Tapes CRUD ----

async function getAllTapes() {
  const database = await openDB();
  return new Promise((resolve) => {
    const tx = database.transaction('tapes', 'readonly');
    const store = tx.objectStore('tapes');
    const req = store.getAll();
    req.onsuccess = () => {
      const tapes = req.result || [];
      tapes.sort((a, b) => b.createdAt - a.createdAt);
      resolve(tapes);
    };
  });
}

async function getTape(id) {
  const database = await openDB();
  return new Promise((resolve) => {
    const tx = database.transaction('tapes', 'readonly');
    const req = tx.objectStore('tapes').get(id);
    req.onsuccess = () => resolve(req.result || null);
  });
}

async function saveTape(tape) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('tapes', 'readwrite');
    const req = tx.objectStore('tapes').put(tape);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(new Error('Failed to save tape'));
  });
}

async function deleteTape(id) {
  const database = await openDB();
  return new Promise((resolve) => {
    const tx = database.transaction(['tapes', 'photos'], 'readwrite');
    const tapeStore = tx.objectStore('tapes');
    tapeStore.delete(id);

    // Delete all photos for this tape
    const photoStore = tx.objectStore('photos');
    const req = photoStore.getAll();
    req.onsuccess = () => {
      (req.result || []).forEach(p => {
        if (p.tapeId === id) photoStore.delete(p.id);
      });
    };

    tx.oncomplete = () => resolve();
  });
}

// ---- Photos CRUD ----

async function savePhoto(photo) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('photos', 'readwrite');
    const req = tx.objectStore('photos').put(photo);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(new Error('Failed to save photo'));
  });
}

async function getPhotosForTape(tapeId) {
  const database = await openDB();
  return new Promise((resolve) => {
    const tx = database.transaction('photos', 'readonly');
    const req = tx.objectStore('photos').getAll();
    req.onsuccess = () => {
      const photos = (req.result || []).filter(p => p.tapeId === tapeId);
      resolve(photos);
    };
  });
}

async function deletePhotosForTape(tapeId) {
  const database = await openDB();
  return new Promise((resolve) => {
    const tx = database.transaction('photos', 'readwrite');
    const store = tx.objectStore('photos');
    const req = store.getAll();
    req.onsuccess = () => {
      const photos = (req.result || []).filter(p => p.tapeId === tapeId);
      photos.forEach(p => store.delete(p.id));
    };
    tx.oncomplete = () => resolve();
  });
}

// ---- Export / Import ----

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(dataUrl) {
  const [header, b64] = dataUrl.split(',');
  const mime = (header.match(/:(.*?);/) || ['', 'application/octet-stream'])[1];
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function exportAllData() {
  const database = await openDB();
  const tapes = await getAllTapes();
  const allPhotos = [];

  for (const tape of tapes) {
    const photos = await getPhotosForTape(tape.id);
    allPhotos.push(...photos);
  }

  // Convert all blobs to base64 for JSON serialization
  const exportTapes = await Promise.all(tapes.map(async (tape) => {
    const musicB64 = await blobToBase64(new Blob([tape.musicBlob], { type: tape.musicType }));
    return {
      id: tape.id,
      name: tape.name,
      color: tape.color,
      musicB64,
      musicFileName: tape.musicFileName,
      musicType: tape.musicType,
      photoIds: tape.photoIds,
      createdAt: tape.createdAt
    };
  }));

  const exportPhotos = await Promise.all(allPhotos.map(async (photo) => {
    const blob = new Blob([photo.blob], { type: photo.mimeType || 'image/jpeg' });
    const photoB64 = await blobToBase64(blob);
    return {
      id: photo.id,
      tapeId: photo.tapeId,
      photoB64,
      fileName: photo.fileName,
      mimeType: photo.mimeType
    };
  }));

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tapes: exportTapes,
    photos: exportPhotos
  };
}

async function importAllData(data) {
  const database = await openDB();

  // Clear existing data
  const txClear = database.transaction(['tapes', 'photos'], 'readwrite');
  await new Promise((resolve) => {
    txClear.objectStore('tapes').clear();
    txClear.objectStore('photos').clear();
    txClear.oncomplete = () => resolve();
  });

  // Convert base64 back to blobs and save
  for (const t of data.tapes) {
    const musicBlob = t.musicB64 ? base64ToBlob(t.musicB64) : new Blob();
    const tape = {
      id: t.id,
      name: t.name,
      color: t.color,
      musicBlob,
      musicFileName: t.musicFileName || 'unknown',
      musicType: t.musicType || musicBlob.type || 'audio/mpeg',
      photoIds: t.photoIds || [],
      createdAt: t.createdAt || Date.now()
    };
    await saveTape(tape);
  }

  for (const p of data.photos) {
    const blob = p.photoB64 ? base64ToBlob(p.photoB64) : new Blob();
    const photo = {
      id: p.id,
      tapeId: p.tapeId,
      blob,
      fileName: p.fileName || 'photo',
      mimeType: p.mimeType || blob.type || 'image/jpeg'
    };
    await savePhoto(photo);
  }
}

// ---- Storage info ----

async function getStorageInfo() {
  if ('storage' in navigator && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      percent: estimate.quota ? Math.round((estimate.usage / estimate.quota) * 100) : 0
    };
  }
  return { usage: 0, quota: 0, percent: 0 };
}

async function requestPersistence() {
  if ('storage' in navigator && navigator.storage.persist) {
    const granted = await navigator.storage.persist();
    return granted;
  }
  return false;
}
