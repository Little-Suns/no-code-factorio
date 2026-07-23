/**
 * Лаборатория / Критик (2×1).
 * Проверяет качество предмета по критериям через LLM: PASS → дальше (ветка pass),
 * REWORK → петля обратно на доработку (ветка rework, outItem: verdict — см. engine.ts).
 * От вечного круга защищает ttl (docs/04).
 */

import { Handler, NodeCtx } from '../engine';
import { Field } from './index';

export const labSchema: Field[] = [
  {
    key: 'criteria',
    label: 'Критерии',
    type: 'textarea',
    placeholder: 'Текст вежлив, без воды, до 500 знаков',
    default: 'Be polite and concise',
  },
];

export const labHandler: Handler = async (ctx: NodeCtx) => {
  const criteria = (ctx.config['criteria'] as string) || '';
  const textData = typeof ctx.data === 'string' ? ctx.data : JSON.stringify(ctx.data);

  const response = await ctx.llm({
    system: 'Ты критик. По критериям ответь первой строкой PASS или REWORK, далее замечания.',
    prompt: criteria + '\n\n' + textData,
  });

  const lines = response.split('\n');
  const verdictLine = (lines[0] ?? '').trim().toUpperCase();

  if (verdictLine.startsWith('PASS')) {
    return { branch: 'pass', out: ctx.data };
  }

  const critique = lines.slice(1).join('\n').trim() || response;
  return { branch: 'rework', out: { draft: ctx.data, critique } };
};
