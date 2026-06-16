(() => {
  let timer = null;
  let videoListener = null;
  let currentVideo = null;
  let settings = { enabled: false, mode: 'ended', delay: 2 };
  let lastUrl = location.href;
  let nearEndTriggered = false;

  // ── Platform adapters ──────────────────────────────────────────────────────

  const platforms = {
    youtube: {
      active: () => location.pathname.startsWith('/shorts/'),
      getVideo: () =>
        document.querySelector('ytd-reel-video-renderer[is-active] video') ??
        document.querySelector('.ytd-shorts video') ??
        document.querySelector('video'),
      next() {
        const btn =
          document.querySelector('#navigation-button-down button') ??
          document.querySelector('ytd-shorts .navigation-button:last-of-type button') ??
          document.querySelector('[aria-label="Next video"]') ??
          document.querySelector('[aria-label="Następny film"]');
        if (btn) { btn.click(); return; }
        const target = document.querySelector('#shorts-player') ?? document.body;
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', keyCode: 40, bubbles: true }));
      }
    },
    tiktok: {
      active: () => location.hostname.includes('tiktok.com'),
      getVideo: () => document.querySelector('video'),
      next() {
        const btn =
          document.querySelector('[data-e2e="arrow-right"]') ??
          document.querySelector('button[class*="StyledArrow"][class*="right"]') ??
          document.querySelector('.swiper-button-next');
        if (btn) { btn.click(); return; }
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', keyCode: 40, bubbles: true }));
      }
    },
    instagram: {
      active: () => /\/(reels?|reel)\//.test(location.pathname),
      getVideo: () => document.querySelector('video'),
      next() {
        const btn = [...document.querySelectorAll('button[aria-label]')]
          .find(el => /next|następn/i.test(el.getAttribute('aria-label') ?? ''));
        if (btn) { btn.click(); return; }
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39, bubbles: true }));
      }
    }
  };

  function getPlatform() {
    return Object.values(platforms).find(p => p.active()) ?? null;
  }

  // ── Core logic ─────────────────────────────────────────────────────────────

  function clearAll() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (currentVideo && videoListener) {
      currentVideo.removeEventListener('timeupdate', videoListener);
      videoListener = null;
    }
    currentVideo = null;
    nearEndTriggered = false;
  }

  function waitForVideo(platform, callback, attempts = 0) {
    const video = platform.getVideo();
    if (video && video.readyState >= 1) {
      callback(video);
    } else if (attempts < 20) {
      setTimeout(() => waitForVideo(platform, callback, attempts + 1), 250);
    }
  }

  function scheduleNext(platform) {
    clearAll();
    if (!settings.enabled) return;

    const delayMs = (settings.delay ?? 2) * 1000;

    if (settings.mode === 'fixed') {
      // Co X sekund — po prostu odliczamy od momentu załadowania rolki
      timer = setTimeout(() => platform.next(), delayMs);
      return;
    }

    // "ended" i "auto" obie potrzebują wideo
    waitForVideo(platform, (video) => {
      currentVideo = video;
      nearEndTriggered = false;

      if (settings.mode === 'ended') {
        // YouTube Shorts ma loop — ended może nie odpalić.
        // Zamiast tego wykrywamy moment bliski końca (<0.5s do końca)
        // lub cofnięcie currentTime (pętla wideo).
        let lastTime = 0;
        videoListener = () => {
          if (nearEndTriggered) return;
          const { currentTime, duration } = video;
          if (!duration) return;

          const nearEnd = currentTime >= duration - 0.5;
          const looped  = currentTime < lastTime - 1; // czas cofnął się = pętla

          if (nearEnd || looped) {
            nearEndTriggered = true;
            timer = setTimeout(() => platform.next(), delayMs);
          }
          lastTime = currentTime;
        };
        video.addEventListener('timeupdate', videoListener);

      } else {
        // auto-czas: odczekaj dokładnie tyle ile zostało wideo + opóźnienie
        const setupTimer = () => {
          const remaining = Math.max((video.duration - video.currentTime) * 1000, 500);
          timer = setTimeout(() => platform.next(), remaining + delayMs);
        };

        if (video.duration) {
          setupTimer();
        } else {
          video.addEventListener('loadedmetadata', setupTimer, { once: true });
        }
      }
    });
  }

  function attach() {
    const platform = getPlatform();
    if (!platform) return;
    setTimeout(() => scheduleNext(platform), 800);
  }

  // ── URL change detection (SPA) ─────────────────────────────────────────────

  function onUrlChange() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    clearAll();
    attach();
  }

  new MutationObserver(onUrlChange).observe(document.body, { childList: true, subtree: true });

  const origPush = history.pushState.bind(history);
  history.pushState = (...args) => { origPush(...args); onUrlChange(); };
  window.addEventListener('popstate', onUrlChange);

  // ── Message listener (from popup) ─────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SETTINGS_UPDATE') {
      settings = msg.settings;
      clearAll();
      if (settings.enabled) attach();
    }
    if (msg.type === 'SKIP') {
      const platform = getPlatform();
      if (platform) platform.next();
    }
  });

  // ── Init ──────────────────────────────────────────────────────────────────

  chrome.storage.sync.get({ enabled: false, mode: 'ended', delay: 2 }, (stored) => {
    settings = stored;
    attach();
  });
})();
