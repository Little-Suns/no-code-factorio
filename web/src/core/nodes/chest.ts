/**
 * Сундук / Буфер (1×1, outItem: batch).
 * Копит предметы до batchSize — буферизация живёт в движке (Engine.deliverToChest,
 * см. docs/04), а не здесь: к моменту вызова handler набор уже полон, и data — массив
 * накопленных payload'ов. Handler лишь пропускает пачку дальше как batch-предмет.
 */

import { Handler, NodeCtx } from '../engine';
import { Field } from './index';

export const chestSchema: Field[] = [
  {
    key: 'batchSize',
    label: 'Размер пачки',
    type: 'number',
    default: 5,
  },
];

export const chestHandler: Handler = async (ctx: NodeCtx) => {
  return { out: ctx.data };
};
