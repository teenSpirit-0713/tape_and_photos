/**
 * Photo breathing effect — during playback, a tape's photos appear
 * overlapping in random positions around the player, fading in/out.
 */

let breathingActive = false;
let breathingTimer = null;
let activeCount = 0;
let photoStage = null;
let photoDataCache = [];  // stores photo objects with blobs, NOT urls
let photoIndex = 0;

const MAX_VISIBLE = 3;
const PULSE_INTERVAL = 2200;

function initPhotos() {
  photoStage = document.getElementById('photo-stage');
}

async function startBreathing(tapeId) {
  stopBreathing();

  const photos = await getPhotosForTapeId(tapeId);
  if (photos.length === 0) return;

  breathingActive = true;
  activeCount = 0;
  photoDataCache = photos.slice(); // copy photo objects (with blobs)
  photoIndex = 0;

  photoDataCache.sort(() => Math.random() - 0.5);

  showNextPhoto();
  scheduleNext();
}

function scheduleNext() {
  if (!breathingActive) return;
  breathingTimer = setTimeout(() => {
    if (activeCount < MAX_VISIBLE && breathingActive) {
      showNextPhoto();
    }
    scheduleNext(); // always re-schedule to keep checking
  }, PULSE_INTERVAL);
}

function showNextPhoto() {
  if (!breathingActive) return;
  if (activeCount >= MAX_VISIBLE) return;

  const photo = photoDataCache[photoIndex % photoDataCache.length];
  photoIndex++;

  // Create a fresh blob URL for this appearance
  const blob = new Blob([photo.blob], { type: photo.mimeType || 'image/jpeg' });
  const url = URL.createObjectURL(blob);

  const img = document.createElement('img');
  img.className = 'breathing-photo';
  img._blobUrl = url;
  photoStage.appendChild(img);
  activeCount++;

  const stageW = photoStage.clientWidth;
  const stageH = photoStage.clientHeight;
  const playerEl = document.getElementById('tape-player');
  const playerRect = playerEl.getBoundingClientRect();
  const stageRect = photoStage.getBoundingClientRect();

  const pLeft = playerRect.left - stageRect.left - 40;
  const pTop = playerRect.top - stageRect.top - 40;
  const pRight = playerRect.right - stageRect.left + 40;
  const pBottom = playerRect.bottom - stageRect.top + 40;

  const size = 140 + Math.random() * 160;
  const aspectH = size * 0.72;
  const margin = 20;

  let x, y;
  for (let i = 0; i < 30; i++) {
    x = margin + Math.random() * (stageW - size - margin * 2);
    y = margin + Math.random() * (stageH - aspectH - margin * 2);
    const cx = x + size / 2;
    const cy = y + aspectH / 2;
    if (!(cx > pLeft && cx < pRight && cy > pTop && cy < pBottom)) break;
  }

  const rot = (Math.random() - 0.5) * 18;

  img.style.width = size + 'px';
  img.style.height = aspectH + 'px';
  img.style.left = x + 'px';
  img.style.top = y + 'px';
  img.style.opacity = '0';
  img.style.transform = 'scale(0.88) rotate(' + rot + 'deg)';
  img.style.borderRadius = '8px';
  img.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';

  function cleanup() {
    activeCount--;
    gsap.killTweensOf(img);
    if (url) URL.revokeObjectURL(url);
    if (img.parentNode) img.remove();
  }

  function startAnim() {
    gsap.to(img, {
      opacity: 1,
      scale: 1.02,
      rotation: rot * 0.5,
      duration: 1.8,
      ease: 'power2.inOut',
      onComplete: () => {
        if (!breathingActive) { cleanup(); return; }
        gsap.to(img, {
          opacity: 1, scale: 1.04,
          duration: 3.5,
          ease: 'none',
          onComplete: () => {
            if (!breathingActive) { cleanup(); return; }
            gsap.to(img, {
              opacity: 0, scale: 1.08,
              duration: 2.2, ease: 'power2.in', delay: 0.3,
              onComplete: cleanup
            });
          }
        });
      }
    });
  }

  if (img.complete && img.naturalWidth > 0) {
    startAnim();
  } else {
    img.onload = startAnim;
    img.onerror = () => cleanup();
  }

  img.src = url;
}

function stopBreathing() {
  breathingActive = false;
  if (breathingTimer) { clearTimeout(breathingTimer); breathingTimer = null; }
  // Clean up all photo elements in stage
  if (photoStage) {
    photoStage.querySelectorAll('.breathing-photo').forEach(el => {
      gsap.killTweensOf(el);
      if (el._blobUrl) URL.revokeObjectURL(el._blobUrl);
      if (el.parentNode) el.remove();
    });
  }
  activeCount = 0;
  photoDataCache = [];
}

function pauseBreathing() {
  if (!breathingActive) return;
  if (breathingTimer) { clearTimeout(breathingTimer); breathingTimer = null; }
  if (photoStage) {
    photoStage.querySelectorAll('.breathing-photo').forEach(el => {
      gsap.killTweensOf(el);
    });
  }
}

function resumeBreathing() {
  if (!breathingActive) return;
  const tapeId = getActiveTapeId();
  if (!tapeId) return;
  // Clean existing elements
  if (photoStage) {
    photoStage.querySelectorAll('.breathing-photo').forEach(el => {
      gsap.killTweensOf(el);
      if (el._blobUrl) URL.revokeObjectURL(el._blobUrl);
      if (el.parentNode) el.remove();
    });
  }
  activeCount = 0;
  photoIndex = 0;
  showNextPhoto();
  scheduleNext();
}
