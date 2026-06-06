/**
 * Audio player module — handles HTML5 Audio playback,
 * reel animation sync, progress tracking, and tape-in-player state.
 */

let audio = null;
let currentTapeId = null;
let isPlaying = false;
let reelLeft = null;
let reelRight = null;
let animFrameId = null;

// DOM refs (set after DOM ready)
let playerEl, slotEl, infoEl, progressFillEl, timeEl, nameEl;

function initPlayer() {
  playerEl = document.getElementById('tape-player');
  slotEl = document.getElementById('player-tape-slot');
  infoEl = document.getElementById('playback-info');
  progressFillEl = document.getElementById('info-progress');
  timeEl = document.getElementById('info-time');
  nameEl = document.getElementById('info-name');
  reelLeft = document.getElementById('reel-left');
  reelRight = document.getElementById('reel-right');

  audio = new Audio();
  audio.preload = 'auto';

  audio.addEventListener('timeupdate', onTimeUpdate);
  audio.addEventListener('ended', onEnded);
  audio.addEventListener('play', onPlayEvent);
  audio.addEventListener('pause', onPauseEvent);
}

let currentMusicURL = null;

function loadTape(tape) {
  // Stop current
  stop();

  // Revoke old blob URL
  if (currentMusicURL) {
    URL.revokeObjectURL(currentMusicURL);
    currentMusicURL = null;
  }

  currentTapeId = tape.id;
  setActiveTape(tape.id);

  // Set audio source
  currentMusicURL = getMusicURL(tape);
  audio.src = currentMusicURL;
  audio.load();

  // Update player UI
  showTapeInSlot(tape);
}

function showTapeInSlot(tape) {
  // Remove empty state
  playerEl.classList.remove('tape-player-empty');

  // Show slot
  slotEl.classList.add('active');
  slotEl.querySelector('.slot-name').textContent = tape.name;

  // Set color custom property
  slotEl.style.setProperty('--slot-color', tape.color);

  // Update info bar
  nameEl.textContent = tape.name;
  infoEl.classList.remove('playback-info-hidden');
  infoEl.classList.add('playback-info-visible');
  timeEl.textContent = '00:00 / 00:00';
  progressFillEl.style.width = '0%';
}

function hideTapeInSlot() {
  slotEl.classList.remove('active');
  playerEl.classList.add('tape-player-empty');
  infoEl.classList.remove('playback-info-visible');
  infoEl.classList.add('playback-info-hidden');
  reelLeft.classList.remove('spinning');
  reelRight.classList.remove('spinning');
  currentTapeId = null;
  clearActiveTape();
}

function play() {
  if (!audio.src) return;
  audio.play().catch(() => {});
}

function pause() {
  audio.pause();
}

function stop() {
  pause();
  if (currentMusicURL) {
    URL.revokeObjectURL(currentMusicURL);
    currentMusicURL = null;
  }
  audio.src = '';
  hideTapeInSlot();
  currentTapeId = null;
}

function togglePlayPause() {
  if (isPlaying) {
    pause();
  } else {
    play();
  }
}

function isTapeLoaded(tapeId) {
  return currentTapeId === tapeId;
}

function getCurrentTapeId() {
  return currentTapeId;
}

function isAudioPlaying() {
  return isPlaying;
}

function onTimeUpdate() {
  if (!audio.duration) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  progressFillEl.style.width = pct + '%';

  const cur = formatTime(audio.currentTime);
  const dur = formatTime(audio.duration);
  timeEl.textContent = cur + ' / ' + dur;
}

function onEnded() {
  pause();
  audio.currentTime = 0;
  progressFillEl.style.width = '0%';
  timeEl.textContent = '00:00 / ' + formatTime(audio.duration);
}

function onPlayEvent() {
  isPlaying = true;
  reelLeft.classList.add('spinning');
  reelRight.classList.add('spinning');
}

function onPauseEvent() {
  isPlaying = false;
  reelLeft.classList.remove('spinning');
  reelRight.classList.remove('spinning');
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function getPlayerRect() {
  return playerEl.getBoundingClientRect();
}
