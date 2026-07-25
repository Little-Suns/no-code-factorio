import { buildGraph } from '../graph';
import { Entity } from '../types';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    throw new Error(`Assert failed: ${msg}`);
  }
}

console.log('Testing manipulator intake (mid-line belt grab)...');

// Test 1: манипулятор стоит рядом с MID-LINE тайлом длинного конвейера (не с концом
// ленты) — должен забрать предмет прямо там, а не оставаться без связи. Регрессия
// бага "манипулятор у не конечного конвейера не может захватить предмет".
// Дальше по ленте (после точки захвата) стоит ещё один манипулятор M2 у самого конца
// конвейера — он НЕ должен получить те же предметы (одна трасса — один edge, второй
// раз тот же поток не клонируется/не задваивается).
console.log('Test 1: manipulator grabs from a mid-line belt tile, not just the terminal one');
{
  const mixer: Entity = {
    id: 'mixer1',
    kind: 'mixer',
    pos: { x: 300, y: 300 },
    dir: 0,
    config: {},
  };

  // Длинный конвейер вверх от FRONT-порта mixer (301, 299) до (301, 290) — 10 лент
  const beltEntities: Record<string, Entity> = {};
  for (let y = 299; y >= 290; y--) {
    const id = `belt_${y}`;
    beltEntities[id] = {
      id,
      kind: 'belt',
      pos: { x: 301, y },
      dir: 0,
      config: {},
    };
  }

  // M1 захватывает MID-LINE тайл (301, 294) — 6-й тайл ленты считая от порта mixer,
  // конвейер продолжается ещё 4 тайла дальше (293..290) уже без M1.
  const manip1: Entity = {
    id: 'manip1',
    kind: 'manipulator',
    pos: { x: 302, y: 294 },
    dir: 1, // FRONT смотрит на восток; BACK (запад) = (301, 294) — тайл ленты
    config: {},
  };

  // M2 стоит у САМОГО КОНЦА конвейера (терминальный тайл 301, 290) — не должен
  // получить те же предметы, т.к. единственная трасса от mixer уже "съедена" M1.
  const manip2: Entity = {
    id: 'manip2',
    kind: 'manipulator',
    pos: { x: 301, y: 289 },
    dir: 0, // FRONT смотрит на север; BACK (юг) = (301, 290) — последний тайл ленты
    config: {},
  };

  const entities: Record<string, Entity> = {
    mixer1: mixer,
    manip1,
    manip2,
    ...beltEntities,
  };

  const edges = buildGraph(entities);

  const mixerEdges = edges.filter((e) => e.from === 'mixer1');
  assert(mixerEdges.length === 1, `Expected 1 edge from mixer1, got ${mixerEdges.length}`);
  const mixerEdge = mixerEdges[0];
  assert(mixerEdge.to === 'manip1', `Mixer edge should reach manip1 (mid-line grab), got ${mixerEdge.to}`);
  assert(
    mixerEdge.path.length === 6,
    `Mixer→manip1 path should cover 6 belt tiles (299..294), got ${mixerEdge.path.length}`
  );
  const lastTile = mixerEdge.path[mixerEdge.path.length - 1];
  assert(
    lastTile.x === 301 && lastTile.y === 294,
    `Path should end at the tapped tile (301,294), got (${lastTile.x},${lastTile.y})`
  );

  // M2 не должен получить вход от mixer — поток уже перехвачен M1 выше по ленте
  const edgesToManip2 = edges.filter((e) => e.to === 'manip2');
  assert(
    edgesToManip2.length === 0,
    `manip2 (past the tap point) must not receive the same flow twice, got ${edgesToManip2.length} edges`
  );

  // Собственный выход M1 (FRONT, восток от (302,294) → (303,294)) — порт в пустоту:
  // ни ленты, ни станка — edge вообще не создаётся (как в Test 6 graph.ts)
  const manip1Edges = edges.filter((e) => e.from === 'manip1');
  assert(manip1Edges.length === 0, `manip1 output port is empty, expected 0 edges, got ${manip1Edges.length}`);

  // Контрольный кейс: тот же мир, но БЕЗ M1 (тапающего манипулятора) — теперь M2
  // у терминального тайла обязан получить edge нормально. Это доказывает, что
  // "M2 получил 0 edges" выше в основном сценарии — следствие перехвата потока M1,
  // а не того, что M2 в принципе не может быть достижим/некорректно расставлен.
  const { manip1: _drop, ...withoutManip1 } = entities;
  const controlEdges = buildGraph(withoutManip1);
  const controlManiper2Edges = controlEdges.filter((e) => e.to === 'manip2');
  assert(
    controlManiper2Edges.length === 1,
    `Control (no M1): manip2 should receive the edge normally, got ${controlManiper2Edges.length}`
  );
  assert(
    controlManiper2Edges[0].path.length === 10,
    `Control (no M1): mixer→manip2 path should cover all 10 belt tiles, got ${controlManiper2Edges[0].path.length}`
  );
}
console.log('✓ Test 1 OK');

