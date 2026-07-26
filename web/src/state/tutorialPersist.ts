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
      // Первое закрытие обучалки за всё время (флага ещё не было) — показать разовую
      // всплывашку-подсказку про уровни (ui/LevelsNudge.tsx). Повторные прохождения
      // тура (кнопка «? Обучение» в TopBar) её больше не показывают.
      const firstTime = !localStorage.getItem(PERSIST_KEY);
      localStorage.setItem(PERSIST_KEY, '1');
      if (firstTime) useStore.getState().setLevelsNudgeVisible(true);
    }
    prevActive = state.tutorialActive;
  });
}
