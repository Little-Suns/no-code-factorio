/**
 * Манипулятор (1×1).
 * Передаточный узел: забирает предмет со входа (BACK) и кладёт на выход (FRONT)
 * без изменений — соединяет ленту со станком (или два станка) там, где их
 * порты не примыкают впритык. Без конфига.
 */

import { Handler, NodeCtx } from '../engine';
import { Field } from './index';

export const manipulatorSchema: Field[] = [];

// Визуальная пауза «захвата» — без неё handler резолвится мгновенно, и фаза
// грэба (первые 8 кадров man.gif, machines.ts:triggerManipulatorGrab) не успевает
// доиграть до поворота на выкладку. 8 кадров × animationSpeed 0.1 (~6 кадров/с) ≈ 1.35с.
const GRAB_MS = 1350;

export const manipulatorHandler: Handler = async (ctx: NodeCtx) => {
  await new Promise((resolve) => setTimeout(resolve, GRAB_MS));
  return { out: ctx.data };
};
