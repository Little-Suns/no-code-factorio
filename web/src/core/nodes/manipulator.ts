/**
 * Манипулятор (1×1).
 * Передаточный узел: забирает предмет со входа (BACK) и кладёт на выход (FRONT)
 * без изменений — соединяет ленту со станком (или два станка) там, где их
 * порты не примыкают впритык. Без конфига.
 */

import { Handler, NodeCtx } from '../engine';
import { Field } from './index';

export const manipulatorSchema: Field[] = [];

export const manipulatorHandler: Handler = async (ctx: NodeCtx) => {
  return { out: ctx.data };
};
