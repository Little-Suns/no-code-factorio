/**
 * Антенна / Webhook (HTTP) (2×2, терминал).
 * Универсальный исходящий HTTP-запрос через proxyFetch: url/method/headers/body
 * настраиваются, а не зашиты под один сервис. Один узел закрывает Telegram (bot API),
 * Discord/Slack (Incoming Webhook), GitHub API (с Authorization-заголовком) и любой
 * другой REST API — см. docs/05 примеры конфигов.
 */

import { Handler, NodeCtx } from '../engine';
import { tpl } from '../tpl';
import { Field } from './index';

export const webhookSchema: Field[] = [
  {
    key: 'url',
    label: 'URL',
    type: 'text',
    placeholder: 'https://discord.com/api/webhooks/...',
    default: '',
  },
  {
    key: 'method',
    label: 'Метод',
    type: 'select',
    options: [
      { value: 'POST', label: 'POST' },
      { value: 'GET', label: 'GET' },
      { value: 'PUT', label: 'PUT' },
      { value: 'DELETE', label: 'DELETE' },
    ],
    default: 'POST',
  },
  {
    key: 'headers',
    label: 'Заголовки (JSON)',
    type: 'json',
    placeholder: '{"authorization": "Bearer ..."}',
    default: { 'content-type': 'application/json' },
  },
  {
    key: 'body',
    label: 'Тело запроса ({{text}} — payload, {{path.to.field}} — вложенное поле)',
    type: 'textarea',
    placeholder: '{"content": "{{text}}"}',
    default: '{"content": "{{text}}"}',
  },
];

/**
 * Handler: рендерит body по шаблону и шлёт через proxyFetch.
 * {{text}} доступен независимо от формы payload'а — если ctx.data пришла строкой
 * (обычный случай для outItem 'text' у miner/assembler), она подставляется под ключ
 * text; если объектом — используется как есть (тогда доступны и её собственные поля).
 */
export const webhookHandler: Handler = async (ctx: NodeCtx) => {
  const url = (ctx.config['url'] as string) || '';
  if (!url) {
    throw new Error('webhook: url is required');
  }
  const method = ((ctx.config['method'] as string) || 'POST').toUpperCase();

  let headers: Record<string, string> = {};
  const rawHeaders = ctx.config['headers'];
  if (typeof rawHeaders === 'string' && rawHeaders.trim()) {
    try {
      headers = JSON.parse(rawHeaders);
    } catch {
      throw new Error('webhook: headers — невалидный JSON');
    }
  } else if (rawHeaders && typeof rawHeaders === 'object') {
    headers = rawHeaders as Record<string, string>;
  }
  if (!('content-type' in headers) && !('Content-Type' in headers)) {
    headers['content-type'] = 'application/json';
  }

  const bodyTemplate = (ctx.config['body'] as string) || '';
  const templateData = typeof ctx.data === 'string' ? { text: ctx.data } : ctx.data;
  const renderedBody = bodyTemplate
    ? tpl(bodyTemplate, templateData)
    : typeof ctx.data === 'string'
      ? ctx.data
      : JSON.stringify(ctx.data);

  const res = await ctx.proxyFetch({ url, method, headers, body: renderedBody });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`webhook: HTTP ${res.status} — ${JSON.stringify(res.body).slice(0, 200)}`);
  }

  return { done: true };
};
