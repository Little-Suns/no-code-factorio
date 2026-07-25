// Проверка библиотеки готовых чертежей (blueprintLibrary.ts): каждый пресет должен
// (1) без ошибок раунд-триппиться через instantiateBlueprint/canPlaceBlueprint —
//     на пустой карте и без коллизий внутри себя;
// (2) реально собирать РОВНО ожидаемое число живых edges через buildGraph — не просто
//     ">0" (это можно случайно удовлетворить одной работающей связью в углу чертежа,
//     пока остальная часть пресета разорвана) — и все НЕ-belt сущности пресета должны
//     лежать в одной компоненте связности этих edges (иначе часть станков пресета
//     физически недостижима друг от друга, хоть какой-то edge где-то и нашёлся).
//
// ВАЖНО про инвариант manipulator: buildGraph (core/graph.ts) по построению никогда не
// возвращает live edge (to !== null) между двумя НЕ-manipulator станками — trace()
// коннектит только когда fromManipulator ИЛИ target.kind === 'manipulator'. Поэтому
// проверка «каждый live edge касается manipulator» была бы тавтологией: она всегда
// истинна для ЛЮБОГО набора сущностей независимо от того, правильно ли расставлен
// конкретный пресет — это свойство graph.ts, а не пресета. Единственный способ реально
// проверить геометрию КОНКРЕТНОГО пресета — точное число edges + связность, что и делает
// этот файл (было доказано ревью: сдвиг одной ленты в lib-mixer-join, разрывающий пресет
// на 2 несвязанные половины, раньше проходил этот чек с exit 0).

import { instantiateBlueprint, canPlaceBlueprint } from '../blueprint';
import { LIBRARY_BLUEPRINTS } from '../blueprintLibrary';
import { buildGraph } from '../graph';
import { Entity } from '../types';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    throw new Error(`Assert failed: ${msg}`);
  }
}

console.log('Testing blueprintLibrary...');

// Точное число live edges на пресет — посчитано вручную по геометрии каждого пресета
// (см. blueprintLibrary.ts), а не подсмотрено в консоли: любое изменение расстановки
// (сдвиг тайла, потеря манипулятора, лишняя/недостающая линия) обязано сломать этот
// тест, а не молча пройти на ">0".
const EXPECTED_LIVE_EDGES: Record<string, number> = {
  'lib-processing-cell': 2, // miner->manip, manip->assembler
  'lib-splitter-branch': 4, // splitter->manip(true/false), manip->chest ×2
  'lib-mixer-join': 4, // manip(top/bottom)->mixer, mixer->manip(out), manip->chest
  'lib-summarizer-line': 4, // miner->manip, manip->assembler, assembler->manip, manip->silo
  'lib-furnace-buffer': 3, // manip->furnace, furnace->manip, manip->chest
};

assert(LIBRARY_BLUEPRINTS.length >= 3, 'library: минимум 3 пресета');
assert(
  LIBRARY_BLUEPRINTS.every((bp) => bp.id in EXPECTED_LIVE_EDGES),
  'library: для каждого пресета в LIBRARY_BLUEPRINTS задано ожидаемое число edges в EXPECTED_LIVE_EDGES'
);

const seenIds = new Set<string>();
for (const bp of LIBRARY_BLUEPRINTS) {
  assert(!seenIds.has(bp.id), `library: id чертежа уникален (${bp.id})`);
  seenIds.add(bp.id);
  assert(bp.name.length > 0, `library: у чертежа "${bp.id}" есть имя`);
  assert(bp.entities.length > 0, `library: чертёж "${bp.id}" не пуст`);

  // Раунд-трип на пустой карте, дважды подряд (разные origin) — коллизий быть не должно,
  // id должны каждый раз перевыпускаться.
  const placedA = instantiateBlueprint(bp, { x: 100, y: 100 });
  assert(canPlaceBlueprint({}, placedA), `library: "${bp.name}" ставится на пустую карту без коллизий`);

  const placedB = instantiateBlueprint(bp, { x: 200, y: 200 });
  assert(
    placedA.every((a) => placedB.every((b) => a.id !== b.id)),
    `library: "${bp.name}" — повторная постановка не переиспользует id`
  );

  const world: Record<string, Entity> = {};
  for (const ent of placedA) world[ent.id] = ent;
  assert(Object.keys(world).length === placedA.length, `library: "${bp.name}" — все id в мире уникальны`);

  // Наложить второй экземпляр того же чертежа поверх первого — должно быть отклонено
  // (тайлы заняты), т.е. canPlaceBlueprint реально видит занятость, а не всегда true.
  const overlapping = instantiateBlueprint(bp, { x: 100, y: 100 });
  assert(!canPlaceBlueprint(world, overlapping), `library: "${bp.name}" — наложение на себя же детектится`);

  // buildGraph: РОВНО ожидаемое число live edges — не ">0". Это ловит и недостающие
  // связи (сломанная геометрия), и лишние (например, случайно продублированную линию).
  const edges = buildGraph(world);
  const liveEdges = edges.filter((edge) => edge.to !== null);
  const expected = EXPECTED_LIVE_EDGES[bp.id];
  assert(
    liveEdges.length === expected,
    `library: "${bp.name}" — ожидалось ${expected} live edges, получено ${liveEdges.length}`
  );

  // Связность: все НЕ-belt сущности пресета (станки + манипуляторы) должны лежать
  // в ОДНОЙ компоненте связности графа live edges (неориентированно) — иначе часть
  // пресета физически изолирована от остальной, даже если где-то есть рабочие edges.
  const stationIds = placedA.filter((ent) => ent.kind !== 'belt').map((ent) => ent.id);
  assert(stationIds.length > 0, `library: "${bp.name}" — есть хотя бы одна не-belt сущность`);

  const adjacency = new Map<string, Set<string>>();
  for (const id of stationIds) adjacency.set(id, new Set());
  for (const edge of liveEdges) {
    if (edge.to === null) continue;
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  }

  const visited = new Set<string>([stationIds[0]]);
  const queue = [stationIds[0]];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of adjacency.get(cur) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  assert(
    visited.size === stationIds.length,
    `library: "${bp.name}" — все станки пресета в одной компоненте связности (достигнуто ${visited.size} из ${stationIds.length})`
  );

  console.log(`✓ "${bp.name}" (${bp.entities.length} entities, ${liveEdges.length} live edges, connected) OK`);
}

console.log('blueprintLibrary checks OK');
