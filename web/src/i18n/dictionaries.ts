/**
 * Словари локализации UI-оболочки (не бизнес-данные вроде system-промптов рецептов —
 * см. web/src/core/nodes/recipes.ts, там переводится только `label`, не `system`).
 *
 * Плоские строковые ключи с точечной нотацией. Namespace'ы:
 *  - top.*      — TopBar
 *  - hotbar.*   — Hotbar (общие подписи, не названия станков)
 *  - config.*   — ConfigPanel
 *  - result.*   — ResultPanel
 *  - logs.*     — LogsPanel
 *  - bp.*       — BlueprintPanel
 *  - json.*     — JsonView
 *  - toast.*    — тосты (store.ts, runtime.ts, TopBar.tsx)
 *  - error.*    — переводимые тексты ошибок движка (engine.ts не трогаем — там их
 *                 проверяют __checks__/engine.ts дословно; перевод — на стороне отображения
 *                 в runtime.ts через translateEngineError())
 *  - node.<kind>.title           — заголовок станка (Hotbar tooltip + ConfigPanel header)
 *  - field.<kind>.<key>.label    — подпись поля конфига
 *  - field.<kind>.<key>.placeholder — плейсхолдер поля конфига
 *  - option.<kind>.<key>.<value> — подпись опции select
 *  - recipe.<value>.label        — подпись пресета рецепта (НЕ system-промпт)
 *  - module.<id>.label           — подпись MCP-модуля
 */

export type Locale = 'ru' | 'en' | 'zh';

export const LOCALES: Locale[] = ['ru', 'en', 'zh'];

export const LOCALE_NAMES: Record<Locale, string> = {
  ru: 'RU',
  en: 'EN',
  zh: '中文',
};

type Dict = Record<string, string>;

