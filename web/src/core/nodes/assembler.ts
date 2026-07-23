/**
 * Сборочный станок / Агент (3×3).
 * Сердце системы: вызывает LLM с system-промптом из рецепта.
 * outItem: text
 */

import { Handler, NodeCtx } from '../engine';
import { Field } from './index';
import { RECIPES } from './recipes';

export const assemblerSchema: Field[] = [
  {
    key: 'recipe',
    label: 'Рецепт',
    type: 'select',
    options: RECIPES.map((r) => ({ value: r.value, label: r.label })),
    default: 'summarizer',
  },
  {
    key: 'system',
    label: 'Система',
    type: 'textarea',
    placeholder: 'System-промпт для LLM',
    default: RECIPES[0].system, // summarizer по умолчанию
  },
  {
    key: 'modules',
    label: 'Модули',
    type: 'json',
    placeholder: '[]',
    default: [],
  },
];

/**
 * Handler для assembler: вызывает LLM с system из конфига и оборачивает ответ.
 */
export const assemblerHandler: Handler = async (ctx: NodeCtx) => {
  const system = (ctx.config['system'] as string) || '';
  const modules = (ctx.config['modules'] as string[]) || [];
  const prompt = typeof ctx.data === 'string' ? ctx.data : JSON.stringify(ctx.data);

  const response = await ctx.llm({
    system: system || undefined,
    prompt,
    tools: modules.length > 0 ? modules : undefined,
  });

  return { out: response };
};
