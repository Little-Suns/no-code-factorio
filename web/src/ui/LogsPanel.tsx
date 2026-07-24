import React from 'react';
import { useStore } from '../state/store';
import './LogsPanel.css';

export function LogsPanel() {
  const isOpen = useStore((state) => state.logsPanelOpen);
  const setIsOpen = useStore((state) => state.setLogsPanelOpen);
  const logsUnread = useStore((state) => state.logsUnread);
  const toasts = useStore((state) => state.toasts);
  const clearLogs = useStore((state) => state.clearLogs);

  if (!isOpen) {
    return (
      <button
        className={`logs-reopen ${logsUnread ? 'unread' : ''}`}
        onClick={() => setIsOpen(true)}
        title="Показать логи"
      >
        &#9888; ЛОГИ {logsUnread ? '●' : ''}
      </button>
    );
  }

  const items = [...toasts].reverse(); // новые сверху

  return (
    <div className="logs-panel">
      <div className="logs-header">
        <h3 className="logs-title">Логи</h3>
        <div className="logs-controls">
          <button className="logs-clear" onClick={clearLogs} disabled={items.length === 0} title="Очистить логи">
            Clear
          </button>
          <button className="logs-close" onClick={() => setIsOpen(false)} title="Свернуть панель логов">
            &#9652;
          </button>
        </div>
      </div>

      <div className="logs-content">
        {items.length === 0 ? (
          <div className="logs-empty">Пока пусто</div>
        ) : (
          <div className="logs-list">
            {items.map((t) => (
              <div key={t.id} className="logs-item">
                <div className="logs-time">{new Date(t.at).toLocaleTimeString()}</div>
                <div className="logs-text">{t.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
