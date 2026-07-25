/**
 * Шахта / Input (2×2).
 * Источник данных: текст, URL или вебхук.
 * outItem: text
 */

import { Handler, NodeCtx } from '../engine';
import { Field } from './index';

// Тот же принцип, что у silo (см. silo.ts LAUNCH_MS): work-анимация (miner_work.png,
// 16 кадров × animationSpeed 0.1 ≈ 2.7с) должна успеть отыграть. mode='text' резолвится
// синхронно (мгновенно) — working сменялся бы на ok быстрее одного кадра, и «дрель»
// визуально не анимировалась вообще. Доливаем остаток до минимума (не плоскую паузу —
// mode='url' может и так быть медленнее сети).
const MIN_WORK_MS = 2700;

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
  const started = Date.now();
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

  const elapsed = Date.now() - started;
  if (elapsed < MIN_WORK_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_WORK_MS - elapsed));
  }

  return { out: payload };
};