const ru: Dict = {
  'top.run': '▶ Run',
  'top.stop': '⏹ Stop',
  'top.runTitle': 'Space',
  'top.entities': 'ENTITIES',
  'top.energyTitle': 'Энергия: {charge} / {capacity}',
  'top.title': 'no-code-factorio',
  'top.logs': 'Логи',
  'top.logsTitle': 'Показать/скрыть логи',
  'top.blueprints': 'Чертежи',
  'top.blueprintsTitle': 'Показать/скрыть панель чертежей (B)',
  'top.results': 'Результаты',
  'top.resultsTitle': 'Показать/скрыть панель результатов',
  'top.export': 'Export',
  'top.exportTitle': 'Export (JSON)',
  'top.import': 'Import',
  'top.importTitle': 'Import (JSON)',
  'top.demo': 'Demo',
  'top.demoTitle': 'Load demo',
  'top.langTitle': 'Сменить язык интерфейса',

  'toast.stopFactory': 'Останови фабрику',
  'toast.placeMiner': 'Поставь шахту',
  'toast.worldLoaded': 'Фабрика загружена',
  'toast.invalidFileFormat': 'Некорректный формат файла',
  'toast.fileLoadError': 'Ошибка при загрузке файла',
  'toast.demoLoaded': 'Демо-фабрика загружена',
  'toast.demoLoadFailed': 'Не удалось загрузить демо',
  'toast.demoLoadError': 'Ошибка при загрузке демо',
  'toast.webhookCopied': 'Webhook URL скопирован',
  'toast.blueprintCopied': 'Чертёж «{name}» скопирован строкой',
  'toast.blueprintImported': 'Чертёж «{name}» импортирован',
  'toast.blueprintInvalid': 'Некорректная строка чертежа',
  'toast.packetDropped': '✕ пакет упал ({reason})',
  'toast.emptySelection': 'Пустая область — нечего сохранять в чертёж',

  'error.noPower': 'Нет питания',
  'error.insufficientCapacity': 'Не хватает ёмкости аккумулятора: нужно ~{need}, есть {have}',

  'config.closeTitle': 'Закрыть (Esc)',
  'config.modulesLabel': 'Модули (до 3)',
  'config.moduleToggleTitle': '{label} (+{pct}% к расходу энергии станка)',
  'config.triggerMiner': '▶ Вбросить',
  'config.triggerMinerTitle': 'Запустить шахту (доступно при running)',
  'config.webhookUrlLabel': 'Webhook URL',
  'config.copy': 'Copy',
  'config.copyWebhookTitle': 'Copy webhook URL',
  'config.chargeReadout': 'Заряд: {charge} / {capacity}',
  'config.chargeReadoutOffline': 'Заряд: — (фабрика не запущена)',
  'config.recharge': '⚡ Зарядить',
  'config.rechargeTitle': 'Пополнить энергию до максимума (доступно при running)',
  'config.lastIn': 'Последний вход',
  'config.lastOut': 'Последний выход',
  'config.selectPlaceholder': '-- Выбрать --',

  'result.title': 'Результаты',
  'result.clear': 'Clear',
  'result.clearTitle': 'Очистить результаты',
  'result.collapseTitle': 'Свернуть панель',
  'result.empty': 'Пока нет результатов',
  'result.reopenTitle': 'Развернуть панель результатов',
  'result.reopenLabel': 'RESULTS',

  'logs.reopenTitle': 'Показать логи',
  'logs.reopenLabel': 'ЛОГИ',
  'logs.title': 'Логи',
  'logs.clear': 'Clear',
  'logs.clearTitle': 'Очистить логи',
  'logs.collapseTitle': 'Свернуть панель логов',
  'logs.empty': 'Пока пусто',

  'bp.title': 'Чертежи',
  'bp.collapseTitle': 'Свернуть панель (B)',
  'bp.hint': 'Выделить: зажми и потяни ЛКМ по полю фабрики',
  'bp.namePlaceholder': 'Чертёж {n}',
  'bp.save': 'Сохранить ({n})',
  'bp.cancel': 'Отмена',
  'bp.empty': 'Нет чертежей',
  'bp.entitiesCountTitle': '{n} станков',
  'bp.myBlueprints': 'Мои чертежи',
  'bp.library': 'Библиотека',
  'bp.stampTitle': 'Поставить',
  'bp.exportTitle': 'Экспорт строкой',
  'bp.removeTitle': 'Удалить',
  'bp.importPlaceholder': 'Строка чертежа для импорта',
  'bp.load': 'Загрузить',

  'json.copyTitle': 'Скопировать в буфер',
  'json.copy': 'Copy',

  'node.miner.title': 'Шахта / Input',
  'node.assembler.title': 'Сборочный станок / Агент',
  'node.splitter.title': 'Дублер',
  'node.mixer.title': 'Смеситель / Химзавод',
  'node.silo.title': 'Ракета / Output',
  'node.belt.title': 'Конвейер',
  'node.furnace.title': 'Печь / Препроцессор',
  'node.chest.title': 'Сундук / Буфер',
  'node.lab.title': 'Лаборатория / Критик',
  'node.webhook.title': 'Антенна / Webhook (HTTP)',
  'node.manipulator.title': 'Манипулятор',
  'node.accumulator.title': 'Аккумулятор',

  'field.miner.mode.label': 'Источник',
  'option.miner.mode.text': 'Заданный текст',
  'option.miner.mode.url': 'Содержимое URL',
  'option.miner.mode.webhook': 'Внешний вебхук',
  'field.miner.text.label': 'Текст',
  'field.miner.text.placeholder': 'Введите текст',
  'field.miner.url.label': 'URL',
  'field.miner.url.placeholder': 'https://example.com',
  'field.miner.intervalSec.label': 'Интервал (сек)',
  'field.miner.intervalSec.placeholder': '0 = только кнопка',

  'field.assembler.recipe.label': 'Рецепт',
  'field.assembler.system.label': 'Система',
  'field.assembler.system.placeholder': 'System-промпт для LLM',
  'field.assembler.modules.label': 'Модули',
  'field.assembler.modules.placeholder': '[]',

  'field.splitter.mode.label': 'Режим',
  'option.splitter.mode.expr': 'Условие (JS)',
  'option.splitter.mode.llm': 'Спросить LLM',
  'field.splitter.expr.label': 'Выражение',
  'field.splitter.expr.placeholder': 'String(data).length > 500',
  'field.splitter.question.label': 'Вопрос',
  'field.splitter.question.placeholder': 'Это позитивный отзыв?',

  'field.mixer.mode.label': 'Режим',
  'option.mixer.mode.concat': 'Склеить',
  'option.mixer.mode.llm': 'LLM-синтез',
  'field.mixer.prompt.label': 'Промпт (для LLM)',
  'field.mixer.prompt.placeholder': 'Объедини версии в один пост',

  'field.chest.batchSize.label': 'Размер пачки',

  'field.lab.criteria.label': 'Критерии',
  'field.lab.criteria.placeholder': 'Текст вежлив, без воды, до 500 знаков',

  'field.webhook.url.label': 'URL',
  'field.webhook.url.placeholder': 'https://discord.com/api/webhooks/...',
  'field.webhook.method.label': 'Метод',
  'field.webhook.headers.label': 'Заголовки (JSON)',
  'field.webhook.headers.placeholder': '{"authorization": "Bearer ..."}',
  'field.webhook.body.label': 'Тело запроса ({{text}} — payload, {{path.to.field}} — вложенное поле)',
  'field.webhook.body.placeholder': '{"content": "{{text}}"}',

  'field.furnace.code.label': 'Код',
  'field.furnace.code.placeholder': "return String(data).replace(/<[^>]+>/g, '')",

  'field.accumulator.capacity.label': 'Ёмкость (токены)',

  'recipe.summarizer.label': 'Суммаризатор',
  'recipe.translator.label': 'Переводчик на английский',
  'recipe.sentiment.label': 'Классификатор тональности',
  'recipe.critic.label': 'Критик',
  'recipe.copywriter.label': 'Копирайтер',
  'recipe.custom.label': 'Свой рецепт',

  'module.web-search.label': 'Веб-поиск',
  'module.memory.label': 'Память (склад)',
};

