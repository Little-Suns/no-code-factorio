/**
 * Смеситель / Химзавод (3×3).
 * Объединяет данные с нескольких входов (массив).
 */

import { Handler, NodeCtx } from '../engine';
import { Field } from './index';

export const mixerSchema: Field[] = [
  {
    key: 'mode',
    label: 'Режим',
    type: 'select',
    options: [
      { value: 'concat', label: 'Склеить' },
      { value: 'llm', label: 'LLM-синтез' },
    ],
    default: 'concat',
  },
  {
    key: 'prompt',
    label: 'Промпт (для LLM)',
    type: 'textarea',
    placeholder: 'Объедини версии в один пост',
    default: 'Merge these items into one',
  },
];

/**
 * Handler concat: объединяет массив данных в структуру {parts: [...data]}.
 */
const concatHandler: Handler = async (ctx: NodeCtx) => {
  if (!Array.isArray(ctx.data)) {
    throw new Error('mixer concat: data must be array');
  }
  return { out: { parts: ctx.data } };
};

/**
 * Handler llm: пронумеровывает ингредиенты и вызывает LLM для синтеза.
 */
const llmHandler: Handler = async (ctx: NodeCtx) => {
  if (!Array.isArray(ctx.data)) {
    throw new Error('mixer llm: data must be array');
  }

  const prompt = (ctx.config['prompt'] as string) || '';
  const ingredients = ctx.data
    .map((item, i) => `${i + 1}. ${typeof item === 'string' ? item : JSON.stringify(item)}`)
    .join('\n');

  const fullPrompt = prompt + '\n\n' + ingredients;

  const response = await ctx.llm({
    prompt: fullPrompt,
  });

  return { out: response };
};

/**
 * Выбирает handler в зависимости от режима.
 */
export const mixerHandler: Handler = async (ctx: NodeCtx) => {
  const mode = (ctx.config['mode'] as string) || 'concat';
  return mode === 'llm' ? llmHandler(ctx) : concatHandler(ctx);
};
