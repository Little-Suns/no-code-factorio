/**
 * Проверки для станков (B4).
 * 6 AC: assembler-llm, splitter-expr/llm, mixer-concat/llm, miner-url, telegram.
 */

import { NODE_DEFS } from '../nodes';
import { Handler, NodeCtx, HandlerResult } from '../engine';

// ============================================================================
// Моки llm и proxyFetch для тестирования
// ============================================================================

let mockLlmCalls: Array<{ system?: string; prompt: string; tools?: string[] }> = [];
let mockProxyFetchCalls: Array<{ url: string; method?: string }> = [];

const mockLlm = async (req: {
  system?: string;
  prompt: string;
  tools?: string[];
}): Promise<string> => {
  mockLlmCalls.push(req);

  // Плагины для тестирования разных режимов
  if (req.system?.includes('YES или NO')) {
    // Splitter LLM режим
    if (req.prompt.includes('positive')) {
      return 'YES, это позитивно';
    }
    return 'NO, это не позитивно';
  }

  if (req.system?.includes('сжимаешь')) {
    // Assembler summarizer
    return 'Краткое резюме текста.';
  }

  // Mixer LLM: просто объедини номера
  if (req.prompt.match(/^\d+\./m)) {
    return 'Объединённый результат.';
  }

  // Дефолт
  return 'LLM response';
};

