// ── Location mock ──────────────────────────────────────────────────────────
// Must replace window.location BEFORE requiring content.js so the IIFE
// captures a mutable object for `lastUrl` and platform detection.
const locationMock = {
  href: 'https://www.youtube.com/shorts/abc123',
  pathname: '/shorts/abc123',
  hostname: 'www.youtube.com',
};
delete window.location;
window.location = locationMock;

// ── Chrome mock ────────────────────────────────────────────────────────────
let messageListener;

global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn((fn) => { messageListener = fn; }),
    },
  },
  storage: {
    sync: {
      // Don't auto-invoke callback — keeps IIFE's initial attach() from firing
      get: jest.fn(),
      set: jest.fn(),
    },
  },
};

// ── Load content.js via require() — IIFE executes in jsdom context ─────────
jest.useFakeTimers();
require('../auto-scroller-extension/content.js');

// ── Helpers ────────────────────────────────────────────────────────────────
function createMockVideo({ readyState = 4, duration = 60, currentTime = 0 } = {}) {
  const video = document.createElement('video');
  let _ct = currentTime;
  Object.defineProperty(video, 'readyState', { get: () => readyState, configurable: true });
  Object.defineProperty(video, 'duration', { get: () => duration, configurable: true });
  Object.defineProperty(video, 'currentTime', {
    get: () => _ct,
    set: (v) => { _ct = v; },
    configurable: true,
  });
  return video;
}

function setLocation({ pathname, hostname, href } = {}) {
  if (pathname !== undefined) locationMock.pathname = pathname;
  if (hostname !== undefined) locationMock.hostname = hostname;
  if (href !== undefined) locationMock.href = href;
}

function resetLocation() {
  locationMock.href = 'https://www.youtube.com/shorts/abc123';
  locationMock.pathname = '/shorts/abc123';
  locationMock.hostname = 'www.youtube.com';
}

afterEach(() => {
  jest.clearAllTimers();
  // Reset content.js internal state
  messageListener({ type: 'SETTINGS_UPDATE', settings: { enabled: false, mode: 'ended', delay: 2 } });
  document.body.innerHTML = '';
  resetLocation();
});

afterAll(() => {
  jest.useRealTimers();
});

// ── Initialization ─────────────────────────────────────────────────────────

describe('initialization', () => {
  it('registers chrome.runtime.onMessage listener on load', () => {
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    expect(messageListener).toBeInstanceOf(Function);
  });

  it('reads settings from chrome.storage.sync with defaults', () => {
    expect(chrome.storage.sync.get).toHaveBeenCalledWith(
      { enabled: false, mode: 'ended', delay: 2 },
      expect.any(Function)
    );
  });
});

// ── Platform detection (via SKIP fallback keyboard event) ─────────────────