// Test 2 (регрессия): манипулятор у КОНЦА конвейера (терминальный тайл) — как и раньше,
// подхватывает предмет корректно.
console.log('Test 2: manipulator still grabs from the terminal belt tile (regression)');
{
  const miner: Entity = {
    id: 'miner_term',
    kind: 'miner',
    pos: { x: 400, y: 400 },
    dir: 0,
    config: {},
  };

  // 3 ленты вверх от одного из FRONT-портов (400, 399)
  const belt1: Entity = { id: 'bt1', kind: 'belt', pos: { x: 400, y: 399 }, dir: 0, config: {} };
  const belt2: Entity = { id: 'bt2', kind: 'belt', pos: { x: 400, y: 398 }, dir: 0, config: {} };
  const belt3: Entity = { id: 'bt3', kind: 'belt', pos: { x: 400, y: 397 }, dir: 0, config: {} };

  // Манипулятор ровно на пути ленты (терминальный тайл, впритык)
  const manipulator: Entity = {
    id: 'manip_term',
    kind: 'manipulator',
    pos: { x: 400, y: 396 },
    dir: 0,
    config: {},
  };

  const entities: Record<string, Entity> = {
    miner_term: miner,
    bt1: belt1,
    bt2: belt2,
    bt3: belt3,
    manip_term: manipulator,
  };

  const edges = buildGraph(entities);
  const minerEdges = edges.filter((e) => e.from === 'miner_term' && e.to === 'manip_term');
  assert(minerEdges.length === 1, `Expected 1 edge from miner_term to manip_term, got ${minerEdges.length}`);
  assert(
    minerEdges[0].path.length === 3,
    `Terminal path should have 3 belt tiles, got ${minerEdges[0].path.length}`
  );
}
console.log('✓ Test 2 OK');

