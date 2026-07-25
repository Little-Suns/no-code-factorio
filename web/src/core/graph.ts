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
  const manipulatorIntake = buildManipulatorIntakeMap(entities);

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
      const traceResult = trace(
        port.tile,
        entities,
        occupancy,
        entity.kind === 'manipulator',
        manipulatorIntake
      );

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
 * Тайл, с которого манипулятор физически забирает предмет (BACK). При 1×1 footprint
 * сторона BACK — просто соседний тайл в направлении, обратном dir (docs/03: "вход
 * физически принимается с любого соседнего тайла"). Карта нужна trace(), чтобы
 * манипулятор мог захватить предмет из ЛЮБОГО тайла ленты, мимо которого он стоит —
 * а не только из тайла, где лента упирается прямо в него (конечный/терминальный тайл).
 * Без этого манипулятор у не конечного (mid-line) тайла конвейера не видел трассу вообще.
 */
function buildManipulatorIntakeMap(entities: Record<string, Entity>): Map<string, string> {
  const map = new Map<string, string>();
  for (const entity of Object.values(entities)) {
    if (entity.kind !== 'manipulator') continue;
    const delta = DELTA[entity.dir];
    const intake = { x: entity.pos.x - delta.x, y: entity.pos.y - delta.y };
    map.set(`${intake.x},${intake.y}`, entity.id);
  }
  return map;
}

/**
 * Трассирует путь от стартового тайла по лентам
 * Возвращает конечный станок (если он есть и принимает вход) и путь
 *
 * fromManipulator: entity, от чьего порта начата трасса, сам является манипулятором.
 * Манипулятор — обязательный посредник для ЛЮБОЙ передачи между станками (docs/03):
 * прямое соединение станок↔станок (впритык или через одни ленты, без манипулятора
 * между ними) не образует edge — только тупик (если были ленты) либо вообще ничего.
 *
 * manipulatorIntake: карта "тайл ленты" → "манипулятор, который его захватывает сбоку"
 * (см. buildManipulatorIntakeMap). Если трасса проходит через такой тайл — она
 * обрывается там и уходит в манипулятор, даже если лента продолжается дальше:
 * манипулятор "снимает" предмет в этой точке, что для остальных тайлов трассы
 * (до и после) ничего не меняет — они остаются обычными тайлами ленты для других trace().
 */
function trace(
  start: Vec,
  entities: Record<string, Entity>,
  occupancy: Map<string, string>,
  fromManipulator: boolean,
  manipulatorIntake: Map<string, string>
): TraceResult {
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
      if (!targetInTiles.has(key)) {
        // Станок не принимает вход на этом тайле — тупик
        return { to: null, path };
      }
      // Валидное соединение станок↔станок ТОЛЬКО если одна из сторон — манипулятор
      if (fromManipulator || entityAtTile.kind === 'manipulator') {
        return { to: entityAtTile.id, path };
      }
      // Обе стороны — «настоящие» станки без манипулятора между ними: тупик
      return { to: null, path };
    }

    // На этом тайле лента
    path.push({ x: cur.x, y: cur.y });
    visited.add(key);

    // Манипулятор стоит рядом с ЭТИМ тайлом (не обязательно с концом трассы) и
    // забирает предмет прямо здесь — независимо от того, куда лента идёт дальше
    const tappingManipulatorId = manipulatorIntake.get(key);
    if (tappingManipulatorId) {
      return { to: tappingManipulatorId, path };
    }

    // Двигаемся дальше по направлению ленты
    const delta = DELTA[entityAtTile.dir];
    cur = { x: cur.x + delta.x, y: cur.y + delta.y };
  }

  // Больше лент нет
  return { to: null, path };
}