const en: Dict = {
  'top.run': '▶ Run',
  'top.stop': '⏹ Stop',
  'top.runTitle': 'Space',
  'top.entities': 'ENTITIES',
  'top.energyTitle': 'Energy: {charge} / {capacity}',
  'top.title': 'no-code-factorio',
  'top.logs': 'Logs',
  'top.logsTitle': 'Show/hide logs',
  'top.blueprints': 'Blueprints',
  'top.blueprintsTitle': 'Show/hide blueprints panel (B)',
  'top.results': 'Results',
  'top.resultsTitle': 'Show/hide results panel',
  'top.export': 'Export',
  'top.exportTitle': 'Export (JSON)',
  'top.import': 'Import',
  'top.importTitle': 'Import (JSON)',
  'top.demo': 'Demo',
  'top.demoTitle': 'Load demo',
  'top.langTitle': 'Switch interface language',

  'toast.stopFactory': 'Stop the factory first',
  'toast.placeMiner': 'Place a miner',
  'toast.worldLoaded': 'Factory loaded',
  'toast.invalidFileFormat': 'Invalid file format',
  'toast.fileLoadError': 'Error loading file',
  'toast.demoLoaded': 'Demo factory loaded',
  'toast.demoLoadFailed': 'Failed to load demo',
  'toast.demoLoadError': 'Error loading demo',
  'toast.webhookCopied': 'Webhook URL copied',
  'toast.blueprintCopied': 'Blueprint "{name}" copied as string',
  'toast.blueprintImported': 'Blueprint "{name}" imported',
  'toast.blueprintInvalid': 'Invalid blueprint string',
  'toast.packetDropped': '✕ packet dropped ({reason})',
  'toast.emptySelection': 'Empty area — nothing to save as a blueprint',

  'error.noPower': 'No power',
  'error.insufficientCapacity': 'Not enough accumulator capacity: need ~{need}, have {have}',

  'config.closeTitle': 'Close (Esc)',
  'config.modulesLabel': 'Modules (up to 3)',
  'config.moduleToggleTitle': '{label} (+{pct}% to machine energy cost)',
  'config.triggerMiner': '▶ Trigger',
  'config.triggerMinerTitle': 'Trigger the miner (available while running)',
  'config.webhookUrlLabel': 'Webhook URL',
  'config.copy': 'Copy',
  'config.copyWebhookTitle': 'Copy webhook URL',
  'config.chargeReadout': 'Charge: {charge} / {capacity}',
  'config.chargeReadoutOffline': 'Charge: — (factory not running)',
  'config.recharge': '⚡ Recharge',
  'config.rechargeTitle': 'Recharge energy to max (available while running)',
  'config.lastIn': 'Last input',
  'config.lastOut': 'Last output',
  'config.selectPlaceholder': '-- Select --',

  'result.title': 'Results',
  'result.clear': 'Clear',
  'result.clearTitle': 'Clear results',
  'result.collapseTitle': 'Collapse dock',
  'result.empty': 'No results yet',
  'result.reopenTitle': 'Expand results dock',
  'result.reopenLabel': 'RESULTS',

  'logs.reopenTitle': 'Show logs',
  'logs.reopenLabel': 'LOGS',
  'logs.title': 'Logs',
  'logs.clear': 'Clear',
  'logs.clearTitle': 'Clear logs',
  'logs.collapseTitle': 'Collapse logs panel',
  'logs.empty': 'Nothing yet',

  'bp.title': 'Blueprints',
  'bp.collapseTitle': 'Collapse dock (B)',
  'bp.hint': 'Select: hold and drag LMB over the factory floor',
  'bp.namePlaceholder': 'Blueprint {n}',
  'bp.save': 'Save ({n})',
  'bp.cancel': 'Cancel',
  'bp.empty': 'No blueprints',
  'bp.entitiesCountTitle': '{n} machines',
  'bp.myBlueprints': 'My blueprints',
  'bp.library': 'Library',
  'bp.stampTitle': 'Stamp',
  'bp.exportTitle': 'Export as string',
  'bp.removeTitle': 'Delete',
  'bp.importPlaceholder': 'Blueprint string to import',
  'bp.load': 'Load',

  'json.copyTitle': 'Copy to clipboard',
  'json.copy': 'Copy',

  'node.miner.title': 'Miner / Input',
  'node.assembler.title': 'Assembler / Agent',
  'node.splitter.title': 'Duplicator',
  'node.mixer.title': 'Mixer / Chemical Plant',
  'node.silo.title': 'Rocket / Output',
  'node.belt.title': 'Belt',
  'node.furnace.title': 'Furnace / Preprocessor',
  'node.chest.title': 'Chest / Buffer',
  'node.lab.title': 'Lab / Critic',
  'node.webhook.title': 'Antenna / Webhook (HTTP)',
  'node.manipulator.title': 'Manipulator',
  'node.accumulator.title': 'Accumulator',

  'field.miner.mode.label': 'Source',
  'option.miner.mode.text': 'Fixed text',
  'option.miner.mode.url': 'URL content',
  'option.miner.mode.webhook': 'External webhook',
  'field.miner.text.label': 'Text',
  'field.miner.text.placeholder': 'Enter text',
  'field.miner.url.label': 'URL',
  'field.miner.url.placeholder': 'https://example.com',
  'field.miner.intervalSec.label': 'Interval (sec)',
  'field.miner.intervalSec.placeholder': '0 = button only',

  'field.assembler.recipe.label': 'Recipe',
  'field.assembler.system.label': 'System',
  'field.assembler.system.placeholder': 'System prompt for the LLM',
  'field.assembler.modules.label': 'Modules',
  'field.assembler.modules.placeholder': '[]',

  'field.splitter.mode.label': 'Mode',
  'option.splitter.mode.expr': 'Condition (JS)',
  'option.splitter.mode.llm': 'Ask LLM',
  'field.splitter.expr.label': 'Expression',
  'field.splitter.expr.placeholder': 'String(data).length > 500',
  'field.splitter.question.label': 'Question',
  'field.splitter.question.placeholder': 'Is this a positive review?',

  'field.mixer.mode.label': 'Mode',
  'option.mixer.mode.concat': 'Concatenate',
  'option.mixer.mode.llm': 'LLM synthesis',
  'field.mixer.prompt.label': 'Prompt (for LLM)',
  'field.mixer.prompt.placeholder': 'Merge the versions into one post',

  'field.chest.batchSize.label': 'Batch size',

  'field.lab.criteria.label': 'Criteria',
  'field.lab.criteria.placeholder': 'Text is polite, no fluff, under 500 characters',

  'field.webhook.url.label': 'URL',
  'field.webhook.url.placeholder': 'https://discord.com/api/webhooks/...',
  'field.webhook.method.label': 'Method',
  'field.webhook.headers.label': 'Headers (JSON)',
  'field.webhook.headers.placeholder': '{"authorization": "Bearer ..."}',
  'field.webhook.body.label': 'Request body ({{text}} — payload, {{path.to.field}} — nested field)',
  'field.webhook.body.placeholder': '{"content": "{{text}}"}',

  'field.furnace.code.label': 'Code',
  'field.furnace.code.placeholder': "return String(data).replace(/<[^>]+>/g, '')",

  'field.accumulator.capacity.label': 'Capacity (tokens)',

  'recipe.summarizer.label': 'Summarizer',
  'recipe.translator.label': 'English translator',
  'recipe.sentiment.label': 'Sentiment classifier',
  'recipe.critic.label': 'Critic',
  'recipe.copywriter.label': 'Copywriter',
  'recipe.custom.label': 'Custom recipe',

  'module.web-search.label': 'Web search',
  'module.memory.label': 'Memory (storage)',
};

