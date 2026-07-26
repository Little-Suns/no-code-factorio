/**
 * Уровни/челленджи: задания «построй схему с функционалом X», принимаются по
 * появлению корректной записи в results (см. state/runtime.ts::evaluateActiveLevel).
 * Чистый TS — та же идиома, что и NODE_DEFS/Handler (core/nodes/index.ts): evaluate
 * лежит прямо в объекте, т.к. Level — dev-контент, никогда не сериализуется в отличие
 * от Blueprint (который специально сделан чисто-декларативным ради экспорта строкой).
 */

// Зеркало Store['results'] (web/src/state/store.ts) — не импортируем оттуда напрямую,
// core/ не должен зависеть от state/ (инвариант проекта).
export type LevelResults = Record<string, { at: number; data: unknown }[]>;

export interface Level {
  id: string;
  titleKey: string;
  descKey: string;
  hintKeys: string[]; // раскрываются по одной, см. store.revealHint
  parEntities: number; // <= это число сущностей на момент успеха → 3 звезды
  goodEntities: number; // <= это число → 2 звезды, иначе (после успеха) 1 звезда
  evaluate: (results: LevelResults) => boolean;
  bonus?: boolean; // «уровень со звёздочкой» — особая карточка в LevelPanel; разлочен только когда
  // пройдены (stars > 0) все не-bonus уровни, см. LevelPanel.tsx::isUnlocked
}
