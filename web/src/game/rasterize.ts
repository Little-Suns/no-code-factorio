import type { Vec, Dir } from '../core/types';

export interface RasteredStep {
  tile: Vec;
  dir: Dir;
}

/**
 * Растеризация пути мыши по тайлам для drag-ленты.
 * Шаги по 4 направлениям, сперва по оси большего смещения.
 * Направление ленты = направление шага.
 *
 * @param from Начальный тайл
 * @param to Конечный тайл
 * @returns Массив {tile, dir} для каждого шага
 */
export function rasterizeLine(from: Vec, to: Vec): RasteredStep[] {
  const result: RasteredStep[] = [];
  let current = { x: from.x, y: from.y };

  // Смещения в тайлах (от-до)
  let dx = to.x - from.x;
  let dy = to.y - from.y;

  // Определяем, какая ось движется больше
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Если движемся преимущественно по X
  if (absDx >= absDy) {
    const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;

    // Сначала идём по X
    if (stepX !== 0) {
      while ((stepX > 0 && current.x < to.x) || (stepX < 0 && current.x > to.x)) {
        current.x += stepX;
        result.push({ tile: { ...current }, dir: stepX > 0 ? 1 : 3 });
      }
    }

    // Потом по Y
    if (stepY !== 0) {
      while ((stepY > 0 && current.y < to.y) || (stepY < 0 && current.y > to.y)) {
        current.y += stepY;
        result.push({ tile: { ...current }, dir: stepY > 0 ? 2 : 0 });
      }
    }
  } else {
    // Если движемся преимущественно по Y
    const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;

    // Сначала идём по Y
    if (stepY !== 0) {
      while ((stepY > 0 && current.y < to.y) || (stepY < 0 && current.y > to.y)) {
        current.y += stepY;
        result.push({ tile: { ...current }, dir: stepY > 0 ? 2 : 0 });
      }
    }

    // Потом по X
    if (stepX !== 0) {
      while ((stepX > 0 && current.x < to.x) || (stepX < 0 && current.x > to.x)) {
        current.x += stepX;
        result.push({ tile: { ...current }, dir: stepX > 0 ? 1 : 3 });
      }
    }
  }

  return result;
}
