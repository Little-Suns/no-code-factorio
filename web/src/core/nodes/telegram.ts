/**
 * Антенна / Telegram (2×2, терминал).
 * Отправляет сообщение в Telegram через api.telegram.org.
 */

import { Handler, NodeCtx } from '../engine';
import { Field } from './index';

export const telegramSchema: Field[] = [
  {
    key: 'botToken',
    label: 'Bot Token',
    type: 'text',
    placeholder: 'Получить от @BotFather',
    default: '',
  },
  {
    key: 'chatId',
    label: 'Chat ID',
    type: 'text',
    placeholder: 'ID чата для отправки',
    default: '',
  },
  {
    key: 'text',
    label: 'Текст сообщения',
    type: 'textarea',
    placeholder: 'Готово: {{text}}',
    default: 'Done: {{text}}',
  },
];

/**
 * Handler для telegram: отправляет POST-запрос на api.telegram.org/bot{token}/sendMessage.
 */
export const telegramHandler: Handler = async (ctx: NodeCtx) => {
  const botToken = (ctx.config['botToken'] as string) || '';
  const chatId = (ctx.config['chatId'] as string) || '';
  const textTemplate = (ctx.config['text'] as string) || 'Done: {{text}}';

  if (!botToken || !chatId) {
    throw new Error('telegram: botToken and chatId are required');
  }

  const messageText = ctx.tpl(textTemplate);

  try {
    const res = await ctx.proxyFetch({
      url: `https://api.telegram.org/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
      }),
    });

    if (res.status !== 200) {
      throw new Error(`telegram sendMessage failed with status ${res.status}`);
    }

    const body = res.body;
    if (typeof body === 'object' && body !== null && 'ok' in body) {
      const okFlag = (body as { ok?: boolean }).ok;
      if (!okFlag) {
        const description = (body as { description?: string }).description || 'unknown error';
        throw new Error(`telegram API error: ${description}`);
      }
    }
  } catch (e) {
    throw new Error(`telegram send failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { done: true };
};
