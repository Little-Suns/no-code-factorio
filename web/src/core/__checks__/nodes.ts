/**
 * Проверки для станков (B4 + B5 + E2).
 * B4: assembler-llm, duplicator-expr/llm, mixer-concat/llm, miner-url.
 * B5 (2 AC): furnace (return/undefined), lab (PASS/REWORK).
 * E2 (1 AC, 3 сценария): assembler-модули — tools в llm, memory в prompt, без модуля не подмешивается.
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
    // Duplicator LLM режим
    if (req.prompt.includes('positive')) {
      return 'YES, это позитивно';
    }
    return 'NO, это не позитивно';
  }

  if (req.system?.includes('сжимаешь')) {
    // Assembler summarizer
    return 'Краткое резюме текста.';
  }

  if (req.system?.includes('критик')) {
    // Lab: PASS/REWORK по маркеру в data
    if (req.prompt.includes('GOOD_TEXT')) {
      return 'PASS\nВыглядит отлично, замечаний нет.';
    }
    return 'REWORK\nСлишком длинно и не по делу.';
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

// AC1b: system отсутствует в config (мир из demo.json/Import) → резолвится из recipe.
// Регрессия бага: у demo-ассемблера config={recipe:'translator'} без system, handler
// раньше слал пустой system и модель просто эхом отдавала текст (не переводила).
async function testAssemblerRecipeFallback() {
  mockLlmCalls = [];
  const handler = NODE_DEFS.assembler.handler as Handler;

  const ctx: NodeCtx = {
    config: { recipe: 'translator' }, // system НЕ задан — как в demo.json
    data: 'Привет',
    tpl: (s) => s,
    llm: mockLlm,
    proxyFetch: mockProxyFetch,
  };

  await handler(ctx);
  const sentSystem = mockLlmCalls[0]?.system ?? '';
  if (!sentSystem.includes('английский')) {
    throw new Error(`AC1b: system должен резолвиться из recipe 'translator', получен: ${JSON.stringify(sentSystem)}`);
  }
  console.log('✓ AC1b: assembler-recipe-fallback (system из recipe при отсутствии в config)');
}

// ============================================================================
// AC 2: дублер пропускает данные как {out} (движок спавнит клон на каждый 'out'-edge)
// ============================================================================

async function testDuplicatorPassthrough() {
  const handler = NODE_DEFS.duplicator.handler as Handler;
  if (!handler) throw new Error('duplicator handler missing');

  const ctx: NodeCtx = {
    config: {},
    data: 'payload',
    tpl: (s) => s,
    llm: mockLlm,
    proxyFetch: mockProxyFetch,
  };

  const result = (await handler(ctx)) as { out?: unknown; branch?: unknown };
  if (!('out' in result)) throw new Error('AC2: дублер должен вернуть {out}');
  if ('branch' in result) throw new Error('AC2: дублер не ветвит (без branch) — размножает движок');
  if (result.out !== 'payload') throw new Error('AC2: данные должны пройти без изменений');
  console.log('✓ AC2: duplicator-passthrough');
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
// AC 7: furnace исполняет code над data, падает на undefined (B5)
// ============================================================================

async function testFurnaceTransform() {
  const handler = NODE_DEFS.furnace.handler as Handler;
  if (!handler) throw new Error('furnace handler missing');

  const ctx: NodeCtx = {
    config: { code: "return String(data).replace(/<[^>]+>/g, '')" },
    data: '<b>hello</b> world',
    tpl: (s) => s,
    llm: mockLlm,
    proxyFetch: mockProxyFetch,
  };

  const result = (await handler(ctx)) as { out: unknown };
  if (result.out !== 'hello world') throw new Error('AC7a: furnace must strip tags');
  console.log('✓ AC7a: furnace-transform');
}

async function testFurnaceUndefinedError() {
  const handler = NODE_DEFS.furnace.handler as Handler;

  const ctx: NodeCtx = {
    config: { code: '// не возвращает ничего' },
    data: 'anything',
    tpl: (s) => s,
    llm: mockLlm,
    proxyFetch: mockProxyFetch,
  };

  try {
    await handler(ctx);
    throw new Error('AC7b: must throw when code returns undefined');
  } catch (e) {
    if (e instanceof Error && e.message.includes('must return a value')) {
      console.log('✓ AC7b: furnace-undefined-error');
    } else {
      throw e;
    }
  }
}

async function testManipulatorPassthrough() {
  const handler = NODE_DEFS.manipulator.handler as Handler;
  if (!handler) throw new Error('manipulator handler missing');

  const ctx: NodeCtx = {
    config: {},
    data: { any: 'payload' },
    tpl: (s) => s,
    llm: mockLlm,
    proxyFetch: mockProxyFetch,
  };

  const result = (await handler(ctx)) as { out: unknown };
  if (result.out !== ctx.data) throw new Error('manipulator must pass data through unchanged');
  console.log('✓ manipulator-passthrough');
}

// ============================================================================
// AC 8: lab ветвит по PASS/REWORK (B5)
// ============================================================================

async function testLabPass() {
  const handler = NODE_DEFS.lab.handler as Handler;
  if (!handler) throw new Error('lab handler missing');

  const ctx: NodeCtx = {
    config: { criteria: 'Be polite and concise' },
    data: 'GOOD_TEXT: a polite short message',
    tpl: (s) => s,
    llm: mockLlm,
    proxyFetch: mockProxyFetch,
  };

  const result = (await handler(ctx)) as { branch: string; out: unknown };
  if (result.branch !== 'pass') throw new Error('AC8a: expected pass branch');
  if (result.out !== ctx.data) throw new Error('AC8a: pass must preserve original data');
  console.log('✓ AC8a: lab-pass');
}

async function testLabRework() {
  const handler = NODE_DEFS.lab.handler as Handler;

  const ctx: NodeCtx = {
    config: { criteria: 'Be polite and concise' },
    data: 'a long rambling message',
    tpl: (s) => s,
    llm: mockLlm,
    proxyFetch: mockProxyFetch,
  };

  const result = (await handler(ctx)) as { branch: string; out: unknown };
  if (result.branch !== 'rework') throw new Error('AC8b: expected rework branch');
  const out = result.out as { draft?: unknown; critique?: string };
  if (out.draft !== ctx.data) throw new Error('AC8b: rework must carry original draft');
  if (!out.critique) throw new Error('AC8b: rework must carry critique text');
  console.log('✓ AC8b: lab-rework');
}

// ============================================================================
// AC 9: assembler-модули (E2) — tools пробрасываются в llm, memory подмешивается в prompt
// ============================================================================

async function testAssemblerModulesTools() {
  mockLlmCalls = [];
  const handler = NODE_DEFS.assembler.handler as Handler;

  const ctx: NodeCtx = {
    config: { system: 'Ты помощник.', modules: ['web-search'] },
    data: 'Что нового сегодня?',
    tpl: (s) => s,
    llm: mockLlm,
    proxyFetch: mockProxyFetch,
  };

  await handler(ctx);
  if (!mockLlmCalls[0]?.tools?.includes('web-search')) {
    throw new Error('AC9a: модуль web-search должен уйти в llm({tools})');
  }
  console.log('✓ AC9a: assembler-modules-tools');
}

async function testAssemblerMemoryModule() {
  mockLlmCalls = [];
  const handler = NODE_DEFS.assembler.handler as Handler;

  const ctx: NodeCtx = {
    config: { system: 'Ты помощник.', modules: ['memory'] },
    data: 'Сделай вывод по собранным данным.',
    memory: ['отзыв: отлично', 'отзыв: так себе'],
    tpl: (s) => s,
    llm: mockLlm,
    proxyFetch: mockProxyFetch,
  };

  await handler(ctx);
  const prompt = mockLlmCalls[0]?.prompt ?? '';
  if (!prompt.includes('отзыв: отлично') || !prompt.includes('отзыв: так себе')) {
    throw new Error('AC9b: ctx.memory должен быть подмешан в prompt');
  }
  if (!prompt.includes('Сделай вывод по собранным данным.')) {
    throw new Error('AC9b: исходная задача не должна теряться при подмешивании памяти');
  }
  console.log('✓ AC9b: assembler-memory-module');
}

async function testAssemblerNoMemoryWithoutModule() {
  mockLlmCalls = [];
  const handler = NODE_DEFS.assembler.handler as Handler;

  const ctx: NodeCtx = {
    config: { system: 'Ты помощник.', modules: [] },
    data: 'Задача без памяти.',
    memory: ['это не должно попасть в prompt'],
    tpl: (s) => s,
    llm: mockLlm,
    proxyFetch: mockProxyFetch,
  };

  await handler(ctx);
  const prompt = mockLlmCalls[0]?.prompt ?? '';
  if (prompt.includes('это не должно попасть в prompt')) {
    throw new Error('AC9c: без модуля memory в config.modules — ctx.memory не должен использоваться');
  }
  console.log('✓ AC9c: assembler-memory-ignored-without-module');
}

// ============================================================================
// AC 10: webhook — генерик HTTP-исход (Discord/Slack/GitHub/... одним узлом)
// ============================================================================

async function testWebhookSuccess() {
  mockProxyFetchCalls = [];
  const handler = NODE_DEFS.webhook.handler as Handler;
  if (!handler) throw new Error('webhook handler missing');

  const ctx: NodeCtx = {
    config: {
      url: 'https://discord.com/api/webhooks/test',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"content": "{{text}}"}',
    },
    data: 'hello from factory',
    tpl: (s) => s,
    llm: mockLlm,
    proxyFetch: mockProxyFetch,
  };

  const result = (await handler(ctx)) as { done: boolean };
  if (result.done !== true) throw new Error('AC10a: must return {done:true}');
  const call = mockProxyFetchCalls[mockProxyFetchCalls.length - 1] as any;
  if (!call || call.url !== 'https://discord.com/api/webhooks/test') {
    throw new Error('AC10a: proxyFetch not called with configured url');
  }
  const parsedBody = JSON.parse(call.body);
  if (parsedBody.content !== 'hello from factory') {
    throw new Error('AC10a: {{text}} must resolve against a plain-string payload');
  }

  console.log('✓ AC10a: webhook-success');
}

async function testWebhookError() {
  const handler = NODE_DEFS.webhook.handler as Handler;

  const failingProxyFetch = async () => ({ status: 500, body: { error: 'boom' } });

  const ctx: NodeCtx = {
    config: { url: 'https://example.com/hook', method: 'POST', headers: {}, body: '' },
    data: 'x',
    tpl: (s) => s,
    llm: mockLlm,
    proxyFetch: failingProxyFetch,
  };

  try {
    await handler(ctx);
    throw new Error('AC10b: must throw on non-2xx status');
  } catch (e) {
    if (e instanceof Error && e.message.includes('webhook')) {
      console.log('✓ AC10b: webhook-error');
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
    'duplicator',
    'mixer',
    'silo',
    'furnace',
    'chest',
    'lab',
    'accumulator',
    'webhook',
    'manipulator',
  ] as const;

  for (const kind of kinds) {
    const def = NODE_DEFS[kind];
    if (!def) throw new Error(`AC6: ${kind} not in NODE_DEFS`);
    if (def.kind !== kind) throw new Error(`AC6: ${kind} kind mismatch`);
    if (!def.title) throw new Error(`AC6: ${kind} has no title`);
    if (!def.size) throw new Error(`AC6: ${kind} has no size`);
    if (!def.schema) throw new Error(`AC6: ${kind} has no schema`);
    // accumulator — вне графа лент, handler не требуется (docs/04)
    if (kind !== 'accumulator' && !def.handler) {
      throw new Error(`AC6: ${kind} missing handler`);
    }
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
  await testAssemblerRecipeFallback();
  await testDuplicatorPassthrough();
  await testMixerConcat();
  await testMixerLlm();
  await testMinerUrl();
  await testFurnaceTransform();
  await testFurnaceUndefinedError();
  await testLabPass();
  await testLabRework();
  await testAssemblerModulesTools();
  await testAssemblerMemoryModule();
  await testAssemblerNoMemoryWithoutModule();
  await testWebhookSuccess();
  await testWebhookError();
  await testManipulatorPassthrough();
  testRegistry();

  console.log('✓ All nodes checks passed (B4 AC 1-6, B5 AC 7-8, E2 AC 9, webhook AC 10, manipulator)');
}

// Выполнить проверки
checkNodes().catch((e) => {
  console.error('✗ Nodes check failed:', e);
  throw e;
});
