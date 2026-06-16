chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ enabled: false, mode: 'ended', delay: 2 });
});
