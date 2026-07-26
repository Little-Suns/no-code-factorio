// Проверка уровней/челленджей: границы computeStars + evaluate() каждого уровня на
// сфабрикованных LevelResults (без Engine/браузера — core/levels/* чистый TS).

import { LEVELS, isLevelUnlocked } from '../levels/definitions';
import { computeStars } from '../levels/stars';
import { Level, LevelResults } from '../levels/types';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    throw new Error(`Assert failed: ${msg}`);
  }
}

console.log('Testing levels...');

function findLevel(id: string): Level {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`level not found: ${id}`);
  return level;
}

// --- computeStars: границы ---
{
  const level = findLevel('delivery'); // parEntities: 6, goodEntities: 9
  assert(computeStars(level, 1) === 3, 'stars: меньше par → 3');
  assert(computeStars(level, 6) === 3, 'stars: ровно par → 3');
  assert(computeStars(level, 9) === 2, 'stars: ровно good → 2');
  assert(computeStars(level, 10) === 1, 'stars: больше good → 1');
}

// --- LEVELS: базовая форма ---
assert(LEVELS.length === 6, 'levels: ровно 6 уровней');
assert(new Set(LEVELS.map((l) => l.id)).size === LEVELS.length, 'levels: id уникальны');
assert(LEVELS.filter((l) => l.bonus).length === 1, 'levels: ровно один бонусный уровень');
assert(LEVELS[LEVELS.length - 1].bonus === true, 'levels: бонусный уровень последний');
for (const level of LEVELS) {
  assert(level.hintKeys.length >= 2, `levels: у ${level.id} минимум 2 подсказки`);
  assert(level.parEntities < level.goodEntities, `levels: у ${level.id} parEntities < goodEntities`);
}

// --- delivery: любой непустой результат ---
{
  const level = findLevel('delivery');
  assert(level.evaluate({}) === false, 'delivery: пустые results → false');
  assert(level.evaluate({ n1: [{ at: 1, data: 'hi' }] }) === true, 'delivery: есть запись → true');
}

// --- uppercase: капс, только буквы засчитываются ---
{
  const level = findLevel('uppercase');
  assert(level.evaluate({ n1: [{ at: 1, data: 'hello world' }] }) === false, 'uppercase: строчные → false');
  assert(level.evaluate({ n1: [{ at: 1, data: '12345' }] }) === false, 'uppercase: без букв → false');
  assert(level.evaluate({ n1: [{ at: 1, data: 'HELLO WORLD' }] }) === true, 'uppercase: капс → true');
}

// --- duplicator: два разных nodeId с идентичными данными ---
{
  const level = findLevel('duplicator');
  const single: LevelResults = { n1: [{ at: 1, data: 'x' }] };
  assert(level.evaluate(single) === false, 'duplicator: один узел → false');
  const different: LevelResults = { n1: [{ at: 1, data: 'a' }], n2: [{ at: 2, data: 'b' }] };
  assert(level.evaluate(different) === false, 'duplicator: разные данные → false');
  const duped: LevelResults = { n1: [{ at: 1, data: 'x' }], n2: [{ at: 2, data: 'x' }] };
  assert(level.evaluate(duped) === true, 'duplicator: одинаковые данные в разных узлах → true');
}

// --- batch: chest flush ровно на batchSize ---
{
  const level = findLevel('batch');
  const buffering: LevelResults = { chest1: [{ at: 1, data: { buffered: 2, batchSize: 3, items: ['a', 'b'] } }] };
  assert(level.evaluate(buffering) === false, 'batch: недобор → false');
  const flushed: LevelResults = {
    chest1: [{ at: 1, data: { buffered: 3, batchSize: 3, items: ['a', 'b', 'c'], flushed: true } }],
  };
  assert(level.evaluate(flushed) === true, 'batch: flush → true');
}

// --- quality: любой непустой результат (тот же класс допущения, что у delivery) ---
{
  const level = findLevel('quality');
  assert(level.evaluate({}) === false, 'quality: пустые results → false');
  assert(level.evaluate({ n1: [{ at: 1, data: 'ok' }] }) === true, 'quality: есть запись → true');
}

// --- editorial (bonus): нужны ОБА терминала — chest flush и silo-подобный результат ---
{
  const level = findLevel('editorial');
  const onlyChest: LevelResults = {
    chest1: [{ at: 1, data: { buffered: 1, batchSize: 1, items: ['x'], flushed: true } }],
  };
  assert(level.evaluate(onlyChest) === false, 'editorial: только chest → false');
  const onlySilo: LevelResults = { silo1: [{ at: 1, data: 'article' }] };
  assert(level.evaluate(onlySilo) === false, 'editorial: только silo → false');
  const both: LevelResults = {
    chest1: [{ at: 1, data: { buffered: 1, batchSize: 1, items: ['x'], flushed: true } }],
    silo1: [{ at: 2, data: 'article' }],
  };
  assert(level.evaluate(both) === true, 'editorial: chest + silo → true');
}

// --- isLevelUnlocked: 5 обычных уровней доступны всегда, bonus — только когда все пройдены ---
{
  const coreLevels = LEVELS.filter((l) => !l.bonus);
  const bonusLevel = LEVELS.find((l) => l.bonus)!;
  assert(coreLevels.length === 5, 'unlock: ровно 5 обычных уровней');

  assert(
    coreLevels.every((l) => isLevelUnlocked(l, {})),
    'unlock: все обычные уровни доступны без всякого прогресса'
  );
  assert(isLevelUnlocked(bonusLevel, {}) === false, 'unlock: bonus заперт без прогресса');

  const partial: Record<string, { stars: 0 | 1 | 2 | 3 }> = Object.fromEntries(
    coreLevels.slice(0, 4).map((l) => [l.id, { stars: 3 }])
  );
  assert(isLevelUnlocked(bonusLevel, partial) === false, 'unlock: bonus заперт, пока не пройдены ВСЕ 5');

  const allDone: Record<string, { stars: 0 | 1 | 2 | 3 }> = Object.fromEntries(
    coreLevels.map((l) => [l.id, { stars: 1 }])
  );
  assert(isLevelUnlocked(bonusLevel, allDone) === true, 'unlock: bonus открыт, когда пройдены все 5 (даже на 1 звезду)');
}

console.log('✓ levels OK');
