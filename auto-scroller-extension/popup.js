(() => {
  const enabledToggle = document.getElementById('enabledToggle');
  const toggleSub     = document.getElementById('toggleSub');
  const powerRow      = document.getElementById('powerRow');
  const delaySlider   = document.getElementById('delaySlider');
  const delayVal      = document.getElementById('delayVal');
  const skipBtn       = document.getElementById('skipBtn');
  const statusDot     = document.getElementById('statusDot');
  const statusText    = document.getElementById('statusText');
  const modeBtns      = document.querySelectorAll('.mode-btn');

  let settings = { enabled: false, mode: 'ended', delay: 2 };

  function fmt(v) { return parseFloat(v).toFixed(1) + 's'; }

  function saveAndBroadcast() {
    chrome.storage.sync.set(settings);
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATE', settings }).catch(() => {});
      }
    });
  }

  function applySettings() {
    enabledToggle.checked = settings.enabled;
    toggleSub.textContent = settings.enabled ? 'Włączone' : 'Wyłączone';
    powerRow.classList.toggle('active', settings.enabled);
    delaySlider.value = settings.delay;
    delayVal.textContent = fmt(settings.delay);
    modeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === settings.mode));
    updateStatus();
  }

  function updateStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab) return;
      const url      = tab.url ?? '';
      const isShorts = url.includes('youtube.com/shorts');
      const isTiktok = url.includes('tiktok.com');
      const isReels  = url.includes('instagram.com/reel');

      if (isShorts || isTiktok || isReels) {
        const name = isShorts ? 'YouTube Shorts' : isTiktok ? 'TikTok' : 'Instagram Reels';
        statusText.textContent = settings.enabled ? `Aktywne na ${name}` : 'Gotowe — włącz powyżej';
        statusDot.className = 's-dot' + (settings.enabled ? ' live' : '');
      } else {
        statusText.textContent = 'Brak aktywnej karty z rolkami';
        statusDot.className = 's-dot';
      }
    });
  }

  enabledToggle.addEventListener('change', () => {
    settings.enabled = enabledToggle.checked;
    toggleSub.textContent = settings.enabled ? 'Włączone' : 'Wyłączone';
    powerRow.classList.toggle('active', settings.enabled);
    updateStatus();
    saveAndBroadcast();
  });

  delaySlider.addEventListener('input', () => {
    settings.delay = parseFloat(delaySlider.value);
    delayVal.textContent = fmt(settings.delay);
  });

  delaySlider.addEventListener('change', saveAndBroadcast);

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      settings.mode = btn.dataset.mode;
      modeBtns.forEach(b => b.classList.toggle('active', b === btn));
      saveAndBroadcast();
    });
  });

  skipBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'SKIP' }).catch(() => {});
      }
    });
  });

  chrome.storage.sync.get({ enabled: false, mode: 'ended', delay: 2 }, (stored) => {
    settings = stored;
    applySettings();
  });
})();
