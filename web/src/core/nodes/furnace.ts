/**
 * Печь / Препроцессор (2×2).
 * Дешёвая обработка без LLM: исполняет пользовательский JS-код над data.
 * Быстро, предсказуемо, «не думает».
 */

import { Handler, NodeCtx } from '../engine';
import { Field } from './index';

export const furnaceSchema: Field[] = [
  {
    key: 'code',
    label: 'Код',
    type: 'textarea',
    placeholder: "return String(data).replace(/<[^>]+>/g, '')",
    default: 'return data;',
  },
];

/**
 * Handler для furnace: исполняет config.code как тело функции над data.
 * undefined на выходе — ошибка (печь обязана что-то вернуть).
 */
export const furnaceHandler: Handler = async (ctx: NodeCtx) => {
  const code = (ctx.config['code'] as string) || 'return data;';

  let result: unknown;
  try {
    const fn = new Function('data', code);
    result = fn(ctx.data);
  } catch (e) {
    throw new Error(`furnace code failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (result === undefined) {
    throw new Error('furnace must return a value');
  }

  return { out: result };
};