// Test 3 (регрессия найденного ревью блокера): лента упирается ПРЯМО в манипулятор
// M1 (классический терминальный случай) + второй манипулятор M2 тапает ТОТ ЖЕ
// терминальный тайл сбоку. M1 должен получить edge (терминал в приоритете), а НЕ M2 —
// и это должно быть верно НЕЗАВИСИМО от того, в каком порядке M1/M2 вставлены в
// entities record (иначе результат зависел бы от Object.values-порядка — сам баг).
console.log('Test 3: terminal manipulator wins over a side-tapping neighbour, order-independent');
{
  const buildWorld = (order: 'm1-first' | 'm2-first'): Record<string, Entity> => {
    const miner: Entity = { id: 'miner_t3', kind: 'miner', pos: { x: 500, y: 500 }, dir: 0, config: {} };
    const belt1: Entity = { id: 'bt3_1', kind: 'belt', pos: { x: 500, y: 499 }, dir: 0, config: {} };
    const belt2: Entity = { id: 'bt3_2', kind: 'belt', pos: { x: 500, y: 498 }, dir: 0, config: {} };
    // Последний тайл ленты (500, 497), dir=0 → указывает прямо на (500, 496)
    const belt3: Entity = { id: 'bt3_3', kind: 'belt', pos: { x: 500, y: 497 }, dir: 0, config: {} };

    // M1 — терминальный манипулятор, ровно на пути ленты: (500, 496)
    const m1: Entity = { id: 'manip_t3_1', kind: 'manipulator', pos: { x: 500, y: 496 }, dir: 0, config: {} };
    // Тапающий манипулятор — тапает ТОТ ЖЕ тайл (500, 497) сбоку, с востока:
    // pos=(501,497), dir=1 (E); intake = (501,497) - DELTA[1] = (500, 497) —
    // совпадает с BACK-тайлом M1. Id ("aaa_tap_t3") НАРОЧНО выбран лексикографически
    // МЕНЬШЕ id терминального манипулятора ("manip_t3_1") — иначе тай-брейк по
    // наименьшему id в manipulatorIntake сам по себе выбирал бы терминал, и тест
    // проходил бы даже без реальной проверки forwardIsManipulatorTerminal (это и был
    // ревью-баг: с исходными id "manip_t3_1" < "manip_t3_2" тест был mutation-escape —
    // проходил, даже если приоритет терминала из trace() вырезать целиком).
    const tapper: Entity = { id: 'aaa_tap_t3', kind: 'manipulator', pos: { x: 501, y: 497 }, dir: 1, config: {} };

    const belts = { bt3_1: belt1, bt3_2: belt2, bt3_3: belt3 };
    if (order === 'm1-first') {
      return { miner_t3: miner, manip_t3_1: m1, aaa_tap_t3: tapper, ...belts };
    }
    return { miner_t3: miner, aaa_tap_t3: tapper, manip_t3_1: m1, ...belts };
  };

  for (const order of ['m1-first', 'm2-first'] as const) {
    const edges = buildGraph(buildWorld(order));
    const minerEdges = edges.filter((e) => e.from === 'miner_t3');
    assert(minerEdges.length === 1, `[${order}] Expected 1 edge from miner_t3, got ${minerEdges.length}`);
    assert(
      minerEdges[0].to === 'manip_t3_1',
      `[${order}] Terminal manipulator (manip_t3_1) should win over the side-tapping neighbour ` +
        `(aaa_tap_t3, whose id sorts LOWER — so a plain id tie-break would wrongly pick it), got ${minerEdges[0].to}`
    );
    assert(
      minerEdges[0].path.length === 3,
      `[${order}] Terminal path should have 3 belt tiles, got ${minerEdges[0].path.length}`
    );
  }
}
console.log('✓ Test 3 OK');

// Test 4: два манипулятора ЛЕГАЛЬНО делят один и тот же intake-тайл ПОСЕРЕДИНЕ
// ленты (ни один из них не является "прямым терминалом" — тап решается только
// картой manipulatorIntake). Победитель должен определяться детерминированно
// (по id), а не порядком вставки в entities record.
console.log('Test 4: two manipulators sharing one mid-line intake tile resolve deterministically');
{
  const buildWorld = (order: 'a-first' | 'b-first'): Record<string, Entity> => {
    // Лента слева направо, x=600..605, y=600 — тайл (602,600) не является ни первым,
    // ни последним, и forward-тайл (603,600) — тоже лента, не манипулятор.
    const belts: Record<string, Entity> = {};
    for (let x = 600; x <= 605; x++) {
      const id = `bt4_${x}`;
      belts[id] = { id, kind: 'belt', pos: { x, y: 600 }, dir: 1, config: {} };
    }
    // Источник потока — mixer, чей центральный FRONT-порт (dir=0: pos+(1,-1))
    // совпадает с первым тайлом ленты (600,600) → pos = (599, 601).
    const mixer: Entity = { id: 'mixer4', kind: 'mixer', pos: { x: 599, y: 601 }, dir: 0, config: {} };

    // intake = pos - DELTA[dir]. manipA — тапает (602,600) с севера: dir=0 (FRONT
    // смотрит на север), DELTA[0]=(0,-1) → pos = (602,600)+(0,-1) = (602,599)
    const manipA: Entity = { id: 'aaa_manip', kind: 'manipulator', pos: { x: 602, y: 599 }, dir: 0, config: {} };
    // manipB — тапает тот же тайл с юга: dir=2 (FRONT на юг), DELTA[2]=(0,1) →
    // pos = (602,600)+(0,1) = (602,601)
    const manipB: Entity = { id: 'bbb_manip', kind: 'manipulator', pos: { x: 602, y: 601 }, dir: 2, config: {} };

    if (order === 'a-first') {
      return { mixer4: mixer, aaa_manip: manipA, bbb_manip: manipB, ...belts };
    }
    return { mixer4: mixer, bbb_manip: manipB, aaa_manip: manipA, ...belts };
  };

  for (const order of ['a-first', 'b-first'] as const) {
    const edges = buildGraph(buildWorld(order));
    const mixerEdges = edges.filter((e) => e.from === 'mixer4');
    assert(mixerEdges.length === 1, `[${order}] Expected 1 edge from mixer4, got ${mixerEdges.length}`);
    // "aaa_manip" < "bbb_manip" лексикографически — должен побеждать всегда,
    // независимо от порядка вставки в entities record.
    assert(
      mixerEdges[0].to === 'aaa_manip',
      `[${order}] Deterministic winner should be aaa_manip (lowest id), got ${mixerEdges[0].to}`
    );
  }
}
console.log('✓ Test 4 OK');

