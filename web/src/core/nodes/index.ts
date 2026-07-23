/**
 * Реестр станков NODE_DEFS.
 * Контракты NodeDef и Field определены здесь (не в types.ts).
 */

import { MachineKind, ItemType } from '../types';
import { Handler } from '../engine';

/**
 * Определение поля конфига станка для UI-формы.
 */
export interface Field {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'json' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
  default?: unknown;
}

/**
 * Определение станка: название, размер, схема конфига, handler, явный тип выхода.
 */
export interface NodeDef {
  kind: MachineKind;
  title: string;
  size: { w: number; h: number };
  outItem?: ItemType;
  schema: Field[];
  handler?: Handler;
}

// Import handlers и schemas
import { minerHandler, minerSchema } from './miner';
import { assemblerHandler, assemblerSchema } from './assembler';
import { splitterHandler, splitterSchema } from './splitter';
import { mixerHandler, mixerSchema } from './mixer';
import { siloHandler, siloSchema } from './silo';
import { telegramHandler, telegramSchema } from './telegram';

/**
 * Реестр всех станков. Belt не включен (у него нет handler и schema).
 * Furnace, chest, lab — заглушки с title/size/schema, handler=undefined (B5).
 */
export const NODE_DEFS: Record<MachineKind, NodeDef> = {
  // MVP-ядро
  miner: {
    kind: 'miner',
    title: 'Шахта / Input',
    size: { w: 2, h: 2 },
    outItem: 'text',
    schema: minerSchema,
    handler: minerHandler,
  },
  assembler: {
    kind: 'assembler',
    title: 'Сборочный станок / Агент',
    size: { w: 3, h: 3 },
    outItem: 'text',
    schema: assemblerSchema,
    handler: assemblerHandler,
  },
  splitter: {
    kind: 'splitter',
    title: 'Разветвитель',
    size: { w: 2, h: 1 },
    schema: splitterSchema,
    handler: splitterHandler,
  },
  mixer: {
    kind: 'mixer',
    title: 'Смеситель / Химзавод',
    size: { w: 3, h: 3 },
    schema: mixerSchema,
    handler: mixerHandler,
  },
  silo: {
    kind: 'silo',
    title: 'Ракета / Output',
    size: { w: 3, h: 3 },
    schema: siloSchema,
    handler: siloHandler,
  },
  telegram: {
    kind: 'telegram',
    title: 'Антенна / Telegram',
    size: { w: 2, h: 2 },
    schema: telegramSchema,
    handler: telegramHandler,
  },

  // Belt: без handler и schema
  belt: {
    kind: 'belt',
    title: 'Конвейер',
    size: { w: 1, h: 1 },
    schema: [],
    // no handler
  },

  // Усиление (B5): заглушки
  furnace: {
    kind: 'furnace',
    title: 'Печь / Препроцессор',
    size: { w: 2, h: 2 },
    schema: [
      {
        key: 'code',
        label: 'Код',
        type: 'textarea',
        placeholder: "return String(data).replace(/<[^>]+>/g, '')",
        default: "return data;",
      },
    ],
    // handler в B5
  },
  chest: {
    kind: 'chest',
    title: 'Сундук / Буфер',
    size: { w: 1, h: 1 },
    outItem: 'batch',
    schema: [
      {
        key: 'batchSize',
        label: 'Размер пачки',
        type: 'number',
        default: 5,
      },
    ],
    // handler в B5
  },
  lab: {
    kind: 'lab',
    title: 'Лаборатория / Критик',
    size: { w: 2, h: 1 },
    schema: [
      {
        key: 'criteria',
        label: 'Критерии',
        type: 'textarea',
        placeholder: 'Текст вежлив, без воды, до 500 знаков',
        default: 'Be polite and concise',
      },
    ],
    // handler в B5
  },

  // Усиление (E1): энергия
  accumulator: {
    kind: 'accumulator',
    title: 'Аккумулятор',
    size: { w: 2, h: 2 },
    schema: [
      {
        key: 'capacity',
        label: 'Ёмкость (токены)',
        type: 'number',
        default: 1000,
      },
    ],
    // no handler (вне графа лент)
  },
};
