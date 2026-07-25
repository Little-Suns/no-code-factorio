/**
 * Мини-i18n без внешних библиотек (CLAUDE.md запрещает новые зависимости).
 * Текущий язык живёт в Zustand-сторе (state/store.ts, поле `locale`), персистится
 * отдельным localStorage-ключом — state/localePersist.ts, тот же паттерн, что
 * persist.ts/blueprintPersist.ts.
 *
 * Чистая функция `t()` и словари — в ./dictionaries.ts (без импорта стора, чтобы не
 * создавать цикл store.ts <-> i18n). Здесь — только React-хук, которому нужен useStore.
 */
import { useStore } from '../state/store';
import { t } from './dictionaries';

export type { Locale } from './dictionaries';
export { LOCALES, LOCALE_NAMES, t, translateEngineError } from './dictionaries';

/**
 * React-хук: возвращает функцию перевода, привязанную к текущей локали из стора,
 * и подписывается на её изменения (компонент перерисуется при переключении языка).
 */
export function useT() {
  const locale = useStore((s) => s.locale);
  return (key: string, params?: Record<string, string | number>) => t(key, locale, params);
}

/**
 * Текущая локаль вне React (для store.ts/runtime.ts).
 */
export function currentLocale() {
  return useStore.getState().locale;
}
