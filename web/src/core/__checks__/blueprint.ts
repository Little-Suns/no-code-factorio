import {
  serializeBlueprint,
  instantiateBlueprint,
  canPlaceBlueprint,
  exportBlueprintString,
  importBlueprintString,
} from '../blueprint';
import { Entity } from '../types';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    throw new Error(`Assert failed: ${msg}`);
  }
}

console.log('Testing blueprint...');

// Две сущности, не у начала координат: miner (2x2) в (5,5) + belt в (5,7)
const source: Entity[] = [
  { id: 'm1', kind: 'miner', pos: { x: 5, y: 5 }, dir: 0, config: { text: 'hi' } },
  { id: 'b1', kind: 'belt', pos: { x: 5, y: 7 }, dir: 2, config: {} },
];

// serializeBlueprint нормализует к bounding box (0,0)
const bp = serializeBlueprint(source, 'Тест-чертёж');
assert(bp.name === 'Тест-чертёж', 'serialize: имя сохранено');
assert(bp.entities.length === 2, 'serialize: обе сущности на месте');
const minerRel = bp.entities.find((e) => e.kind === 'miner')!;
const beltRel = bp.entities.find((e) => e.kind === 'belt')!;
assert(minerRel.pos.x === 0 && minerRel.pos.y === 0, 'serialize: miner сдвинут к (0,0)');
assert(beltRel.pos.x === 0 && beltRel.pos.y === 2, 'serialize: belt относительно miner на (0,2)');
console.log('✓ serializeBlueprint normalizes to bounding box OK');

// instantiateBlueprint: origin (10,10) → абсолютные позиции = origin + relative
const placed = instantiateBlueprint(bp, { x: 10, y: 10 });
const minerAbs = placed.find((e) => e.kind === 'miner')!;
const beltAbs = placed.find((e) => e.kind === 'belt')!;
assert(minerAbs.pos.x === 10 && minerAbs.pos.y === 10, 'instantiate: miner на origin');
assert(beltAbs.pos.x === 10 && beltAbs.pos.y === 12, 'instantiate: belt на origin+relative');
assert(minerAbs.dir === 0 && beltAbs.dir === 2, 'instantiate: dir сохранён');
assert(minerAbs.id !== 'm1' && beltAbs.id !== 'b1', 'instantiate: id перевыпущены, не исходные');
assert(minerAbs.id !== beltAbs.id, 'instantiate: id уникальны между собой');

// Повторная постановка того же чертежа — новые id, не коллизия с первой
const placedAgain = instantiateBlueprint(bp, { x: 20, y: 20 });
assert(
  placedAgain.every((e) => !placed.some((p) => p.id === e.id)),
  'instantiate: повторная постановка не переиспользует id'
);
console.log('✓ instantiateBlueprint places at origin with fresh ids OK');

// canPlaceBlueprint: коллизия с занятым тайлом
const world: Record<string, Entity> = {
  blocker: { id: 'blocker', kind: 'chest', pos: { x: 10, y: 10 }, dir: 0, config: {} },
};
assert(!canPlaceBlueprint(world, placed), 'canPlaceBlueprint: коллизия с существующей сущностью детектится');
assert(canPlaceBlueprint({}, placed), 'canPlaceBlueprint: на пустой карте — свободно');
console.log('✓ canPlaceBlueprint collision detection OK');

// Export/import round-trip: имя и сущности идентичны, id чертежа новый (не совпадает при повторном импорте)
const exported = exportBlueprintString(bp);
const imported = importBlueprintString(exported);
assert(imported.name === bp.name, 'export/import: имя сохранено');
assert(JSON.stringify(imported.entities) === JSON.stringify(bp.entities), 'export/import: entities идентичны');
const importedAgain = importBlueprintString(exported);
assert(imported.id !== importedAgain.id, 'export/import: каждый импорт даёт новый id чертежа');
console.log('✓ export/import round-trip OK');

// importBlueprintString — защита от битых/чужих данных
let threwOnGarbage = false;
try {
  importBlueprintString('not-valid-base64-json!!!');
} catch {
  threwOnGarbage = true;
}
assert(threwOnGarbage, 'import: мусорная строка должна кинуть ошибку, а не упасть глубже по коду');

let threwOnBadShape = false;
try {
  importBlueprintString(btoa(JSON.stringify({ name: 'x', entities: [{ kind: 'not-a-kind' }] })));
} catch {
  threwOnBadShape = true;
}
assert(threwOnBadShape, 'import: сущность с невалидным kind должна быть отклонена валидацией формы');
console.log('✓ importBlueprintString rejects malformed input OK');

// serializeBlueprint на пустом наборе — явная ошибка, а не тихий пустой чертёж
let threwOnEmpty = false;
try {
  serializeBlueprint([], 'empty');
} catch {
  threwOnEmpty = true;
}
assert(threwOnEmpty, 'serialize: пустой набор сущностей должен быть отклонён');

console.log('blueprint checks OK');