const mockProxyFetch = async (req: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{ status: number; body: unknown }> => {
  mockProxyFetchCalls.push(req);

  // Мок для URL-загрузки (miner)
  if (req.method === 'GET' && req.url.includes('example.com')) {
    return { status: 200, body: 'Content from URL' };
  }

  // Мок для Telegram sendMessage
  if (req.url.includes('telegram.org') && req.method === 'POST') {
    const body = req.body ? JSON.parse(req.body) : {};

    // Успешный ответ
    if (body.chat_id !== 'fail') {
      return {
        status: 200,
        body: { ok: true, result: { message_id: 123 } },
      };
    }

    // Ошибка (ok: false)
    return {
      status: 200,
      body: { ok: false, error_code: 400, description: 'Bad Request: chat not found' },
    };
  }

  // Дефолт
  return { status: 200, body: 'OK' };
};

// ============================================================================
// AC 1: assembler зовёт llm с system и оборачивает {out}
// ============================================================================

async function testAssemblerLlm() {
  mockLlmCalls = [];

  const handler = NODE_DEFS.assembler.handler as Handler;
  if (!handler) throw new Error('assembler handler missing');

  const ctx: NodeCtx = {
    config: {
      recipe: 'summarizer',
      system: 'Ты сжимаешь текст до 3 предложений.',
      modules: [],
    },
    data: 'This is a long text that should be summarized.',
    tpl: (s) => s,
    llm: mockLlm,
    proxyFetch: mockProxyFetch,
  };

  const result = (await handler(ctx)) as { out: unknown };
  if (!('out' in result)) throw new Error('AC1: assembler must return {out}');
  if (typeof result.out !== 'string') throw new Error('AC1: out must be string');
  if (result.out !== 'Краткое резюме текста.') throw new Error('AC1: wrong response');
  if (!mockLlmCalls[0]?.system?.includes('сжимаешь'))
    throw new Error('AC1: system not passed');
  console.log('✓ AC1: assembler-llm');
}

// ============================================================================
// AC 2: splitter-expr ветвит по условию, splitter-llm парсит YES/NO
// ============================================================================

async function testSplitterExpr() {
  const handler = NODE_DEFS.splitter.handler as Handler;
  if (!handler) throw new Error('splitter handler missing');

  const ctx: NodeCtx = {
    config: { mode: 'expr', expr: 'String(data).length > 10' },
    data: 'Short text',
    tpl: (s) => s,
    llm: mockLlm,
    proxyFetch: mockProxyFetch,
  };

  const result = (await handler(ctx)) as {
    branch: 'true' | 'false';
    out: unknown;
  };
  if (result.branch !== 'false') throw new Error('AC2-expr: "Short text" should be false');
  if (result.out !== 'Short text') throw new Error('AC2-expr: data not preserved');

  // Длинный текст
  const ctx2 = { ...ctx, data: 'This is a much longer text' };
  const result2 = (await handler(ctx2)) as {
    branch: 'true' | 'false';
    out: unknown;
  };
  if (result2.branch !== 'true')
    throw new Error('AC2-expr: long text should be true');

  console.log('✓ AC2a: splitter-expr');
}

async function testSplitterLlm() {
  mockLlmCalls = [];
  const handler = NODE_DEFS.splitter.handler as Handler;

  const ctx: NodeCtx = {
    config: {
      mode: 'llm',
      question: 'Is this positive feedback?',
    },
    data: 'This product is amazing!',
    tpl: (s) => s,
    llm: mockLlm,
    proxyFetch: mockProxyFetch,
  };

  const result = (await handler(ctx)) as {
    branch: 'true' | 'false';
    out: unknown;
  };
  if (result.branch !== 'true') throw new Error('AC2-llm: positive should be true');
  if (mockLlmCalls[0]?.system !== 'Ответь строго YES или NO.')
    throw new Error('AC2-llm: wrong system');

  console.log('✓ AC2b: splitter-llm');
}

// ============================================================================
// AC 3: mixer-concat склеивает массив, mixer-llm нумерует ингредиенты
// ============================================================================

async function testMixerConcat() {
  const handler = NODE_DEFS.mixer.handler as Handler;
  if (!handler) throw new Error('mixer handler missing');

  const ctx: NodeCtx = {
    config: { mode: 'concat' },
    data: ['item1', 'item2', 'item3'],
    tpl: (s) => s,
    llm: mockLlm,
    proxyFetch: mockProxyFetch,
  };

  const result = (await handler(ctx)) as { out: unknown };
  const out = result.out as { parts?: unknown[] };
  if (!out.parts) throw new Error('AC3-concat: must return {parts:[...]}');
  if (out.parts.length !== 3) throw new Error('AC3-concat: wrong parts count');
  console.log('✓ AC3a: mixer-concat');
}

async function testMixerLlm() {
  mockLlmCalls = [];
  const handler = NODE_DEFS.mixer.handler as Handler;

  const ctx: NodeCtx = {
    config: { mode: 'llm', prompt: 'Merge these' },
    data: ['version A', 'version B'],
    tpl: (s) => s,
    llm: mockLlm,
    proxyFetch: mockProxyFetch,
  };

  const result = (await handler(ctx)) as { out: unknown };
  if (typeof result.out !== 'string')
    throw new Error('AC3-llm: out must be string');
  if (!mockLlmCalls[0]?.prompt.includes('1.'))
    throw new Error('AC3-llm: must number ingredients');
  console.log('✓ AC3b: mixer-llm');
}

// ============================================================================
// AC 4: miner-url тянет payload через proxyFetch
// ============================================================================

async function testMinerUrl() {
  mockProxyFetchCalls = [];
  const handler = NODE_DEFS.miner.handler as Handler;
  if (!handler) throw new Error('miner handler missing');

  const ctx: NodeCtx = {
    config: { mode: 'url', url: 'https://example.com/data' },
    data: undefined,
    tpl: (s) => s,
    llm: mockLlm,
    proxyFetch: mockProxyFetch,
  };

  const result = (await handler(ctx)) as { out: unknown };
  if (result.out !== 'Content from URL')
    throw new Error('AC4: wrong fetched content');
  if (mockProxyFetchCalls[0]?.url !== 'https://example.com/data')
    throw new Error('AC4: wrong URL');

  console.log('✓ AC4: miner-url');
}

// ============================================================================
// AC 5: telegram собирает URL/body и кидает на ok:false
// ============================================================================

async function testTelegramSuccess() {
  mockProxyFetchCalls = [];
  const handler = NODE_DEFS.telegram.handler as Handler;
  if (!handler) throw new Error('telegram handler missing');

  const ctx: NodeCtx = {
    config: {
      botToken: 'test-token-123',
      chatId: '12345',
      text: 'Done: {{text}}',
    },
    data: 'result data',
    tpl: (s) => s.replace('{{text}}', 'result data'),
    llm: mockLlm,
    proxyFetch: mockProxyFetch,
  };

  const result = (await handler(ctx)) as { done: boolean };
  if (result.done !== true) throw new Error('AC5-success: must return {done:true}');
  if (!mockProxyFetchCalls[0]?.url.includes('test-token-123'))
    throw new Error('AC5-success: token not in URL');
  const body = mockProxyFetchCalls[0]?.url; // URL call
  if (!body) throw new Error('AC5-success: no proxy call');

  console.log('✓ AC5a: telegram-success');
}

async function testTelegramError() {
  mockProxyFetchCalls = [];
  const handler = NODE_DEFS.telegram.handler as Handler;

  const ctx: NodeCtx = {
    config: {
      botToken: 'test-token',
      chatId: 'fail', // Это вызовет ok:false
      text: 'Message',
    },
    data: 'test',
    tpl: (s) => s,
    llm: mockLlm,
    proxyFetch: mockProxyFetch,
  };

  try {
    await handler(ctx);
    throw new Error('AC5-error: must throw on ok:false');
  } catch (e) {
    if (e instanceof Error && e.message.includes('telegram')) {
      console.log('✓ AC5b: telegram-error');
    } else {
      throw e;
    }
  }
}

// ============================================================================
// AC 6: реестр покрывает все MachineKind кроме belt
// ============================================================================

function testRegistry() {
  const kinds = [
    'miner',
    'assembler',
    'splitter',
    'mixer',
    'silo',
    'telegram',
    'furnace',
    'chest',
    'lab',
    'accumulator',
  ] as const;

  for (const kind of kinds) {
    const def = NODE_DEFS[kind];
    if (!def) throw new Error(`AC6: ${kind} not in NODE_DEFS`);
    if (def.kind !== kind) throw new Error(`AC6: ${kind} kind mismatch`);
    if (!def.title) throw new Error(`AC6: ${kind} has no title`);
    if (!def.size) throw new Error(`AC6: ${kind} has no size`);
    if (!def.schema) throw new Error(`AC6: ${kind} has no schema`);
  }

  // Belt проверяем отдельно (есть в реестре но без handler)
  const belt = NODE_DEFS.belt;
  if (!belt) throw new Error('AC6: belt not in NODE_DEFS');
  if (belt.handler) throw new Error('AC6: belt should have no handler');

  console.log('✓ AC6: registry-complete');
}

// ============================================================================
// Запуск всех проверок
// ============================================================================

export async function checkNodes() {
  await testAssemblerLlm();
  await testSplitterExpr();
  await testSplitterLlm();
  await testMixerConcat();
  await testMixerLlm();
  await testMinerUrl();
  await testTelegramSuccess();
  await testTelegramError();
  testRegistry();

  console.log('✓ All nodes checks passed (B4 AC 1-6)');
}

// Выполнить проверки
checkNodes().catch((e) => {
  console.error('✗ Nodes check failed:', e);
  throw e;
});
