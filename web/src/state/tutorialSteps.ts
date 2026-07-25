/**
 * Данные шагов обучалки (см. ui/Tutorial.tsx) — вынесены в чистый TS-модуль, чтобы
 * game/input.ts и ui/*.tsx хоткей-хендлеры могли читать метаданные шага (нужен ли
 * практический ввод) без импорта React-компонента.
 */

// Практика: шаг требует реального действия пользователя на канвасе/UI, а не просто
// чтения текста — во время такого шага оверлей отпускает клики/хоткеи (см. tutorialBlocksInput).
export type TutorialPractice = 'connect' | 'rotate' | 'move' | 'blueprintSave' | 'blueprintStamp';

export interface TutorialStep {
  target: string | null;
  titleKey: string;
  descKey: string;
  lang?: boolean;
  practice?: TutorialPractice;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  { target: null, titleKey: '', descKey: '', lang: true },
  { target: null, titleKey: 'tutorial.step.welcome.title', descKey: 'tutorial.step.welcome.desc' },
  { target: 'hotbar', titleKey: 'tutorial.step.hotbar.title', descKey: 'tutorial.step.hotbar.desc' },
  { target: null, titleKey: 'tutorial.step.place.title', descKey: 'tutorial.step.place.desc' },
  {
    target: 'hotbar-manipulator',
    titleKey: 'tutorial.step.manipulator.title',
    descKey: 'tutorial.step.manipulator.desc',
    practice: 'connect',
  },
  { target: null, titleKey: 'tutorial.step.rotate.title', descKey: 'tutorial.step.rotate.desc', practice: 'rotate' },
  { target: null, titleKey: 'tutorial.step.move.title', descKey: 'tutorial.step.move.desc', practice: 'move' },
  { target: null, titleKey: 'tutorial.step.config.title', descKey: 'tutorial.step.config.desc' },
  { target: 'run', titleKey: 'tutorial.step.run.title', descKey: 'tutorial.step.run.desc' },
  { target: 'results', titleKey: 'tutorial.step.results.title', descKey: 'tutorial.step.results.desc' },
  {
    target: 'blueprints',
    titleKey: 'tutorial.step.blueprints.title',
    descKey: 'tutorial.step.blueprints.desc',
    practice: 'blueprintSave',
  },
  {
    target: 'blueprints',
    titleKey: 'tutorial.step.blueprintStamp.title',
    descKey: 'tutorial.step.blueprintStamp.desc',
    practice: 'blueprintStamp',
  },
  { target: 'logs', titleKey: 'tutorial.step.logs.title', descKey: 'tutorial.step.logs.desc' },
  { target: 'debug-controls', titleKey: 'tutorial.step.debug.title', descKey: 'tutorial.step.debug.desc' },
  { target: null, titleKey: 'tutorial.step.done.title', descKey: 'tutorial.step.done.desc' },
];

/**
 * Единый гейт хоткеев/кликов обучалки: во время практик-шага пропускаем реальный ввод
 * (иначе выполнить требуемое действие невозможно), иначе (обычные информационные шаги)
 * блокируем, как и раньше — full-screen оверлей не даёт случайно наставить станков под
 * карточкой тура.
 */
export function tutorialBlocksInput(state: { tutorialActive: boolean; tutorialStep: number }): boolean {
  return state.tutorialActive && !TUTORIAL_STEPS[state.tutorialStep]?.practice;
}
