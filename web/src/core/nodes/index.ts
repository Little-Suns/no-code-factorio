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
import { furnaceHandler, furnaceSchema } from './furnace';
import { chestHandler, chestSchema } from './chest';
import { labHandler, labSchema } from './lab';
import { webhookHandler, webhookSchema } from './webhook';
import { manipulatorHandler, manipulatorSchema } from './manipulator';

/**
 * Реестр всех станков. Belt не включен (у него нет handler и schema).
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
    size: { w: 2, h: 2 },
    outItem: 'text',
    schema: assemblerSchema,
    handler: assemblerHandler,
  },
  splitter: {
    kind: 'splitter',
    title: 'Дублер',
    size: { w: 2, h: 2 },
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

  // Belt: без handler и schema
  belt: {
    kind: 'belt',
    title: 'Конвейер',
    size: { w: 1, h: 1 },
    schema: [],
    // no handler
  },

  // Усиление (B5)
  furnace: {
    kind: 'furnace',
    title: 'Печь / Препроцессор',
    size: { w: 2, h: 2 },
    schema: furnaceSchema,
    handler: furnaceHandler,
  },
  chest: {
    kind: 'chest',
    title: 'Сундук / Буфер',
    size: { w: 1, h: 1 },
    outItem: 'batch',
    schema: chestSchema,
    handler: chestHandler,
  },
  lab: {
    kind: 'lab',
    title: 'Лаборатория / Критик',
    size: { w: 2, h: 2 },
    schema: labSchema,
    handler: labHandler,
  },

  // Усиление: generic HTTP-исход (закрывает Discord/Slack/GitHub/email и т.д. одним узлом)
  webhook: {
    kind: 'webhook',
    title: 'Антенна / Webhook (HTTP)',
    size: { w: 2, h: 2 },
    schema: webhookSchema,
    handler: webhookHandler,
  },

  // Усиление: 1×1 передаточный узел (лента↔станок там, где порты не примыкают впритык)
  manipulator: {
    kind: 'manipulator',
    title: 'Манипулятор',
    size: { w: 1, h: 1 },
    schema: manipulatorSchema,
    handler: manipulatorHandler,
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
