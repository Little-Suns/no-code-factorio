import React from 'react';
import { useStore } from '../state/store';
import { useT } from '../i18n';
import './LogsPanel.css';

export function LogsPanel() {
  const t = useT();
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
        title={t('logs.reopenTitle')}
      >
        &#9888; {t('logs.reopenLabel')} {logsUnread ? '●' : ''}
      </button>
    );
  }

  const items = [...toasts].reverse(); // новые сверху

  return (
    <div className="logs-panel">
      <div className="logs-header">
        <h3 className="logs-title">{t('logs.title')}</h3>
        <div className="logs-controls">
          <button className="logs-clear" onClick={clearLogs} disabled={items.length === 0} title={t('logs.clearTitle')}>
            {t('logs.clear')}
          </button>
          <button className="logs-close" onClick={() => setIsOpen(false)} title={t('logs.collapseTitle')}>
            &#9652;
          </button>
        </div>
      </div>

      <div className="logs-content">
        {items.length === 0 ? (
          <div className="logs-empty">{t('logs.empty')}</div>
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
