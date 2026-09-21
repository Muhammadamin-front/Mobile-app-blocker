import {createTranslator, resolveLanguage} from '../src/i18n';

describe('language resolution', () => {
  it('honours an explicit choice over the phone', () => {
    expect(resolveLanguage('en', 'uz')).toBe('en');
    expect(resolveLanguage('uz', 'en')).toBe('uz');
  });

  it('follows the phone when set to system', () => {
    expect(resolveLanguage('system', 'uz')).toBe('uz');
    expect(resolveLanguage('system', 'uz-UZ')).toBe('uz');
    expect(resolveLanguage('system', 'UZ')).toBe('uz');
    expect(resolveLanguage('system', 'ru')).toBe('en');
  });

  it('falls back to English when the phone says nothing', () => {
    expect(resolveLanguage('system', undefined)).toBe('en');
    expect(resolveLanguage('system', '')).toBe('en');
  });
});

describe('translation', () => {
  it('returns the English string when nothing is translated', () => {
    expect(createTranslator('en')('Focus time')).toBe('Focus time');
  });

  it('translates a known string', () => {
    expect(createTranslator('uz')('Focus')).toBe('Fokus');
  });

  it('falls back to English rather than showing a key', () => {
    const unknown = 'A string nobody has translated yet';
    expect(createTranslator('uz')(unknown)).toBe(unknown);
  });

  it('substitutes every occurrence of a placeholder', () => {
    const t = createTranslator('en');
    expect(t('{n} of {n}', {n: 3})).toBe('3 of 3');
    expect(t('{count} apps blocked', {count: 5})).toBe('5 apps blocked');
  });

  it('leaves a placeholder alone when no value is given', () => {
    expect(createTranslator('en')('{count} apps')).toBe('{count} apps');
  });
});
