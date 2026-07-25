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
 * Тайл, с которого манипулятор физически забирает предмет (BACK) — соседний тайл
 * в направлении, обратном dir (направленно, НЕ "любой сосед" — только тот один тайл
 * позади манипулятора). Карта нужна trace(), чтобы манипулятор мог захватить предмет
 * из ЛЮБОГО тайла ленты, мимо которого он стоит — а не только из тайла, где лента
 * упирается прямо в него (конечный/терминальный тайл). Без этого манипулятор у не
 * конечного (mid-line) тайла конвейера не видел трассу вообще.
 *
 * Детерминизм: 1×1 манипуляторы не перекрываются (canPlace), но МОГУТ легально делить
 * один и тот же intake-тайл (два разных манипулятора с разных сторон одной ленты) —
 * при коллизии побеждает манипулятор с лексикографически меньшим id, а не тот, что
 * раньше встретился в Object.values(entities). Порядок ключей записи (после
 * save/load, вставки/удаления сущностей) не должен влиять на итоговый граф —
 * buildGraph обязан быть чистой функцией геометрии мира.
 */
function buildManipulatorIntakeMap(entities: Record<string, Entity>): Map<string, string> {
  const map = new Map<string, string>();
  for (const entity of Object.values(entities)) {
    if (entity.kind !== 'manipulator') continue;
    const delta = DELTA[entity.dir];
    const intake = { x: entity.pos.x - delta.x, y: entity.pos.y - delta.y };
    const key = `${intake.x},${intake.y}`;
    const existing = map.get(key);
    if (existing !== undefined && existing < entity.id) {
      continue; // уже есть манипулятор с меньшим id на этом тайле — оставляем его
    }
    map.set(key, entity.id);
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
 *
 * Приоритет терминала: если лента указывает ПРЯМО в манипулятор на СЛЕДУЮЩЕМ тайле
 * (классический терминальный случай) — боковой tap на текущем тайле игнорируется,
 * трасса идёт дальше и доходит до этого манипулятора естественным путём (следующая
 * итерация цикла, ветка "дошли до станка"). Иначе сосед-манипулятор, который лишь
 * тапает эту же ленту сбоку, мог бы перехватить уже работающую терминальную связь.
 *
 * Важно (МVP-упрощение, см. docs/03): первый tap по ходу трассы забирает ВЕСЬ поток
 * с этого источника — ничего не долетает до манипуляторов/станков дальше по той же
 * ленте (это НЕ то же самое, что раньше: до этого фикса такой манипулятор просто не
 * получал ничего сам, но и не забирал поток у других).
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
      // Валидное соединение станок↔станок ТОЛЬКО если одна из сторон — манипулятор.
      // fromManipulator НЕ «липкий» на весь ленточный пробег: манипулятор мостит ровно
      // одну границу (свой FRONT-тайл → следующий), поэтому он авторизует только ПРЯМОЕ
      // примыкание (path.length === 0, ещё ни одной ленты не пройдено) — если после его
      // выхода идёт хотя бы одна лента, дальний конец обязан сам быть манипулятором.
      if (entityAtTile.kind === 'manipulator' || (fromManipulator && path.length === 0)) {
        return { to: entityAtTile.id, path };
      }
      // Обе стороны — «настоящие» станки без манипулятора между ними: тупик
      return { to: null, path };
    }

    // На этом тайле лента
    path.push({ x: cur.x, y: cur.y });
    visited.add(key);

    // Куда лента ведёт дальше
    const delta = DELTA[entityAtTile.dir];
    const forward = { x: cur.x + delta.x, y: cur.y + delta.y };
    const forwardKey = `${forward.x},${forward.y}`;

    // Приоритет терминала: если СЛЕДУЮЩИЙ тайл — манипулятор, который и так примет
    // этот тайл как валидный вход (обычный терминальный случай) — не тапаем здесь
    // сбоку, пусть трасса дойдёт до него сама на следующей итерации.
    const forwardEntityId = occupancy.get(forwardKey);
    const forwardEntity = forwardEntityId ? entities[forwardEntityId] : undefined;
    const forwardIsManipulatorTerminal =
      !!forwardEntity &&
      forwardEntity.kind === 'manipulator' &&
      inTiles(forwardEntity).has(forwardKey);

    // Манипулятор стоит рядом с ЭТИМ тайлом (не обязательно с концом трассы) и
    // забирает предмет прямо здесь — независимо от того, куда лента идёт дальше
    const tappingManipulatorId = manipulatorIntake.get(key);
    if (tappingManipulatorId && !forwardIsManipulatorTerminal) {
      return { to: tappingManipulatorId, path };
    }

    // Двигаемся дальше по направлению ленты
    cur = forward;
  }

  // Больше лент нет
  return { to: null, path };
}
