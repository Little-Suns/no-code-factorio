/**
 * Ракета / Output (3×3, терминал).
 * Конец пути: запускает результат.
 */

import { Handler, NodeCtx } from '../engine';
import { Field } from './index';

export const siloSchema: Field[] = [];

/**
 * Handler для silo: просто завершает обработку, эмитит result.
 */
export const siloHandler: Handler = async (ctx: NodeCtx) => {
  return { done: true };
};
