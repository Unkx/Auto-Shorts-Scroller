const fs = require('fs');
const path = require('path');

// Wrap file in a factory so const/function declarations are extractable via return
const i18nCode = fs.readFileSync(
  path.join(__dirname, '../auto-scroller-extension/i18n.js'),
  'utf8'
);
// new Function runs in the global scope; pass navigator/document as params
// so applyTranslations can reach jsdom's document
const factory = new Function(
  'navigator', 'document',
  i18nCode + '\nreturn { detectLang, t, applyTranslations };'
);
const { detectLang, t, applyTranslations } = factory(navigator, document);

// Helper to override navigator.languages
function setLanguages(langs) {
  Object.defineProperty(navigator, 'languages', {
    get: () => langs,
    configurable: true,
  });
}

describe('detectLang()', () => {
  it('returns "en" when no language matches', () => {
    setLanguages(['xx-YY', 'zz']);
    expect(detectLang()).toBe('en');
  });

  it('returns "en" for empty languages array', () => {
    setLanguages([]);
    expect(detectLang()).toBe('en');
  });

  it('matches exact two-letter code', () => {
    setLanguages(['pl']);
    expect(detectLang()).toBe('pl');
  });

  it('extracts base language from full locale (pt-BR → pt)', () => {
    setLanguages(['pt-BR']);
    expect(detectLang()).toBe('pt');
  });

  it('falls back to second language in list', () => {
    setLanguages(['xx-XX', 'de']);
    expect(detectLang()).toBe('de');
  });

  it('supports all bundled languages', () => {
    const bundled = ['pl', 'en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'ru', 'uk', 'cs', 'tr', 'sv', 'ja', 'ko', 'zh'];
    for (const lang of bundled) {
      setLanguages([lang]);
      expect(detectLang()).toBe(lang);
    }
  });
});

describe('t()', () => {
  it('returns a non-empty string for every known key', () => {
    const keys = ['autoScroll', 'modeTitle', 'skipBtn', 'statusNone', 'enabled', 'disabled', 'statusReady'];
    for (const key of keys) {
      const result = t(key);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it('interpolates {name} placeholder', () => {
    const result = t('statusActive', { name: 'TikTok' });
    expect(result).toContain('TikTok');
    expect(result).not.toContain('{name}');
  });

  it('interpolates longer name without leaving placeholder', () => {
    const result = t('statusActive', { name: 'YouTube Shorts' });
    expect(result).toContain('YouTube Shorts');
    expect(result).not.toContain('{name}');
  });

  it('returns the key itself when not found anywhere', () => {
    expect(t('__nonexistent_key__')).toBe('__nonexistent_key__');
  });

  it('handles empty vars object', () => {
    const result = t('statusNone', {});
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('applyTranslations()', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('sets textContent for data-i18n elements', () => {
    document.body.innerHTML = '<span data-i18n="skipBtn"></span>';
    applyTranslations();
    const el = document.querySelector('[data-i18n]');
    expect(el.textContent).toBe(t('skipBtn'));
    expect(el.textContent.length).toBeGreaterThan(0);
  });

  it('sets innerHTML with <br> for newlines in data-i18n-html elements', () => {
    document.body.innerHTML = '<span data-i18n-html="modeEnded"></span>';
    applyTranslations();
    const el = document.querySelector('[data-i18n-html]');
    expect(el.innerHTML).toContain('<br>');
  });

  it('translates multiple elements in one pass', () => {
    document.body.innerHTML = `
      <span data-i18n="skipBtn"></span>
      <span data-i18n="enabled"></span>
      <span data-i18n="disabled"></span>
    `;
    applyTranslations();
    const els = document.querySelectorAll('[data-i18n]');
    expect(els[0].textContent).toBe(t('skipBtn'));
    expect(els[1].textContent).toBe(t('enabled'));
    expect(els[2].textContent).toBe(t('disabled'));
  });

  it('returns the key as textContent when key is unknown', () => {
    document.body.innerHTML = '<span data-i18n="__bad_key__"></span>';
    applyTranslations();
    expect(document.querySelector('[data-i18n]').textContent).toBe('__bad_key__');
  });

  it('does not throw when no i18n elements are present', () => {
    document.body.innerHTML = '<div>hello</div>';
    expect(() => applyTranslations()).not.toThrow();
  });
});
