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
 * Модули (E2): id из config.modules идут в ctx.llm({tools}) как есть — сервер сам
 * решает, что с ними делать ('web-search' → :online, docs/07); 'memory' сервер
 * игнорирует и обрабатывается здесь — снапшот сундуков (ctx.memory, см. engine.ts)
 * подмешивается в prompt как RAG-контекст.
 */
export const assemblerHandler: Handler = async (ctx: NodeCtx) => {
  const system = (ctx.config['system'] as string) || '';
  const modules = (ctx.config['modules'] as string[]) || [];
  let prompt = typeof ctx.data === 'string' ? ctx.data : JSON.stringify(ctx.data);

  if (modules.includes('memory') && ctx.memory && ctx.memory.length > 0) {
    const memoryContext = ctx.memory
      .map((item, i) => `${i + 1}. ${typeof item === 'string' ? item : JSON.stringify(item)}`)
      .join('\n');
    prompt = `Контекст из памяти (склад):\n${memoryContext}\n\nЗадача:\n${prompt}`;
  }

  const response = await ctx.llm({
    system: system || undefined,
    prompt,
    tools: modules.length > 0 ? modules : undefined,
  });

  return { out: response };
};
