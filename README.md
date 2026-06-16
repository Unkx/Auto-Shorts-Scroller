# AutoScroller – Shorts & Reels

A Chrome extension that automatically advances through short-form videos on YouTube Shorts, TikTok, and Instagram Reels.

---

## Features

- **3 scroll modes** — advance after video ends, on a fixed timer, or based on video duration
- **Adjustable delay** — 0 to 30 seconds with 0.5s precision
- **Manual skip** — jump to the next video anytime from the popup
- **Persistent settings** — saved via `chrome.storage.sync`, survive browser restarts
- **SPA-aware** — detects URL changes on single-page apps without requiring a page reload

## Supported platforms

| Platform | URL pattern |
|---|---|
| YouTube Shorts | `youtube.com/shorts/*` |
| TikTok | `tiktok.com/*` |
| Instagram Reels | `instagram.com/reel/*`, `instagram.com/reels/*` |

---

## Installation

This extension is not published to the Chrome Web Store. Load it manually as an unpacked extension:

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `auto-scroller-extension` folder

The extension icon will appear in the toolbar. Pin it for quick access.

---

## Scroll modes

### After video ends (`ended`)
Waits for the current video to finish, then advances after the configured delay.

> YouTube Shorts loops videos by default — the `ended` event never fires on a looping video. This mode uses a `timeupdate` listener instead, triggering when playback reaches within 0.5 seconds of the end, or when the timestamp resets (loop detected).

### Every X seconds (`fixed`)
Ignores video length entirely. Advances exactly after the delay you set, counting from when the page loads.

### Auto-time (`auto`)
Calculates how much time is left in the current video (`duration − currentTime`) and advances after that remaining time plus the configured delay. Waits for video metadata to be available before starting the timer.

---

## File structure

```
auto-scroller-extension/
├── manifest.json       # Extension manifest (Manifest V3)
├── content.js          # Injected into short-form video pages
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic — reads/writes settings, sends messages
├── background.js       # Service worker — sets default settings on install
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## How it works

`content.js` is injected into matching pages and listens for URL changes (YouTube, TikTok, and Instagram are all SPAs). On each navigation to a short-form video URL, it finds the active `<video>` element and sets up a scroll trigger based on the current mode.

The popup communicates with the active tab via `chrome.runtime.sendMessage`. When settings change in the popup, a `SETTINGS_UPDATE` message is sent to the content script, which resets its timer and reattaches with the new configuration. A `SKIP` message triggers an immediate navigation.

Platform-specific `next()` functions try to click the native navigation button first, falling back to a keyboard event (`ArrowDown` / `ArrowRight`) if no button is found.

---

## Permissions

| Permission | Reason |
|---|---|
| `storage` | Save and sync user settings |
| `tabs` | Read the active tab URL to show status in the popup |
| `host_permissions` | Inject content script into YouTube, TikTok, Instagram |

---

## Known limitations

- YouTube occasionally changes its DOM structure — if auto-advance stops working, check the browser console for selector errors in `content.js`
- TikTok's layout varies between desktop and mobile web versions
- Instagram Reels navigation relies on keyboard simulation and may break if Instagram blocks synthetic key events
