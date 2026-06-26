const { createChromeMock } = require('./helpers/chrome');

let installedListener;

beforeAll(() => {
  const chrome = createChromeMock();
  chrome.runtime.onInstalled.addListener.mockImplementation((fn) => {
    installedListener = fn;
  });
  global.chrome = chrome;

  // require() runs in Jest's jsdom context where global.chrome is visible
  require('../auto-scroller-extension/background.js');
});

describe('background.js', () => {
  it('registers exactly one onInstalled listener', () => {
    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalledTimes(1);
    expect(installedListener).toBeInstanceOf(Function);
  });

  it('sets correct default settings on install', () => {
    installedListener();
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      enabled: false,
      mode: 'ended',
      delay: 2,
    });
  });

  it('default settings have enabled: false (extension starts inactive)', () => {
    installedListener();
    const [[args]] = chrome.storage.sync.set.mock.calls;
    expect(args.enabled).toBe(false);
  });

  it('default mode is "ended"', () => {
    installedListener();
    const [[args]] = chrome.storage.sync.set.mock.calls;
    expect(args.mode).toBe('ended');
  });

  it('default delay is 2 seconds', () => {
    installedListener();
    const [[args]] = chrome.storage.sync.set.mock.calls;
    expect(args.delay).toBe(2);
  });
});
