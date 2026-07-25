import { useStore } from './store';
import type { Locale } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/dictionaries';

const PERSIST_KEY = 'ncf.locale.v1';

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as string[]).includes(value);
}

/**
 * Персистентность языка UI — зеркало initPersist()/initBlueprintPersist(), отдельный
 * ключ (язык не часть мира и не должен попадать в Export/Import фабрики).
 */
export function initLocalePersist() {
  const stored = localStorage.getItem(PERSIST_KEY);
  if (isLocale(stored)) {
    useStore.getState().setLocale(stored);
  } else {
    // Нет сохранённого выбора — берём язык браузера как более вежливый дефолт, чем
    // жёсткий 'en' для всех: у существующих RU/ZH-браузеров UI не переключится молча
    // на английский. Неизвестный/неподдерживаемый язык браузера — остаёмся на 'en'
    // (дефолт стора, store.ts).
    const nav = navigator.language.slice(0, 2);
    if (isLocale(nav)) {
      useStore.getState().setLocale(nav);
    }
  }

  let prevLocale = useStore.getState().locale;
  useStore.subscribe((state) => {
    if (state.locale !== prevLocale) {
      prevLocale = state.locale;
      localStorage.setItem(PERSIST_KEY, state.locale);
    }
  });
}