describe('platform detection', () => {
  it('detects YouTube Shorts — dispatches ArrowDown', () => {
    setLocation({ pathname: '/shorts/xyz', hostname: 'www.youtube.com' });
    const spy = jest.spyOn(document.body, 'dispatchEvent');
    messageListener({ type: 'SKIP' });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'keydown', key: 'ArrowDown', keyCode: 40 })
    );
    spy.mockRestore();
  });

  it('detects TikTok — dispatches ArrowDown', () => {
    setLocation({ pathname: '/', hostname: 'www.tiktok.com' });
    const spy = jest.spyOn(document.body, 'dispatchEvent');
    messageListener({ type: 'SKIP' });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'keydown', key: 'ArrowDown' })
    );
    spy.mockRestore();
  });

  it('detects Instagram /reels/ — dispatches ArrowRight', () => {
    setLocation({ pathname: '/reels/abc123/', hostname: 'www.instagram.com' });
    const spy = jest.spyOn(document.body, 'dispatchEvent');
    messageListener({ type: 'SKIP' });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'keydown', key: 'ArrowRight', keyCode: 39 })
    );
    spy.mockRestore();
  });

  it('detects Instagram /reel/ (singular) — dispatches ArrowRight', () => {
    setLocation({ pathname: '/reel/abc123/', hostname: 'www.instagram.com' });
    const spy = jest.spyOn(document.body, 'dispatchEvent');
    messageListener({ type: 'SKIP' });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'keydown', key: 'ArrowRight' }));
    spy.mockRestore();
  });

  it('no-op on SKIP when not on a supported URL', () => {
    setLocation({ pathname: '/watch', hostname: 'www.youtube.com' });
    const spy = jest.spyOn(document.body, 'dispatchEvent');
    messageListener({ type: 'SKIP' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ── SKIP: button takes priority over keyboard fallback ────────────────────

describe('SKIP — DOM button vs keyboard fallback', () => {
  it('clicks #navigation-button-down button when present (YouTube)', () => {
    setLocation({ pathname: '/shorts/xyz', hostname: 'www.youtube.com' });
    const btn = document.createElement('button');
    const wrapper = document.createElement('div');
    wrapper.id = 'navigation-button-down';
    wrapper.appendChild(btn);
    document.body.appendChild(wrapper);

    const clickSpy = jest.spyOn(btn, 'click');
    const dispatchSpy = jest.spyOn(document.body, 'dispatchEvent');
    messageListener({ type: 'SKIP' });

    expect(clickSpy).toHaveBeenCalled();
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('clicks [data-e2e="arrow-right"] button when present (TikTok)', () => {
    setLocation({ pathname: '/', hostname: 'www.tiktok.com' });
    const btn = document.createElement('button');
    btn.setAttribute('data-e2e', 'arrow-right');
    document.body.appendChild(btn);

    const clickSpy = jest.spyOn(btn, 'click');
    messageListener({ type: 'SKIP' });
    expect(clickSpy).toHaveBeenCalled();
  });

  it('clicks aria-label next button when present (Instagram)', () => {
    setLocation({ pathname: '/reels/abc/', hostname: 'www.instagram.com' });
    const btn = document.createElement('button');
    btn.setAttribute('aria-label', 'Next');
    document.body.appendChild(btn);

    const clickSpy = jest.spyOn(btn, 'click');
    const dispatchSpy = jest.spyOn(document.body, 'dispatchEvent');
    messageListener({ type: 'SKIP' });

    expect(clickSpy).toHaveBeenCalled();
    expect(dispatchSpy).not.toHaveBeenCalled();
  });
});

// ── SETTINGS_UPDATE ────────────────────────────────────────────────────────

describe('SETTINGS_UPDATE', () => {
  beforeEach(() => {
    setLocation({ pathname: '/shorts/abc', hostname: 'www.youtube.com' });
  });

  it('disabled setting prevents any navigation', () => {
    const spy = jest.spyOn(document.body, 'dispatchEvent');
    messageListener({ type: 'SETTINGS_UPDATE', settings: { enabled: false, mode: 'fixed', delay: 1 } });
    jest.advanceTimersByTime(30_000);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('fixed mode navigates after attach delay (800ms) + interval', () => {
    const spy = jest.spyOn(document.body, 'dispatchEvent');
    messageListener({ type: 'SETTINGS_UPDATE', settings: { enabled: true, mode: 'fixed', delay: 5 } });

    jest.advanceTimersByTime(799);
    expect(spy).not.toHaveBeenCalled(); // attach delay not yet done

    jest.advanceTimersByTime(1);        // 800ms → scheduleNext fires → sets 5s timer

    jest.advanceTimersByTime(4999);
    expect(spy).not.toHaveBeenCalled(); // interval not yet done

    jest.advanceTimersByTime(1);        // 5000ms → platform.next()
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'keydown', key: 'ArrowDown', keyCode: 40 })
    );
    spy.mockRestore();
  });

  it('re-enabling after disable resumes scheduling', () => {
    const spy = jest.spyOn(document.body, 'dispatchEvent');
    messageListener({ type: 'SETTINGS_UPDATE', settings: { enabled: false, mode: 'fixed', delay: 1 } });
    jest.advanceTimersByTime(5000);
    expect(spy).not.toHaveBeenCalled();

    messageListener({ type: 'SETTINGS_UPDATE', settings: { enabled: true, mode: 'fixed', delay: 1 } });
    jest.advanceTimersByTime(800 + 1000);

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'keydown' }));
    spy.mockRestore();
  });
});

// ── Ended mode: near-end and loop detection ────────────────────────────────

describe('ended mode', () => {
  beforeEach(() => {
    setLocation({ pathname: '/shorts/abc', hostname: 'www.youtube.com' });
  });

  it('triggers navigation when video reaches near-end (< 0.5s remaining)', () => {
    const video = createMockVideo({ readyState: 4, duration: 30, currentTime: 29.6 });
    document.body.appendChild(video);

    const spy = jest.spyOn(document.body, 'dispatchEvent');
    messageListener({ type: 'SETTINGS_UPDATE', settings: { enabled: true, mode: 'ended', delay: 1 } });

    jest.advanceTimersByTime(800); // attach delay → scheduleNext → attaches timeupdate listener

    video.dispatchEvent(new Event('timeupdate'));
    jest.advanceTimersByTime(1000); // delay = 1s

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'keydown', key: 'ArrowDown' })
    );
    spy.mockRestore();
  });

  it('does not trigger when video is not near end', () => {
    const video = createMockVideo({ readyState: 4, duration: 30, currentTime: 10 });
    document.body.appendChild(video);

    const spy = jest.spyOn(document.body, 'dispatchEvent');
    messageListener({ type: 'SETTINGS_UPDATE', settings: { enabled: true, mode: 'ended', delay: 1 } });

    jest.advanceTimersByTime(800);
    video.dispatchEvent(new Event('timeupdate'));
    jest.advanceTimersByTime(5000);

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('nearEndTriggered guard prevents double navigation', () => {
    const video = createMockVideo({ readyState: 4, duration: 30, currentTime: 29.6 });
    document.body.appendChild(video);

    const spy = jest.spyOn(document.body, 'dispatchEvent');
    messageListener({ type: 'SETTINGS_UPDATE', settings: { enabled: true, mode: 'ended', delay: 1 } });

    jest.advanceTimersByTime(800);
    video.dispatchEvent(new Event('timeupdate')); // first near-end → triggers
    video.dispatchEvent(new Event('timeupdate')); // second → guarded
    jest.advanceTimersByTime(2000);

    const keydownEvents = spy.mock.calls.filter(([e]) => e.type === 'keydown');
    expect(keydownEvents).toHaveLength(1);
    spy.mockRestore();
  });

  it('detects loop (currentTime jumped backward) and triggers navigation', () => {
    let _ct = 28;
    const video = document.createElement('video');
    Object.defineProperty(video, 'readyState', { get: () => 4, configurable: true });
    Object.defineProperty(video, 'duration', { get: () => 30, configurable: true });
    Object.defineProperty(video, 'currentTime', {
      get: () => _ct,
      set: (v) => { _ct = v; },
      configurable: true,
    });
    document.body.appendChild(video);

    const spy = jest.spyOn(document.body, 'dispatchEvent');
    messageListener({ type: 'SETTINGS_UPDATE', settings: { enabled: true, mode: 'ended', delay: 0 } });

    jest.advanceTimersByTime(800);

    video.dispatchEvent(new Event('timeupdate')); // currentTime=28, lastTime→28
    _ct = 1; // loop: jumps back (< 28 - 1 = 27 → looped=true)
    video.dispatchEvent(new Event('timeupdate'));

    jest.advanceTimersByTime(100);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'keydown' }));
    spy.mockRestore();
  });
});

