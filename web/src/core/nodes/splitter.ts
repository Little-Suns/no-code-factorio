/**
 * Дублер (2×2). Один вход → две идентичные копии (по одной на каждый выход).
 * Хендлер просто пропускает данные как есть ({out}); само дублирование делает движок:
 * оба выходных порта имеют branch 'out' (grid.ts outPorts), движок спавнит клон пакета
 * на каждый 'out'-edge. Конфига нет — это «тупой» размножитель.
 */

import { Handler, NodeCtx } from '../engine';
import { Field } from './index';

export const splitterSchema: Field[] = [];

export const splitterHandler: Handler = async (ctx: NodeCtx) => {
  return { out: ctx.data };
};
