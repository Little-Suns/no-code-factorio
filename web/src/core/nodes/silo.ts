/**
 * Ракета / Output (3×3, терминал).
 * Конец пути: запускает результат.
 */

import { Handler, NodeCtx } from '../engine';
import { Field } from './index';

export const siloSchema: Field[] = [];

// Визуальная пауза «запуска» — без неё handler резолвится за один тик, working
// сменяется на ok быстрее одного кадра рендера, и work-анимация (silo_work.png)
// физически не успевает отрисоваться (machines.ts переключает спрайт по status).
const LAUNCH_MS = 1500;

/**
 * Handler для silo: держит working LAUNCH_MS (даёт отыграть анимацию), затем
 * завершает обработку, эмитит result.
 */
export const siloHandler: Handler = async (ctx: NodeCtx) => {
  await new Promise((resolve) => setTimeout(resolve, LAUNCH_MS));
  return { done: true };
};