const zh: Dict = {
  'top.run': '▶ 运行',
  'top.stop': '⏹ 停止',
  'top.runTitle': '空格键',
  'top.entities': '实体数',
  'top.energyTitle': '能量：{charge} / {capacity}',
  'top.title': 'no-code-factorio',
  'top.logs': '日志',
  'top.logsTitle': '显示/隐藏日志',
  'top.blueprints': '蓝图',
  'top.blueprintsTitle': '显示/隐藏蓝图面板 (B)',
  'top.results': '结果',
  'top.resultsTitle': '显示/隐藏结果面板',
  'top.export': '导出',
  'top.exportTitle': '导出 (JSON)',
  'top.import': '导入',
  'top.importTitle': '导入 (JSON)',
  'top.demo': '演示',
  'top.demoTitle': '加载演示',
  'top.langTitle': '切换界面语言',

  'toast.stopFactory': '请先停止工厂',
  'toast.placeMiner': '请放置一个采矿机',
  'toast.worldLoaded': '工厂已加载',
  'toast.invalidFileFormat': '文件格式不正确',
  'toast.fileLoadError': '加载文件出错',
  'toast.demoLoaded': '演示工厂已加载',
  'toast.demoLoadFailed': '演示加载失败',
  'toast.demoLoadError': '加载演示时出错',
  'toast.webhookCopied': 'Webhook URL 已复制',
  'toast.blueprintCopied': '蓝图「{name}」已复制为字符串',
  'toast.blueprintImported': '蓝图「{name}」已导入',
  'toast.blueprintInvalid': '蓝图字符串无效',
  'toast.packetDropped': '✕ 包丢失（{reason}）',
  'toast.emptySelection': '选区为空 — 没有可保存为蓝图的内容',

  'error.noPower': '电力不足',
  'error.insufficientCapacity': '蓄电容量不足：需要 ~{need}，现有 {have}',

  'config.closeTitle': '关闭 (Esc)',
  'config.modulesLabel': '模块（最多 3 个）',
  'config.moduleToggleTitle': '{label}（+{pct}% 机器能耗）',
  'config.triggerMiner': '▶ 触发',
  'config.triggerMinerTitle': '触发采矿机（运行时可用）',
  'config.webhookUrlLabel': 'Webhook URL',
  'config.copy': '复制',
  'config.copyWebhookTitle': '复制 Webhook URL',
  'config.chargeReadout': '电量：{charge} / {capacity}',
  'config.chargeReadoutOffline': '电量：—（工厂未运行）',
  'config.recharge': '⚡ 充电',
  'config.rechargeTitle': '充电至满（运行时可用）',
  'config.lastIn': '最近输入',
  'config.lastOut': '最近输出',
  'config.selectPlaceholder': '-- 请选择 --',

  'result.title': '结果',
  'result.clear': '清空',
  'result.clearTitle': '清空结果',
  'result.collapseTitle': '收起面板',
  'result.empty': '暂无结果',
  'result.reopenTitle': '展开结果面板',
  'result.reopenLabel': '结果',

  'logs.reopenTitle': '显示日志',
  'logs.reopenLabel': '日志',
  'logs.title': '日志',
  'logs.clear': '清空',
  'logs.clearTitle': '清空日志',
  'logs.collapseTitle': '收起日志面板',
  'logs.empty': '暂无内容',

  'bp.title': '蓝图',
  'bp.collapseTitle': '收起面板 (B)',
  'bp.hint': '选择：在工厂地面按住并拖动鼠标左键',
  'bp.namePlaceholder': '蓝图 {n}',
  'bp.save': '保存（{n}）',
  'bp.cancel': '取消',
  'bp.empty': '暂无蓝图',
  'bp.entitiesCountTitle': '{n} 台机器',
  'bp.myBlueprints': '我的蓝图',
  'bp.library': '蓝图库',
  'bp.stampTitle': '放置',
  'bp.exportTitle': '导出为字符串',
  'bp.removeTitle': '删除',
  'bp.importPlaceholder': '待导入的蓝图字符串',
  'bp.load': '加载',

  'json.copyTitle': '复制到剪贴板',
  'json.copy': '复制',

  'node.miner.title': '采矿机 / 输入',
  'node.assembler.title': '装配机 / 代理',
  'node.splitter.title': '复制器',
  'node.mixer.title': '混合机 / 化工厂',
  'node.silo.title': '火箭 / 输出',
  'node.belt.title': '传送带',
  'node.furnace.title': '熔炉 / 预处理器',
  'node.chest.title': '箱子 / 缓冲区',
  'node.lab.title': '实验室 / 评审',
  'node.webhook.title': '天线 / Webhook (HTTP)',
  'node.manipulator.title': '机械臂',
  'node.accumulator.title': '蓄电池',

  'field.miner.mode.label': '来源',
  'option.miner.mode.text': '固定文本',
  'option.miner.mode.url': 'URL 内容',
  'option.miner.mode.webhook': '外部 Webhook',
  'field.miner.text.label': '文本',
  'field.miner.text.placeholder': '输入文本',
  'field.miner.url.label': 'URL',
  'field.miner.url.placeholder': 'https://example.com',
  'field.miner.intervalSec.label': '间隔（秒）',
  'field.miner.intervalSec.placeholder': '0 = 仅手动触发',

  'field.assembler.recipe.label': '配方',
  'field.assembler.system.label': '系统提示词',
  'field.assembler.system.placeholder': 'LLM 的 system 提示词',
  'field.assembler.modules.label': '模块',
  'field.assembler.modules.placeholder': '[]',

  'field.splitter.mode.label': '模式',
  'option.splitter.mode.expr': '条件 (JS)',
  'option.splitter.mode.llm': '询问 LLM',
  'field.splitter.expr.label': '表达式',
  'field.splitter.expr.placeholder': 'String(data).length > 500',
  'field.splitter.question.label': '问题',
  'field.splitter.question.placeholder': '这是一条正面评价吗？',

  'field.mixer.mode.label': '模式',
  'option.mixer.mode.concat': '拼接',
  'option.mixer.mode.llm': 'LLM 合成',
  'field.mixer.prompt.label': '提示词（用于 LLM）',
  'field.mixer.prompt.placeholder': '把这些版本合并成一篇帖子',

  'field.chest.batchSize.label': '批量大小',

  'field.lab.criteria.label': '评判标准',
  'field.lab.criteria.placeholder': '文本礼貌、无废话、不超过 500 字',

  'field.webhook.url.label': 'URL',
  'field.webhook.url.placeholder': 'https://discord.com/api/webhooks/...',
  'field.webhook.method.label': '方法',
  'field.webhook.headers.label': '请求头 (JSON)',
  'field.webhook.headers.placeholder': '{"authorization": "Bearer ..."}',
  'field.webhook.body.label': '请求体（{{text}} — payload，{{path.to.field}} — 嵌套字段）',
  'field.webhook.body.placeholder': '{"content": "{{text}}"}',

  'field.furnace.code.label': '代码',
  'field.furnace.code.placeholder': "return String(data).replace(/<[^>]+>/g, '')",

  'field.accumulator.capacity.label': '容量（Token）',

  'recipe.summarizer.label': '摘要生成器',
  'recipe.translator.label': '英语翻译',
  'recipe.sentiment.label': '情感分类器',
  'recipe.critic.label': '评论家',
  'recipe.copywriter.label': '文案撰写',
  'recipe.custom.label': '自定义配方',

  'module.web-search.label': '网络搜索',
  'module.memory.label': '记忆（仓库）',
};

