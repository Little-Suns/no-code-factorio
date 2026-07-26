import { Level, LevelResults } from './types';

/**
 * Форма chest-результата подтверждена в core/engine.ts::deliverToChest:
 * недобор → { buffered, batchSize, items }, полный батч → { ..., flushed: true }.
 */
interface ChestResultData {
  buffered: number;
  batchSize: number;
  items: unknown[];
  flushed?: boolean;
}

function isChestFlush(data: unknown): data is ChestResultData {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as ChestResultData).flushed === true &&
    Array.isArray((data as ChestResultData).items) &&
    (data as ChestResultData).items.length === (data as ChestResultData).batchSize
  );
}

function anyResult(results: LevelResults): boolean {
  return Object.values(results).some((l) => l.length > 0);
}

export const LEVELS: Level[] = [
  {
    id: 'delivery',
    titleKey: 'level.delivery.title',
    descKey: 'level.delivery.desc',
    hintKeys: ['level.delivery.hint.1', 'level.delivery.hint.2'],
    parEntities: 6,
    goodEntities: 9,
    evaluate: anyResult,
  },
  {
    id: 'uppercase',
    titleKey: 'level.uppercase.title',
    descKey: 'level.uppercase.desc',
    hintKeys: ['level.uppercase.hint.1', 'level.uppercase.hint.2'],
    parEntities: 9,
    goodEntities: 13,
    // Известное ограничение (принято в плане): можно обойти furnace, сразу написав
    // капсом в miner — тот же класс допущения, что и в практик-шагах Tutorial.
    evaluate: (results) =>
      Object.values(results).some((l) => {
        const data = l[0]?.data;
        return typeof data === 'string' && data.length > 0 && data === data.toUpperCase() && /[A-ZА-ЯЁ]/.test(data);
      }),
  },
  {
    id: 'duplicator',
    titleKey: 'level.duplicator.title',
    descKey: 'level.duplicator.desc',
    hintKeys: ['level.duplicator.hint.1', 'level.duplicator.hint.2'],
    parEntities: 11,
    goodEntities: 15,
    // Минимум два РАЗНЫХ nodeId с непустым результатом, чьи последние записи структурно
    // совпадают — реальное поведение splitter (безусловный дублер, docs/05 устарел про branch).
    evaluate: (results) => {
      const entries = Object.entries(results).filter(([, l]) => l.length > 0);
      if (entries.length < 2) return false;
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          if (JSON.stringify(entries[i][1][0].data) === JSON.stringify(entries[j][1][0].data)) return true;
        }
      }
      return false;
    },
  },
  {
    id: 'batch',
    titleKey: 'level.batch.title',
    descKey: 'level.batch.desc',
    hintKeys: ['level.batch.hint.1', 'level.batch.hint.2'],
    parEntities: 9,
    goodEntities: 13,
    evaluate: (results) => Object.values(results).some((l) => l.some((r) => isChestFlush(r.data))),
  },
  {
    id: 'quality',
    titleKey: 'level.quality.title',
    descKey: 'level.quality.desc',
    hintKeys: ['level.quality.hint.1', 'level.quality.hint.2', 'level.quality.hint.3'],
    parEntities: 14,
    goodEntities: 19,
    // Известное ограничение (принято в плане, тот же класс допущения, что у уровня 2):
    // evaluate не может заглянуть внутрь pass/rework-петли lab, только в финальный
    // результат silo — тот же предикат, что и у «Первой доставки».
    evaluate: anyResult,
  },
  {
    id: 'editorial',
    titleKey: 'level.editorial.title',
    descKey: 'level.editorial.desc',
    hintKeys: [
      'level.editorial.hint.1',
      'level.editorial.hint.2',
      'level.editorial.hint.3',
      'level.editorial.hint.4',
    ],
    parEntities: 32,
    goodEntities: 42,
    bonus: true,
    evaluate: (results) => {
      const flat = Object.values(results).flat();
      const hasChestFlush = flat.some((r) => isChestFlush(r.data));
      const hasSiloResult = flat.some(
        (r) => r.data !== undefined && !(typeof r.data === 'object' && r.data !== null && 'flushed' in r.data)
      );
      return hasChestFlush && hasSiloResult;
    },
  },
];

/**
 * Уровень разлочен, если это обычный уровень (доступны все и сразу, в любом порядке),
 * либо bonus-уровень (editorial) — тот открывается только когда пройдены (stars > 0)
 * ВСЕ обычные уровни. Общая функция для LevelPanel.tsx и LevelComplete.tsx, чтобы не
 * разъезжались два места с одним и тем же условием.
 */
export function isLevelUnlocked(level: Level, progress: Record<string, { stars: 0 | 1 | 2 | 3 }>): boolean {
  if (!level.bonus) return true;
  return LEVELS.filter((l) => !l.bonus).every((l) => (progress[l.id]?.stars ?? 0) > 0);
}
