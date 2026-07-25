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
  }

  let prevLocale = useStore.getState().locale;
  useStore.subscribe((state) => {
    if (state.locale !== prevLocale) {
      prevLocale = state.locale;
      localStorage.setItem(PERSIST_KEY, state.locale);
    }
  });
}
