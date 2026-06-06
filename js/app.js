/**
 * App entry point — initializes all modules, handles loading screen,
 * entry animations, and wires up cross-module callbacks.
 */

(function () {
  'use strict';

  // ---- Lifecycle ----

  async function boot() {
    // Initialize all modules
    initPlayer();
    initDragDrop();
    initGallery();
    initPhotos();
    initAddTapeModal();
    initEditTapeModal();
    initDeleteModal();
    initFullGallery();
    initExportImport();

    // Wire up drag-drop callbacks
    onTapeLoaded = function (tape) {
      updatePlayingState(tape.id);
      startBreathing(tape.id);
    };

    onTapeUnloaded = function (tape) {
      if (tape) updatePlayingState(tape.id);
      stopBreathing();
    };

    // Wire up player click to toggle play/pause
    document.getElementById('tape-player').addEventListener('click', (e) => {
      // Don't toggle if clicking on action buttons
      if (e.target.closest('.tape-actions')) return;
      const tapeId = getCurrentTapeId();
      if (tapeId) {
        togglePlayPause();
        updatePlayingState(tapeId);
        if (isAudioPlaying()) {
          resumeBreathing();
        } else {
          pauseBreathing();
        }
      }
    });

    // Open add tape modal from header button
    document.getElementById('btn-add-tape').addEventListener('click', openAddTapeModal);

    // Load stored tapes
    await loadAllTapes();
    refreshGallery();

    // Request persistent storage
    requestPersistence().then((granted) => {
      if (granted) console.log('Persistent storage granted');
    });

    // Show the app
    await showEntryAnimation();
  }

  // ---- Entry Animation ----

  async function showEntryAnimation() {
    const loadingScreen = document.getElementById('loading-screen');
    const topBar = document.getElementById('top-bar');
    const playerZone = document.getElementById('player-zone');
    const gallery = document.getElementById('bottom-gallery');

    // Build entrance timeline
    const tl = gsap.timeline({
      onComplete: () => {
        loadingScreen.style.display = 'none';
      }
    });

    // Fade out loading
    tl.to('#loading-screen', { opacity: 0, duration: 0.4, delay: 0.3 });

    // Top bar slides in
    tl.to(topBar, { y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.2');

    // Player bounces in
    tl.fromTo(playerZone,
      { opacity: 0, scale: 0.7, y: 20 },
      { opacity: 1, scale: 1, y: 0, duration: 0.7, ease: 'back.out(1.4)' },
      '-=0.2'
    );

    // Gallery slides up
    tl.fromTo(gallery,
      { y: 60, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' },
      '-=0.3'
    );

    // Stagger in the tape cards
    const tapeCards = document.querySelectorAll('.gallery-track .tape-item');
    if (tapeCards.length > 0) {
      tl.fromTo(tapeCards,
        { y: 40, opacity: 0, scale: 0.85 },
        {
          y: 0, opacity: 1, scale: 1,
          duration: 0.5,
          stagger: 0.08,
          ease: 'back.out(1.3)'
        },
        '-=0.3'
      );
    }

    await tl;
  }

  // ---- Start ----

  // Wait for GSAP to be available, then boot
  function waitForGSAP(cb) {
    if (window.gsap) {
      cb();
    } else {
      setTimeout(() => waitForGSAP(cb), 50);
    }
  }

  waitForGSAP(boot);

})();
