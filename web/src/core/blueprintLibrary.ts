/**
 * Библиотека готовых чертежей (усиление поверх E4): статичный набор пресетов,
 * который поставляется вместе с приложением — в отличие от `store.blueprints`
 * (пользовательские чертежи в localStorage, `blueprintPersist.ts`), эти данные
 * не сохраняются и не удаляются пользователем, только читаются и ставятся.
 *
 * Тот же формат `Blueprint`, что и у пользовательских чертежей (`core/blueprint.ts`) —
 * ставятся тем же путём: `instantiateBlueprint` + `canPlaceBlueprint` + `store.placeMany`
 * (см. `game/input.ts`, где lookup идёт по объединению `store.blueprints` и этого массива).
 *
 * Геометрия портов/входов взята из `core/grid.ts` (outPorts/inTiles) — каждый пресет
 * ниже соблюдает инвариант «manipulator обязателен для любой передачи станок↔станок»
 * (docs/03): belt может вести из пустоты в manipulator напрямую, но между двумя
 * «настоящими» станками всегда стоит manipulator. Раунд-трип и связность каждого
 * пресета проверяет `__checks__/blueprintLibrary.ts`.
 */

import { Blueprint } from './blueprint';
import { Entity } from './types';

function e(id: string, kind: Entity['kind'], x: number, y: number, config: Record<string, unknown> = {}): Entity {
  return { id, kind, pos: { x, y }, dir: 1, config };
}

// 1. Ячейка обработки: шахта → манипулятор → ассемблер (LLM-суммаризатор).
// Только один из двух выходных портов майнера подключён намеренно: майнер 2×2 физически
// отдаёт FRONT с обоих тайлов, и demo.json (B3) подключает оба через отдельные
// belt+manipulator в assembler — но engine.ts клонирует пакет на каждый live edge, а значит
// две линии = два одинаковых пакета на один trigger → assembler (LLM) вызывается ДВАЖДЫ за
// клик по цене одного отзыва. Для «рекомендованного» пресета это тихое удвоение стоимости
// нежелательно, поэтому здесь оставлена одна линия — второй порт майнера просто не подключён
// (dead-end, не ошибка, buildGraph такое допускает).
const processingCell: Blueprint = {
  id: 'lib-processing-cell',
  name: 'Ячейка обработки',
  entities: [
    e('pc-miner', 'miner', 0, 0, { mode: 'text', text: 'Great product! Fast delivery and excellent service.', intervalSec: 0 }),
    e('pc-belt-1', 'belt', 2, 0),
    e('pc-manip-1', 'manipulator', 3, 0),
    e('pc-assembler', 'assembler', 4, 0, { recipe: 'summarizer', modules: [] }),
  ],
};

// 2. Разветвитель на 2 выхода: сплиттер → (true/false) → манипулятор → сундук на каждой ветке.
const splitterBranch: Blueprint = {
  id: 'lib-splitter-branch',
  name: 'Разветвитель на 2 выхода',
  entities: [
    e('sb-splitter', 'splitter', 0, 0, { mode: 'expr', expr: 'true', question: 'Is this positive?' }),
    e('sb-belt-true', 'belt', 1, 0),
    e('sb-manip-true', 'manipulator', 2, 0),
    e('sb-chest-true', 'chest', 3, 0, { batchSize: 1 }),
    e('sb-belt-false', 'belt', 1, 1),
    e('sb-manip-false', 'manipulator', 2, 1),
    e('sb-chest-false', 'chest', 3, 1, { batchSize: 1 }),
  ],
};

// 3. Смеситель, объединяющий 2 ленты: два независимых входа (back-сторона, верх/низ) → mixer → сундук.
const mixerJoin: Blueprint = {
  id: 'lib-mixer-join',
  name: 'Смеситель из 2 лент',
  entities: [
    e('mj-belt-top', 'belt', 0, 0),
    e('mj-manip-top', 'manipulator', 1, 0),
    e('mj-belt-bottom', 'belt', 0, 2),
    e('mj-manip-bottom', 'manipulator', 1, 2),
    e('mj-mixer', 'mixer', 2, 0, { mode: 'concat', prompt: 'Merge these items into one' }),
    e('mj-belt-out', 'belt', 5, 1),
    e('mj-manip-out', 'manipulator', 6, 1),
    e('mj-chest', 'chest', 7, 1, { batchSize: 1 }),
  ],
};

// 4. Полная линия саммаризатора: шахта → ассемблер → манипулятор → силос (запуск ракеты).
// Как и в (1): только одна линия майнер→ассемблер подключена (см. комментарий у
// processingCell выше) — иначе assembler (LLM) и, как следствие, silo/ракета отработали
// бы дважды на один trigger майнера.
const summarizerLine: Blueprint = {
  id: 'lib-summarizer-line',
  name: 'Линия саммаризатора → силос',
  entities: [
    e('sl-miner', 'miner', 0, 0, { mode: 'text', text: 'Great product! Fast delivery and excellent service.', intervalSec: 0 }),
    e('sl-belt-1', 'belt', 2, 0),
    e('sl-manip-1', 'manipulator', 3, 0),
    e('sl-assembler', 'assembler', 4, 0, { recipe: 'summarizer', modules: [] }),
    e('sl-belt-3', 'belt', 6, 0),
    e('sl-manip-3', 'manipulator', 7, 0),
    e('sl-silo', 'silo', 8, 0),
  ],
};

// 5. Предобработка + буфер: лента → манипулятор → печь (JS-препроцессор) → манипулятор → сундук (пачка).
const furnaceBuffer: Blueprint = {
  id: 'lib-furnace-buffer',
  name: 'Предобработка + буфер',
  entities: [
    e('fb-belt-in', 'belt', 0, 0),
    e('fb-manip-in', 'manipulator', 1, 0),
    e('fb-furnace', 'furnace', 2, 0, { code: 'return String(data).toUpperCase();' }),
    e('fb-belt-out', 'belt', 4, 0),
    e('fb-manip-out', 'manipulator', 5, 0),
    e('fb-chest', 'chest', 6, 0, { batchSize: 3 }),
  ],
};

/** Библиотека пресетов — read-only, показывается отдельным разделом в BlueprintPanel. */
export const LIBRARY_BLUEPRINTS: Blueprint[] = [
  processingCell,
  splitterBranch,
  mixerJoin,
  summarizerLine,
  furnaceBuffer,
];

export function findLibraryBlueprint(id: string): Blueprint | undefined {
  return LIBRARY_BLUEPRINTS.find((bp) => bp.id === id);
}
