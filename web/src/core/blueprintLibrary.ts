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

// Как e(), но с явным dir — нужен только лентам, которые поворачивают трассу
// (dir=0 север / dir=2 юг), сами станки в пресетах ниже всегда dir=1 (восток).
function eDir(id: string, kind: Entity['kind'], x: number, y: number, dir: Entity['dir'], config: Record<string, unknown> = {}): Entity {
  return { id, kind, pos: { x, y }, dir, config };
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

// 2. Дублер на 2 выхода: дублер (2×2) → манипулятор → сундук на каждой ветке.
// Оба выхода — одна и та же копия входа (движок клонирует пакет на каждый выход).
// Порты 2×2-дублера dir=1: (2,0) и (2,1) → ленты веток начинаются там.
const duplicatorBranch: Blueprint = {
  id: 'lib-duplicator-branch',
  name: 'Дублер на 2 выхода',
  entities: [
    e('sb-duplicator', 'duplicator', 0, 0),
    e('sb-belt-a', 'belt', 2, 0),
    e('sb-manip-a', 'manipulator', 3, 0),
    e('sb-chest-a', 'chest', 4, 0, { batchSize: 1 }),
    e('sb-belt-b', 'belt', 2, 1),
    e('sb-manip-b', 'manipulator', 3, 1),
    e('sb-chest-b', 'chest', 4, 1, { batchSize: 1 }),
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

// 6. Ревью-конвейер с алертом (большой пресет): шахта → ассемблер (классификатор
// тональности) → манипулятор → дублер → ОДНОВРЕМЕННО обе копии: силос (архив) и
// вебхук (алерт в Discord/Slack). Показывает дублер не как игрушку («2 сундука»,
// см. duplicatorBranch выше), а в реальном сценарии фан-аута одного результата
// сразу в архив и в уведомление. Геометрия портов дублера (2×2, dir=1): FRONT-порты
// на (x+2,y) и (x+2,y+1) — левый идёт прямо в силос, правый уходит south-south-east
// в вебхук, обходя 3×3-футпринт силоса снизу.
const reviewAlertLine: Blueprint = {
  id: 'lib-review-alert',
  name: 'Ревью-конвейер с алертом',
  entities: [
    e('ra-miner', 'miner', 0, 0, { mode: 'text', text: 'Товар пришёл с браком, требую возврат денег.', intervalSec: 0 }),
    e('ra-belt-1', 'belt', 2, 0),
    e('ra-manip-1', 'manipulator', 3, 0),
    e('ra-assembler', 'assembler', 4, 0, { recipe: 'sentiment', modules: [] }),
    e('ra-belt-2', 'belt', 6, 0),
    e('ra-manip-2', 'manipulator', 7, 0),
    e('ra-dup', 'duplicator', 8, 0),
    e('ra-belt-a', 'belt', 10, 0),
    e('ra-manip-a', 'manipulator', 11, 0),
    e('ra-silo', 'silo', 12, 0),
    eDir('ra-belt-b1', 'belt', 10, 1, 2),
    eDir('ra-belt-b2', 'belt', 10, 2, 2),
    e('ra-belt-b3', 'belt', 10, 3),
    e('ra-manip-b', 'manipulator', 11, 3),
    e('ra-webhook', 'webhook', 12, 3, {
      url: 'https://your-webhook-url.example.com/alert',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"content": "⚠️ {{text}}"}',
    }),
  ],
};

// 7. Мультиисточник + смеситель (большой пресет): два независимых конвейера
// (шахта → ассемблер-суммаризатор каждый) сводятся в mixer (BACK-сторона, две разные
// строки её западного столбца) → LLM-синтез объединяет оба саммари в один отчёт →
// силос. Второй источник заходит в mixer «сверху» — три ленты обходят его FRONT-порт
// снизу вверх до нужной строки BACK-столбца, тот же приём, что у mixerJoin выше,
// только с полноценными ассемблерами на обоих входах вместо голых лент.
const multiSourceMixer: Blueprint = {
  id: 'lib-multi-source-mixer',
  name: 'Мультиисточник + смеситель',
  entities: [
    e('ms-miner-a', 'miner', 0, 0, { mode: 'text', text: 'Жалобы на медленную загрузку сайта.', intervalSec: 0 }),
    e('ms-belt-a1', 'belt', 2, 0),
    e('ms-manip-a1', 'manipulator', 3, 0),
    e('ms-asm-a', 'assembler', 4, 0, { recipe: 'summarizer', modules: [] }),
    e('ms-belt-a2', 'belt', 6, 0),
    e('ms-manip-a2', 'manipulator', 7, 0),

    e('ms-miner-b', 'miner', 0, 3, { mode: 'text', text: 'Хвалят скорость поддержки и вежливость.', intervalSec: 0 }),
    e('ms-belt-b1', 'belt', 2, 3),
    e('ms-manip-b1', 'manipulator', 3, 3),
    e('ms-asm-b', 'assembler', 4, 3, { recipe: 'summarizer', modules: [] }),
    e('ms-belt-b2', 'belt', 6, 3),
    eDir('ms-belt-b2b', 'belt', 7, 3, 0),
    eDir('ms-belt-b3', 'belt', 7, 2, 0),
    e('ms-manip-b2', 'manipulator', 7, 1),

    e('ms-mixer', 'mixer', 8, 0, { mode: 'llm', prompt: 'Объедини версии в один отчёт для менеджера.' }),
    e('ms-belt-out', 'belt', 11, 1),
    e('ms-manip-out', 'manipulator', 12, 1),
    e('ms-silo', 'silo', 13, 1),
  ],
};

/** Библиотека пресетов — read-only, показывается отдельным разделом в BlueprintPanel. */
export const LIBRARY_BLUEPRINTS: Blueprint[] = [
  processingCell,
  duplicatorBranch,
  mixerJoin,
  summarizerLine,
  furnaceBuffer,
  reviewAlertLine,
  multiSourceMixer,
];

export function findLibraryBlueprint(id: string): Blueprint | undefined {
  return LIBRARY_BLUEPRINTS.find((bp) => bp.id === id);
}