export const DICTIONARIES: Record<Locale, Dict> = { ru, en, zh };

/**
 * Подставляет `{param}` в строку словаря значениями из params.
 */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

/**
 * Перевод по ключу для конкретной локали — чистая функция без зависимости от React/Zustand,
 * пригодная и вне React (store.ts, state/runtime.ts).
 * Фоллбэк: локаль -> ru -> сам ключ (чтобы не падать на пропущенном переводе).
 */
export function t(key: string, locale: Locale, params?: Record<string, string | number>): string {
  const dict = DICTIONARIES[locale];
  const template = dict[key] ?? DICTIONARIES.ru[key] ?? key;
  return interpolate(template, params);
}

// engine.ts (core/, чистый TS без i18n) всегда эмитит эти два сообщения по-русски —
// __checks__/engine.ts проверяет их дословно, поэтому сами строки в engine.ts не трогаем.
// Переводим только на стороне отображения (ConfigPanel status.error, runtime.ts toast).
const INSUFFICIENT_CAPACITY_RE = /^Не хватает ёмкости аккумулятора: нужно ~(\d+), есть (\d+)$/;

/**
 * Переводит текст ошибки движка (node-status 'error') для показа пользователю.
 * Неизвестные тексты (ошибки конкретных станков/handler'ов) возвращает как есть.
 */
export function translateEngineError(raw: string, locale: Locale): string {
  if (raw === 'Нет питания') return t('error.noPower', locale);
  const match = raw.match(INSUFFICIENT_CAPACITY_RE);
  if (match) {
    return t('error.insufficientCapacity', locale, { need: match[1], have: match[2] });
  }
  return raw;
}