// ── Auto-timed mode ────────────────────────────────────────────────────────

describe('auto-timed mode', () => {
  beforeEach(() => {
    setLocation({ pathname: '/shorts/abc', hostname: 'www.youtube.com' });
  });

  it('schedules navigation based on remaining time + delay', () => {
    // 20s remaining (duration=30, currentTime=10), delay=2 → timer fires at 22s
    const video = createMockVideo({ readyState: 4, duration: 30, currentTime: 10 });
    document.body.appendChild(video);

    const spy = jest.spyOn(document.body, 'dispatchEvent');
    messageListener({ type: 'SETTINGS_UPDATE', settings: { enabled: true, mode: 'auto', delay: 2 } });

    jest.advanceTimersByTime(800); // attach delay

    jest.advanceTimersByTime(21_999); // 1ms before fire
    expect(spy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1); // fires now
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'keydown' }));
    spy.mockRestore();
  });
});

// ── waitForVideo retry ─────────────────────────────────────────────────────

describe('waitForVideo retry', () => {
  beforeEach(() => {
    setLocation({ pathname: '/shorts/abc', hostname: 'www.youtube.com' });
  });

  it('retries every 250ms until video readyState >= 1', () => {
    let _readyState = 0;
    const video = document.createElement('video');
    Object.defineProperty(video, 'readyState', { get: () => _readyState, configurable: true });
    Object.defineProperty(video, 'duration', { get: () => 60, configurable: true });
    Object.defineProperty(video, 'currentTime', { get: () => 0, configurable: true });
    document.body.appendChild(video);

    const spy = jest.spyOn(document.body, 'dispatchEvent');
    messageListener({ type: 'SETTINGS_UPDATE', settings: { enabled: true, mode: 'fixed', delay: 1 } });

    jest.advanceTimersByTime(800);  // attach → waitForVideo (readyState=0, schedules retry)
    jest.advanceTimersByTime(250);  // retry 1 — still not ready

    _readyState = 4;                // video becomes ready
    jest.advanceTimersByTime(250);  // retry 2 — scheduleNext fires → 1s timer
    jest.advanceTimersByTime(1000); // fixed delay elapses → platform.next()

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'keydown' }));
    spy.mockRestore();
  });
});
