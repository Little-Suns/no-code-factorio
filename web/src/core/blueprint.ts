/**
 * Чертежи (E4, усиление): сохранить кусок фабрики, переиспользовать, поделиться строкой.
 * Чистый TS — без pixi/react/zustand (docs/01). Сериализация хранит позиции
 * ОТНОСИТЕЛЬНО bounding box (левый верхний угол занятых тайлов приведён к (0,0)),
 * чтобы чертёж можно было поставить в любом месте карты — `instantiateBlueprint`
 * добавляет origin и выдаёт свежие id (как и остальной код — crypto.randomUUID).
 */

import { Entity, Vec, MachineKind } from './types';
import { footprintTiles, buildOccupancy } from './grid';

export interface Blueprint {
  id: string;
  name: string;
  entities: Entity[]; // pos относительно bounding box, id/kind/dir/config — как в мире
}

/**
 * Сериализует выделенные сущности в чертёж. Границы считаем по footprintTiles,
 * а не по entity.pos — иначе повёрнутые станки (dir=1/3, footprint w/h местами)
 * сдвинули бы bounding box неверно.
 */
export function serializeBlueprint(entities: Entity[], name: string): Blueprint {
  if (entities.length === 0) {
    throw new Error('blueprint: пустой набор сущностей');
  }

  const allTiles = entities.flatMap((e) => footprintTiles(e));
  const minX = Math.min(...allTiles.map((t) => t.x));
  const minY = Math.min(...allTiles.map((t) => t.y));

  return {
    id: crypto.randomUUID().slice(0, 8),
    name,
    entities: entities.map((e) => ({
      ...e,
      pos: { x: e.pos.x - minX, y: e.pos.y - minY },
    })),
  };
}

/**
 * Ставит чертёж в мир: origin — левый верхний угол bounding box в мировых
 * координатах (тайл под курсором). Свежие id на каждую сущность — иначе
 * повторная постановка того же чертежа схлопнула бы id-коллизией.
 */
export function instantiateBlueprint(blueprint: Blueprint, origin: Vec): Entity[] {
  return blueprint.entities.map((e) => ({
    ...e,
    id: crypto.randomUUID().slice(0, 8),
    pos: { x: origin.x + e.pos.x, y: origin.y + e.pos.y },
  }));
}

/**
 * Можно ли поставить уже инстанцированный чертёж в текущий мир: все footprint-тайлы
 * каждой сущности должны быть свободны. Дополнительно проверяем, что сущности
 * чертежа не накладываются друг на друга — при обычном сохранении так не бывает
 * (мир и так не допускал коллизий), но импортированная строка — внешние данные
 * (может быть отредактирована руками), доверять ей нельзя.
 */
export function canPlaceBlueprint(entities: Record<string, Entity>, instantiated: Entity[]): boolean {
  const occupancy = buildOccupancy(entities);
  const seen = new Set<string>();
  for (const entity of instantiated) {
    for (const tile of footprintTiles(entity)) {
      const key = `${tile.x},${tile.y}`;
      if (occupancy.has(key) || seen.has(key)) return false;
      seen.add(key);
    }
  }
  return true;
}

// base64 через TextEncoder/TextDecoder — обычный btoa/atob портит не-ASCII
// (имя чертежа и текстовые конфиги станков — кириллица).
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function exportBlueprintString(blueprint: Blueprint): string {
  return utf8ToBase64(JSON.stringify(blueprint));
}

const VALID_KINDS = new Set<MachineKind>([
  'belt', 'miner', 'assembler', 'splitter', 'mixer', 'silo', 'telegram',
  'furnace', 'chest', 'lab', 'accumulator',
]);

function isValidEntityShape(e: unknown): e is Entity {
  if (!e || typeof e !== 'object') return false;
  const entity = e as Record<string, unknown>;
  const pos = entity.pos as Record<string, unknown> | undefined;
  return (
    typeof entity.id === 'string' &&
    typeof entity.kind === 'string' &&
    VALID_KINDS.has(entity.kind as MachineKind) &&
    !!pos && typeof pos.x === 'number' && typeof pos.y === 'number' &&
    [0, 1, 2, 3].includes(entity.dir as number) &&
    typeof entity.config === 'object' && entity.config !== null
  );
}

/**
 * Импорт строки — внешние данные (пользователь мог отредактировать вручную),
 * поэтому валидируем форму целиком, а не только JSON.parse. Свежий id чертежа —
 * иначе повторный импорт той же строки схлопнулся бы коллизией в store.blueprints.
 */
export function importBlueprintString(s: string): Blueprint {
  let parsed: unknown;
  try {
    parsed = JSON.parse(base64ToUtf8(s));
  } catch {
    throw new Error('blueprint: некорректная строка импорта');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('blueprint: некорректный формат');
  }
  const candidate = parsed as Partial<Blueprint>;
  if (
    typeof candidate.name !== 'string' ||
    !Array.isArray(candidate.entities) ||
    candidate.entities.length === 0 ||
    !candidate.entities.every(isValidEntityShape)
  ) {
    throw new Error('blueprint: некорректный формат');
  }

  return {
    id: crypto.randomUUID().slice(0, 8),
    name: candidate.name,
    entities: candidate.entities,
  };
}
