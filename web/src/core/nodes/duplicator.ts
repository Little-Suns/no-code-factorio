/**
 * Дублер (2×2). Один вход → две идентичные копии (по одной на каждый выход).
 * Хендлер просто пропускает данные как есть ({out}); само дублирование делает движок:
 * оба выходных порта имеют branch 'out' (grid.ts outPorts), движок спавнит клон пакета
 * на каждый 'out'-edge. Конфига нет — это «тупой» размножитель.
 */

import { Handler, NodeCtx } from '../engine';
import { Field } from './index';

export const duplicatorSchema: Field[] = [];

// Визуальная пауза, тот же принцип, что у silo (см. silo.ts): без неё handler резолвится
// за один тик, working сменяется на ok быстрее одного кадра рендера, и work-анимация
// (duplicator_work.png, 16 кадров) физически не успевает отрисоваться — станок выглядит
// так, будто анимации вообще нет. 16 кадров × animationSpeed 0.1 (machines.ts) ≈ 2.7с.
const DUPLICATE_MS = 2700;

export const duplicatorHandler: Handler = async (ctx: NodeCtx) => {
  await new Promise((resolve) => setTimeout(resolve, DUPLICATE_MS));
  return { out: ctx.data };
};
