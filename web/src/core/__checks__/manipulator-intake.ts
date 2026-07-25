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

console.log('manipulator-intake checks OK');
