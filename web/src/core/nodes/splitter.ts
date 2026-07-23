/**
 * Разветвитель (2×1).
 * Ветвит поток по условию (JS-выражение или LLM-вопрос).
 */

import { Handler, NodeCtx } from '../engine';
import { Field } from './index';

export const splitterSchema: Field[] = [
  {
    key: 'mode',
    label: 'Режим',
    type: 'select',
    options: [
      { value: 'expr', label: 'Условие (JS)' },
      { value: 'llm', label: 'Спросить LLM' },
    ],
    default: 'expr',
  },
  {
    key: 'expr',
    label: 'Выражение',
    type: 'text',
    placeholder: 'String(data).length > 500',
    default: 'true',
  },
  {
    key: 'question',
    label: 'Вопрос',
    type: 'textarea',
    placeholder: 'Это позитивный отзыв?',
    default: 'Is this positive?',
  },
];

/**
 * Handler expr: выполняет JS-выражение, ветвит по true/false.
 */
const exprHandler: Handler = async (ctx: NodeCtx) => {
  const expr = (ctx.config['expr'] as string) || 'true';
  try {
    const fn = new Function('data', `return (${expr})`);
    const result = fn(ctx.data);
    const branch = Boolean(result) ? 'true' : 'false';
    return { branch, out: ctx.data };
  } catch (e) {
    throw new Error(`splitter expr failed: ${e instanceof Error ? e.message : String(e)}`);
  }
};

/**
 * Handler llm: вызывает LLM с вопросом, парсит YES→true, иное→false.
 */
const llmHandler: Handler = async (ctx: NodeCtx) => {
  const question = (ctx.config['question'] as string) || '';
  const textData = typeof ctx.data === 'string' ? ctx.data : JSON.stringify(ctx.data);
  const prompt = question + '\n\n' + textData;

  const response = await ctx.llm({
    system: 'Ответь строго YES или NO.',
    prompt,
  });

  const branch = response.toUpperCase().includes('YES') ? 'true' : 'false';
  return { branch, out: ctx.data };
};

/**
 * Выбирает handler в зависимости от режима.
 */
export const splitterHandler: Handler = async (ctx: NodeCtx) => {
  const mode = (ctx.config['mode'] as string) || 'expr';
  return mode === 'llm' ? llmHandler(ctx) : exprHandler(ctx);
};
