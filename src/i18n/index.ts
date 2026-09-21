import {uz} from './uz';

export type LanguagePreference = 'system' | 'en' | 'uz';
export type Language = 'en' | 'uz';

/** English is the key as well as the fallback, so an untranslated string still reads. */
export type Dictionary = Record<string, string>;

const DICTIONARIES: Record<Language, Dictionary> = {en: {}, uz};

export function resolveLanguage(
  preference: LanguagePreference,
  deviceLanguage?: string,
): Language {
  if (preference === 'en' || preference === 'uz') {
    return preference;
  }
  return deviceLanguage?.toLowerCase().startsWith('uz') ? 'uz' : 'en';
}

export type Translate = (
  english: string,
  params?: Record<string, string | number>,
) => string;

export function createTranslator(language: Language): Translate {
  const dictionary = DICTIONARIES[language] ?? {};
  return (english, params) => {
    const template = dictionary[english] ?? english;
    if (!params) {
      return template;
    }
    return Object.keys(params).reduce(
      (text, key) => text.split(`{${key}}`).join(String(params[key])),
      template,
    );
  };
}

export const LANGUAGE_OPTIONS: Array<{
  value: LanguagePreference;
  label: string;
}> = [
  {value: 'system', label: 'Auto'},
  {value: 'en', label: 'English'},
  {value: 'uz', label: "O'zbek"},
];
