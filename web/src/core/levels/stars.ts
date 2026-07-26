import { Level } from './types';

/**
 * Звёзды за эффективность: чем компактнее схема (меньше сущностей на момент успеха),
 * тем выше оценка. parEntities/goodEntities — пороги конкретного уровня.
 */
export function computeStars(level: Level, entityCount: number): 1 | 2 | 3 {
  if (entityCount <= level.parEntities) return 3;
  if (entityCount <= level.goodEntities) return 2;
  return 1;
}
