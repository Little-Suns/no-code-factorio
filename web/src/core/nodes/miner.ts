/**
 * Шахта / Input (2×2).
 * Источник данных: текст, URL или вебхук.
 * outItem: text
 */

import { Handler, NodeCtx } from '../engine';
import { Field } from './index';

export const minerSchema: Field[] = [
  {
    key: 'mode',
    label: 'Источник',
    type: 'select',
    options: [
      { value: 'text', label: 'Заданный текст' },
      { value: 'url', label: 'Содержимое URL' },
      { value: 'webhook', label: 'Внешний вебхук' },
    ],
    default: 'text',
  },
  {
    key: 'text',
    label: 'Текст',
    type: 'textarea',
    placeholder: 'Введите текст',
    default: 'Hello, world!',
  },
  {
    key: 'url',
    label: 'URL',
    type: 'text',
    placeholder: 'https://example.com',
    default: 'https://example.com',
  },
  {
    key: 'intervalSec',
    label: 'Интервал (сек)',
    type: 'number',
    placeholder: '0 = только кнопка',
    default: 0,
  },
];

/**
 * Handler для miner: источник, входа нет.
 * Payload: mode text → содержимое поля; mode url → proxyFetch(url).body как текст; mode webhook → тело от вебхука.
 * (Реальное срабатывание триггера (кнопка, интервал, вебхук) управляется Engine.triggerMiner и webhooks.)
 */
export const minerHandler: Handler = async (ctx: NodeCtx) => {
  const mode = (ctx.config['mode'] as string) || 'text';

  let payload: unknown;

  if (mode === 'text') {
    // Текст из конфига
    payload = ctx.config['text'] || '';
  } else if (mode === 'url') {
    // Загрузить по URL
    try {
      const res = await ctx.proxyFetch({
        url: ctx.config['url'] as string,
        method: 'GET',
      });
      if (res.status !== 200) {
        throw new Error(`proxyFetch returned ${res.status}`);
      }
      payload = res.body;
    } catch (e) {
      throw new Error(`miner URL fetch failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else if (mode === 'webhook') {
    // Данные приходят от вебхука (ctx.data уже установлена engine)
    payload = ctx.data;
  } else {
    payload = '';
  }

  return { out: payload };
};
