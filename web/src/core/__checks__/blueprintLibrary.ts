// Проверка библиотеки готовых чертежей (blueprintLibrary.ts): каждый пресет должен
// (1) без ошибок раунд-триппиться через instantiateBlueprint/canPlaceBlueprint —
//     на пустой карте и без коллизий внутри себя;
// (2) реально собирать связный граф через buildGraph — т.е. не просто валидный JSON,
//     а рабочая мини-фабрика, где инвариант «manipulator обязателен для станок↔станок»
//     (docs/03) соблюдён и хотя бы одна станок→станок связь через manipulator есть.

import { instantiateBlueprint, canPlaceBlueprint } from '../blueprint';
import { LIBRARY_BLUEPRINTS } from '../blueprintLibrary';
import { buildGraph } from '../graph';
import { Entity, MachineKind } from '../types';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    throw new Error(`Assert failed: ${msg}`);
  }
}

console.log('Testing blueprintLibrary...');

assert(LIBRARY_BLUEPRINTS.length >= 3, 'library: минимум 3 пресета');

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

  // Внутри одного набора не должно быть самоколлизий (реальная проверка geometрии,
  // а не только формы JSON) — canPlaceBlueprint уже проверяет это внутри instantiated.
  const world: Record<string, Entity> = {};
  for (const ent of placedA) world[ent.id] = ent;
  assert(Object.keys(world).length === placedA.length, `library: "${bp.name}" — все id в мире уникальны`);

  // Наложить второй экземпляр того же чертежа поверх первого — должно быть отклонено
  // (тайлы заняты), т.е. canPlaceBlueprint реально видит занятость, а не всегда true.
  const overlapping = instantiateBlueprint(bp, { x: 100, y: 100 });
  assert(!canPlaceBlueprint(world, overlapping), `library: "${bp.name}" — наложение на себя же детектится`);

  // buildGraph: пресет обязан содержать хотя бы одну реальную связь станок→станок
  // (branch to !== null) через manipulator — иначе это не рабочая мини-фабрика,
  // а просто набор непричастных друг к другу тайлов.
  const edges = buildGraph(world);
  const liveEdges = edges.filter((edge) => edge.to !== null);
  assert(liveEdges.length > 0, `library: "${bp.name}" — buildGraph находит хотя бы одну живую связь`);

  // Манипулятор обязателен для КАЖДОЙ связи станок↔станок в пресете (docs/03): любой
  // Edge, чьи from и to — оба НЕ manipulator, был бы прямым проходом без манипулятора,
  // что buildGraph в принципе не должен уметь произвести (иначе баг в самом graph.ts,
  // не в чертеже) — но явная проверка тут документирует инвариант и защищает пресет
  // от будущих правок, которые случайно уберут промежуточный manipulator.
  const kindOf = (id: string): MachineKind => world[id].kind;
  for (const edge of liveEdges) {
    const fromKind = kindOf(edge.from);
    const toKind = edge.to ? kindOf(edge.to) : null;
    const bridgedByManipulator = fromKind === 'manipulator' || toKind === 'manipulator';
    assert(
      bridgedByManipulator,
      `library: "${bp.name}" — edge ${fromKind}→${toKind} обходит инвариант manipulator`
    );
  }

  console.log(`✓ "${bp.name}" (${bp.entities.length} entities, ${liveEdges.length} live edges) OK`);
}

console.log('blueprintLibrary checks OK');
