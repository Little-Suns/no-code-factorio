import { useStore } from './store';

const PERSIST_KEY = 'ncf.tutorial.seen.v1';

/**
 * Автостарт обучалки при первом визите (нет сохранённого флага «видел») + сохранение
 * флага, когда обучалка закрывается (Skip или последний шаг) — зеркало localePersist.ts,
 * отдельный ключ (это не мировые данные, не часть Export/Import).
 */
export function initTutorialPersist() {
  if (!localStorage.getItem(PERSIST_KEY)) {
    useStore.getState().startTutorial();
  }

  let prevActive = useStore.getState().tutorialActive;
  useStore.subscribe((state) => {
    if (prevActive && !state.tutorialActive) {
      localStorage.setItem(PERSIST_KEY, '1');
    }
    prevActive = state.tutorialActive;
  });
}
