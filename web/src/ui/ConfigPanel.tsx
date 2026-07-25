import React, { useMemo } from 'react';
import { useStore } from '../state/store';
import { NODE_DEFS } from '../core/nodes';
import { triggerMiner, rechargeAccumulator } from '../state/runtime';
import { MODULE_DEFS } from '../core/nodes/modules';
import { RECIPES } from '../core/nodes/recipes';
import { JsonView } from './JsonView';
import { useT, translateEngineError } from '../i18n';
import './ConfigPanel.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8787';

export function ConfigPanel() {
  const t = useT();
  const selectedEntityId = useStore((state) => state.selectedEntityId);
  const entities = useStore((state) => state.entities);
  const running = useStore((state) => state.running);
  const nodeStatus = useStore((state) => state.nodeStatus);
  const energy = useStore((state) => state.energy);
  const setConfig = useStore((state) => state.setConfig);
  const select = useStore((state) => state.select);
  const locale = useStore((state) => state.locale);

  const entity = selectedEntityId ? entities[selectedEntityId] : null;
  const def = entity ? NODE_DEFS[entity.kind] : null;
  const status = entity ? nodeStatus[entity.id] ?? { status: 'idle' as const } : { status: 'idle' as const };

  const webhookUrl = useMemo(() => {
    if (entity?.kind === 'miner' && selectedEntityId) {
      return `${SERVER_URL}/webhook/${selectedEntityId}`;
    }
    return null;
  }, [entity, selectedEntityId]);

  // Задвижка: полностью съезжает за экран, когда ничего не выбрано (дизайн-макет Factory.exe) —
  // не занимает место фабрики впустую, в отличие от прежнего варианта с плейсхолдером-заглушкой.
  if (!entity || !def) {
    return <div className="config-panel" />;
  }

  // Данные схемы (NODE_DEFS/RECIPES/MODULE_DEFS) живут в core/ и не знают про локаль —
  // текст оттуда используем только как фоллбэк, если для конкретного ключа перевода нет
  // (t() возвращает сам ключ, если не нашёл строку ни в текущей локали, ни в ru).
  const tOr = (key: string, fallback: string) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };
  const nodeTitle = tOr(`node.${entity.kind}.title`, def.title);
  const fieldLabel = (fieldKey: string, fallback: string) =>
    tOr(`field.${entity.kind}.${fieldKey}.label`, fallback);
  const fieldPlaceholder = (fieldKey: string, fallback?: string) =>
    fallback === undefined ? undefined : tOr(`field.${entity.kind}.${fieldKey}.placeholder`, fallback);
  const optionLabel = (fieldKey: string, value: string, fallback: string) =>
    tOr(`option.${entity.kind}.${fieldKey}.${value}`, fallback);

  const handleConfigChange = (key: string, value: unknown) => {
    const newConfig = { ...entity.config, [key]: value };
    setConfig(entity.id, newConfig);
  };

  const handleTriggerMiner = () => {
    if (running && entity.kind === 'miner') {
      triggerMiner(entity.id);
    }
  };

  const handleRecharge = () => {
    if (running && entity.kind === 'accumulator') {
      rechargeAccumulator();
    }
  };

  const handleToggleModule = (moduleId: string) => {
    const current = (entity.config['modules'] as string[]) || [];
    const next = current.includes(moduleId)
      ? current.filter((m) => m !== moduleId)
      : current.length < 3 // до 3 модулей-MCP на станок (docs/05)
        ? [...current, moduleId]
        : current;
    handleConfigChange('modules', next);
  };

  const handleCopyWebhook = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      useStore.getState().toast(t('toast.webhookCopied'));
    }
  };

  return (
    <div className="config-panel open">
      <div className="config-header">
        <div className="config-title">
          <span className="config-kind" data-kind={entity.kind}>{nodeTitle}</span>
          <span className="config-type">{entity.kind}</span>
        </div>
        <button className="config-close" onClick={() => select(null)} title={t('config.closeTitle')}>
          ✕
        </button>
      </div>

      <div className="config-content">
        {/* Основные поля конфига */}
        <div className="config-fields">
          {def.schema.map((field) => {
            // modules у assembler рендерится отдельным блоком переключателей ниже, не сырым JSON
            if (entity.kind === 'assembler' && field.key === 'modules') return null;
            return (
            <div key={field.key} className="config-field">
              <label className="config-label">{fieldLabel(field.key, field.label)}</label>

              {field.type === 'text' && (
                <input
                  type="text"
                  className="config-input"
                  value={(entity.config[field.key] as string) || ''}
                  onChange={(e) => handleConfigChange(field.key, e.target.value)}
                  placeholder={fieldPlaceholder(field.key, field.placeholder)}
                  disabled={running}
                />
              )}

              {field.type === 'number' && (
                <input
                  type="number"
                  className="config-input"
                  value={(entity.config[field.key] as number) || 0}
                  onChange={(e) => handleConfigChange(field.key, parseFloat(e.target.value) || 0)}
                  disabled={running}
                />
              )}

              {field.type === 'textarea' && (
                <textarea
                  className="config-textarea"
                  rows={6}
                  value={(entity.config[field.key] as string) || ''}
                  onChange={(e) => handleConfigChange(field.key, e.target.value)}
                  placeholder={fieldPlaceholder(field.key, field.placeholder)}
                  disabled={running}
                />
              )}

              {field.type === 'json' && (
                <textarea
                  className="config-textarea config-json"
                  rows={4}
                  value={
                    typeof entity.config[field.key] === 'string'
                      ? (entity.config[field.key] as string)
                      : JSON.stringify(entity.config[field.key] || {}, null, 2)
                  }
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      handleConfigChange(field.key, parsed);
                    } catch {
                      // Пока это просто строка в конфиге
                      handleConfigChange(field.key, e.target.value);
                    }
                  }}
                  placeholder={fieldPlaceholder(field.key, field.placeholder)}
                  disabled={running}
                />
              )}

              {field.type === 'select' && field.options && (
                <select
                  className="config-select"
                  value={(entity.config[field.key] as string) || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Выбор рецепта у assembler: handler читает config.system, а не config.recipe,
                    // поэтому подставляем system-промпт пресета ОДНИМ обновлением (recipe+system
                    // вместе — два раздельных handleConfigChange затёрли бы друг друга из-за
                    // устаревшего entity.config в замыкании). Для 'custom' system не трогаем —
                    // у него пустой пресет, и это стёрло бы то, что пользователь уже написал.
                    if (field.key === 'recipe' && entity.kind === 'assembler') {
                      const recipe = RECIPES.find((r) => r.value === value);
                      if (recipe && recipe.value !== 'custom') {
                        setConfig(entity.id, { ...entity.config, recipe: value, system: recipe.system });
                      } else {
                        handleConfigChange('recipe', value);
                      }
                    } else {
                      handleConfigChange(field.key, value);
                    }
                  }}
                  disabled={running}
                >
                  <option value="">{t('config.selectPlaceholder')}</option>
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {/* Рецепты assembler переводятся отдельным неймспейсом recipe.<value>.label
                          (RECIPES живут в core/nodes/recipes.ts вместе с system-промптом,
                          который НЕ переводим — это бизнес-данные, а не UI-текст) */}
                      {field.key === 'recipe' && entity.kind === 'assembler'
                        ? tOr(`recipe.${opt.value}.label`, opt.label)
                        : optionLabel(field.key, opt.value, opt.label)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            );
          })}
        </div>

        {/* Спец-блок для assembler (E2): модули как переключатели, не сырой JSON */}
        {entity.kind === 'assembler' && (
          <div className="config-special">
            <label className="config-label">{t('config.modulesLabel')}</label>
            <div className="module-toggles">
              {MODULE_DEFS.map((mod) => {
                const active = ((entity.config['modules'] as string[]) || []).includes(mod.id);
                const modLabel = tOr(`module.${mod.id}.label`, mod.label);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    className={`module-toggle ${active ? 'active' : ''}`}
                    onClick={() => handleToggleModule(mod.id)}
                    disabled={running}
                    title={t('config.moduleToggleTitle', { label: modLabel, pct: Math.round(mod.energyCost * 100) })}
                  >
                    {modLabel}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Спец-блоки для miner */}
        {entity.kind === 'miner' && (
          <div className="config-special">
            <button
              className="trigger-miner"
              onClick={handleTriggerMiner}
              disabled={!running}
              title={t('config.triggerMinerTitle')}
            >
              {t('config.triggerMiner')}
            </button>

            {entity.config['mode'] === 'webhook' && webhookUrl && (
              <div className="webhook-section">
                <label className="config-label">{t('config.webhookUrlLabel')}</label>
                <div className="webhook-url-group">
                  <input
                    type="text"
                    className="config-input webhook-url"
                    value={webhookUrl}
                    readOnly
                  />
                  <button
                    className="webhook-copy"
                    onClick={handleCopyWebhook}
                    title={t('config.copyWebhookTitle')}
                  >
                    {t('config.copy')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Спец-блок для accumulator (E1) */}
        {entity.kind === 'accumulator' && (
          <div className="config-special">
            <div className="energy-readout">
              {energy
                ? t('config.chargeReadout', { charge: Math.round(energy.charge), capacity: Math.round(energy.capacity) })
                : t('config.chargeReadoutOffline')}
            </div>
            <button
              className="trigger-miner"
              onClick={handleRecharge}
              disabled={!running}
              title={t('config.rechargeTitle')}
            >
              {t('config.recharge')}
            </button>
          </div>
        )}

        {/* Статус */}
        <div className="config-status">
          <div className="status-badge" data-status={status.status || 'idle'}>
            {status.status || 'idle'}
          </div>
          {status.error && (
            <div className="status-error">{translateEngineError(status.error, locale)}</div>
          )}
        </div>

        {/* Последний вход/выход */}
        {(status.lastIn !== undefined || status.lastOut !== undefined) && (
          <div className="config-io">
            {status.lastIn !== undefined && (
              <details className="io-collapsible">
                <summary>{t('config.lastIn')}</summary>
                <JsonView value={status.lastIn} />
              </details>
            )}
            {status.lastOut !== undefined && (
              <details className="io-collapsible">
                <summary>{t('config.lastOut')}</summary>
                <JsonView value={status.lastOut} />
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