// Test 5: intake-тайл манипулятора попадает на "чужой" станок или пустую клетку
// (не на ленту) — trace() не должен ни падать, ни создавать фантомный edge:
// тап-проверка срабатывает только внутри ветки "на этом тайле лента".
console.log('Test 5: manipulator intake tile landing on a non-belt tile or empty ground is a graceful no-op');
{
  // 5a: intake манипулятора указывает в пустоту — нет ни ленты, ни станка
  const lonelyManip: Entity = {
    id: 'manip_lonely',
    kind: 'manipulator',
    pos: { x: 700, y: 700 },
    dir: 0, // BACK (intake) = (700, 701) — пустой тайл
    config: {},
  };
  const edgesLonely = buildGraph({ manip_lonely: lonelyManip });
  assert(edgesLonely.length === 0, `Lonely manipulator with empty intake should yield 0 edges, got ${edgesLonely.length}`);

  // 5b: intake манипулятора геометрически совпадает с тайлом furnace, но это её
  // ВХОДНОЙ (BACK) тайл, а не выходной порт — значит ни одна трасса и так никогда
  // естественным путём туда не придёт; manipulatorIntake для этого ключа должен
  // просто никогда не быть востребован (тап-проверка живёт только внутри ветки
  // "на этом тайле лента"), без падения graph.ts и без фантомных edges.
  const furnace: Entity = { id: 'furnace_t5', kind: 'furnace', pos: { x: 710, y: 710 }, dir: 0, config: {} };
  // furnace 2x2 занимает (710,710)-(711,711), BACK-ряд (вход) — y=711.
  const manipOnFurnace: Entity = {
    id: 'manip_on_furnace',
    kind: 'manipulator',
    pos: { x: 710, y: 712 },
    dir: 2, // FRONT на юг (710,713, пусто); BACK (intake) = (710,712)-(0,1) = (710,711) — вход furnace
    config: {},
  };
  const edgesFurnace = buildGraph({ furnace_t5: furnace, manip_on_furnace: manipOnFurnace });
  const toManipOnFurnace = edgesFurnace.filter((e) => e.to === 'manip_on_furnace');
  assert(
    toManipOnFurnace.length === 0,
    `manip_on_furnace intake overlaps furnace's own BACK tile (not a belt), expected 0 edges, got ${toManipOnFurnace.length}`
  );
  const furnaceEdges = edgesFurnace.filter((e) => e.from === 'furnace_t5');
  assert(
    furnaceEdges.length === 0,
    `furnace_t5 output ports are empty in this world, expected 0 edges, got ${furnaceEdges.length}`
  );
}
console.log('✓ Test 5 OK');

console.log('manipulator-intake checks OK');
