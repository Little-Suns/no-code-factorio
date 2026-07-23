/**
 * MODULE_DEFS — MCP-модули для слотов assembler (E2, усиление).
 * Модуль = подключённый MCP-инструмент, который агент может вызвать посреди хода,
 * не меняя основной рецепт (docs/05). Каждый вставленный модуль повышает расход
 * энергии станка — см. Engine.getEnergyCost (×0.5 за модуль, docs/04); energyCost
 * здесь — то же число для честной подписи в ConfigPanel (docs/06).
 */

export interface ModuleDef {
  id: string;
  label: string;
  energyCost: number;
}

export const MODULE_DEFS: ModuleDef[] = [
  {
    id: 'web-search',
    label: 'Веб-поиск',
    energyCost: 0.5, // сервер: :online-суффикс модели на OpenRouter (docs/07)
  },
  {
    id: 'memory',
    label: 'Память (склад)',
    energyCost: 0.5, // снапшот содержимого сундуков подмешивается в prompt клиентом (engine.ts)
  },
];
