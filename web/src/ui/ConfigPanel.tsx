import React, { useMemo } from 'react';
import { useStore } from '../state/store';
import { NODE_DEFS } from '../core/nodes';
import { triggerMiner } from '../state/runtime';
import { JsonView } from './JsonView';
import './ConfigPanel.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8787';

export function ConfigPanel() {
  const selectedEntityId = useStore((state) => state.selectedEntityId);
  const entities = useStore((state) => state.entities);
  const running = useStore((state) => state.running);
  const nodeStatus = useStore((state) => state.nodeStatus);
  const setConfig = useStore((state) => state.setConfig);
  const select = useStore((state) => state.select);

  const entity = selectedEntityId ? entities[selectedEntityId] : null;
  const def = entity ? NODE_DEFS[entity.kind] : null;
  const status = entity ? nodeStatus[entity.id] ?? { status: 'idle' as const } : { status: 'idle' as const };

  const webhookUrl = useMemo(() => {
    if (entity?.kind === 'miner' && selectedEntityId) {
      return `${SERVER_URL}/webhook/${selectedEntityId}`;
    }
    return null;
  }, [entity, selectedEntityId]);

  if (!entity || !def) {
    return <div className="config-panel empty">Выберите станок</div>;
  }

  const handleConfigChange = (key: string, value: unknown) => {
    const newConfig = { ...entity.config, [key]: value };
    setConfig(entity.id, newConfig);
  };

  const handleTriggerMiner = () => {
    if (running && entity.kind === 'miner') {
      triggerMiner(entity.id);
    }
  };

  const handleCopyWebhook = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      useStore.getState().toast('Webhook URL скопирован');
    }
  };

  return (
    <div className="config-panel">
      <div className="config-header">
        <div className="config-title">
          <span className="config-kind">{def.title}</span>
          <span className="config-type">{entity.kind}</span>
        </div>
        <button className="config-close" onClick={() => select(null)} title="Close (Esc)">
          ✕
        </button>
      </div>

      <div className="config-content">
        {/* Основные поля конфига */}
        <div className="config-fields">
          {def.schema.map((field) => (
            <div key={field.key} className="config-field">
              <label className="config-label">{field.label}</label>

              {field.type === 'text' && (
                <input
                  type="text"
                  className="config-input"
                  value={(entity.config[field.key] as string) || ''}
                  onChange={(e) => handleConfigChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
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
                  placeholder={field.placeholder}
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
                  placeholder={field.placeholder}
                  disabled={running}
                />
              )}

              {field.type === 'select' && field.options && (
                <select
                  className="config-select"
                  value={(entity.config[field.key] as string) || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    handleConfigChange(field.key, value);
                    // Если это выбор рецепта, подставить system-промпт
                    if (field.key === 'recipe' && entity.kind === 'assembler') {
                      const selectedOption = field.options?.find((opt) => opt.value === value);
                      if (selectedOption?.label) {
                        // Извлекаем system из опции (это лучше сделать в NODE_DEFS если поддерживается)
                        // Пока просто обновляем рецепт
                      }
                    }
                  }}
                  disabled={running}
                >
                  <option value="">-- Select --</option>
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>

        {/* Спец-блоки для miner */}
        {entity.kind === 'miner' && (
          <div className="config-special">
            <button
              className="trigger-miner"
              onClick={handleTriggerMiner}
              disabled={!running}
              title="Запустить шахту (доступно при running)"
            >
              ▶ Вбросить
            </button>

            {entity.config['mode'] === 'webhook' && webhookUrl && (
              <div className="webhook-section">
                <label className="config-label">Webhook URL</label>
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
                    title="Copy webhook URL"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Статус */}
        <div className="config-status">
          <div className="status-badge" data-status={status.status || 'idle'}>
            {status.status || 'idle'}
          </div>
          {status.error && <div className="status-error">{status.error}</div>}
        </div>

        {/* Последний вход/выход */}
        {(status.lastIn !== undefined || status.lastOut !== undefined) && (
          <div className="config-io">
            {status.lastIn !== undefined && (
              <details className="io-collapsible">
                <summary>Последний вход</summary>
                <JsonView value={status.lastIn} />
              </details>
            )}
            {status.lastOut !== undefined && (
              <details className="io-collapsible">
                <summary>Последний выход</summary>
                <JsonView value={status.lastOut} />
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
