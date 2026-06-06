/**
 * Photo breathing effect — during playback, a tape's photos appear
 * overlapping in random positions around the player, fading in/out.
 */

let breathingActive = false;
let breathingInterval = null;
let activePhotoEls = [];
let photoStage = null;
let photoDataCache = [];
let photoIndex = 0;

function initPhotos() {
  photoStage = document.getElementById('photo-stage');
}

async function startBreathing(tapeId) {
  stopBreathing();

  const photos = await getPhotosForTapeId(tapeId);
  if (photos.length === 0) return;

  breathingActive = true;
  activePhotoEls = [];
  photoDataCache = [];
  photoIndex = 0;

  for (const photo of photos) {
    const url = await getPhotoBlobURL(photo);
    photoDataCache.push({ url, id: photo.id });
  }

  if (!breathingActive || photoDataCache.length === 0) return;
  photoDataCache.sort(() => Math.random() - 0.5);

  // Show first photo immediately, then keep a steady pulse
  showNextPhoto();
  breathingInterval = setInterval(() => {
    activePhotoEls = activePhotoEls.filter(el => el.parentNode);
    if (activePhotoEls.length < 3 && breathingActive) {
      showNextPhoto();
    }
  }, 2200);
}

function showNextPhoto() {
  if (!breathingActive) return;

  activePhotoEls = activePhotoEls.filter(el => el.parentNode);
  if (activePhotoEls.length >= 3) return;

  const photo = photoDataCache[photoIndex % photoDataCache.length];
  photoIndex++;

  const img = document.createElement('img');
  img.className = 'breathing-photo';
  photoStage.appendChild(img);
  activePhotoEls.push(img);

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

  function startPhotoAnimation() {
    // fade in → hold → fade out → remove
    gsap.to(img, {
      opacity: 1,
      scale: 1.02,
      rotation: rot * 0.5,
      duration: 1.8,
      ease: 'power2.inOut',
      onComplete: () => {
        if (!breathingActive) { removePhotoEl(img); return; }
        gsap.to(img, {
          opacity: 1, scale: 1.04,
          duration: 3.5,
          ease: 'none',
          onComplete: () => {
            if (!breathingActive) { removePhotoEl(img); return; }
            gsap.to(img, {
              opacity: 0, scale: 1.08,
              duration: 2.2, ease: 'power2.in', delay: 0.3,
              onComplete: () => {
                removePhotoEl(img);
                activePhotoEls = activePhotoEls.filter(el => el !== img);
              }
            });
          }
        });
      }
    });
  }

  // Wait for image to load before animating
  if (img.complete && img.naturalWidth > 0) {
    startPhotoAnimation();
  } else {
    img.onload = startPhotoAnimation;
    img.onerror = () => {
      // Image failed to load, remove silently
      activePhotoEls = activePhotoEls.filter(el => el !== img);
      if (img.parentNode) img.remove();
    };
  }

  img.src = photo.url;
  img.dataset.blobUrl = photo.url;
}

function removePhotoEl(el) {
  gsap.killTweensOf(el);
  if (el.dataset.blobUrl) URL.revokeObjectURL(el.dataset.blobUrl);
  if (el.parentNode) el.remove();
}

function stopBreathing() {
  breathingActive = false;
  if (breathingInterval) { clearInterval(breathingInterval); breathingInterval = null; }
  activePhotoEls.forEach(el => removePhotoEl(el));
  activePhotoEls = [];
  photoDataCache.forEach(p => URL.revokeObjectURL(p.url));
  photoDataCache = [];
  if (photoStage) {
    photoStage.querySelectorAll('.breathing-photo').forEach(el => removePhotoEl(el));
  }
}

function pauseBreathing() {
  if (!breathingActive) return;
  if (breathingInterval) { clearInterval(breathingInterval); breathingInterval = null; }
  activePhotoEls.forEach(el => gsap.killTweensOf(el));
}

function resumeBreathing() {
  if (!breathingActive) return;
  const tapeId = getActiveTapeId();
  if (!tapeId) return;
  activePhotoEls.forEach(el => removePhotoEl(el));
  activePhotoEls = [];
  photoIndex = 0;
  breathingInterval = setInterval(() => {
    activePhotoEls = activePhotoEls.filter(el => el.parentNode);
    if (activePhotoEls.length < 3 && breathingActive) {
      showNextPhoto();
    }
  }, 2200);
  showNextPhoto();
}
