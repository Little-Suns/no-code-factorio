import { Vec, Dir, Entity, Edge, Branch, DELTA } from './types';
import { outPorts, inTiles, buildOccupancy } from './grid';

/**
 * Извлечение графа потока предметов из мира
 * для каждого станка (kind != 'belt'):
 *   для каждого выходного порта:
 *     trace(tile) → { to, path }
 *     если path непуст или to найден → Edge
 */
export function buildGraph(entities: Record<string, Entity>): Edge[] {
  const occupancy = buildOccupancy(entities);
  const edges: Edge[] = [];

  // Для подсчёта порядкового номера edges по branch
  const branchCount: Record<string, number> = {};

  for (const entity of Object.values(entities)) {
    // Игнорируем ленты и аккумуляторы (энергослой вне графа лент)
    if (entity.kind === 'belt' || entity.kind === 'accumulator') {
      continue;
    }

    // Для каждого выходного порта
    const ports = outPorts(entity);
    for (const port of ports) {
      const traceResult = trace(port.tile, entities, occupancy);

      // Edge создаётся только если path непуст ИЛИ to найден
      if (traceResult.path.length > 0 || traceResult.to !== null) {
        // Подсчитываем порядковый номер для этого branch
        const key = `${entity.id}:${port.branch}`;
        const n = (branchCount[key] ?? 0);
        branchCount[key] = n + 1;

        const edge: Edge = {
          id: `${entity.id}:${port.branch}:${n}`,
          from: entity.id,
          branch: port.branch,
          to: traceResult.to,
          path: traceResult.path,
        };
        edges.push(edge);
      }
    }
  }

  return edges;
}

interface TraceResult {
  to: string | null;
  path: Vec[];
}

/**
 * Трассирует путь от стартового тайла по лентам
 * Возвращает конечный станок (если он есть и принимает вход) и путь
 */
function trace(start: Vec, entities: Record<string, Entity>, occupancy: Map<string, string>): TraceResult {
  const path: Vec[] = [];
  const visited = new Set<string>();
  let cur = start;
  const MAX_PATH = 500;

  // Трассировка по лентам
  while (true) {
    const key = `${cur.x},${cur.y}`;

    // Если уже посетили этот тайл — кольцо
    if (visited.has(key)) {
      break;
    }

    // Если достигли максимальной длины пути
    if (path.length >= MAX_PATH) {
      break;
    }

    // Посмотрим что на этом тайле
    const entityIdAtTile = occupancy.get(key);

    if (!entityIdAtTile) {
      // Нет ничего — конец трассы
      break;
    }

    const entityAtTile = entities[entityIdAtTile];
    if (!entityAtTile) {
      break;
    }

    if (entityAtTile.kind !== 'belt') {
      // Дошли до станка — проверяем входит ли тайл в его inTiles
      const targetInTiles = inTiles(entityAtTile);
      if (targetInTiles.has(key)) {
        return { to: entityAtTile.id, path };
      } else {
        // Станок не принимает вход на этом тайле — тупик
        return { to: null, path };
      }
    }

    // На этом тайле лента
    path.push({ x: cur.x, y: cur.y });
    visited.add(key);

    // Двигаемся дальше по направлению ленты
    const delta = DELTA[entityAtTile.dir];
    cur = { x: cur.x + delta.x, y: cur.y + delta.y };
  }

  // Больше лент нет
  return { to: null, path };
}
