import React from 'react';
import { useStore } from '../state/store';
import { LEVELS, isLevelUnlocked } from '../core/levels/definitions';
import { startLevel } from '../state/runtime';
import { useT } from '../i18n';
import './LevelPanel.css';

function StarRow({ stars }: { stars: 0 | 1 | 2 | 3 }) {
  return (
    <span className="level-stars">
      {[1, 2, 3].map((n) => (
        <span key={n} className={n <= stars ? 'level-star filled' : 'level-star'}>
          {n <= stars ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}

/**
 * Экран выбора уровня — модалка поверх всего (кроме Tutorial), список карточек по
 * LEVELS. Обычные уровни доступны сразу все и в любом порядке; bonus-уровень
 * (editorial) разлочен только когда у ВСЕХ обычных уровней есть прогресс со
 * stars > 0 (см. store.ts — просто наличие ключа не означает прохождение, если
 * игрок только раскрывал подсказки, stars будет 0).
 */
export function LevelPanel() {
  const t = useT();
  const isOpen = useStore((s) => s.levelPanelOpen);
  const setOpen = useStore((s) => s.setLevelPanelOpen);
  const progress = useStore((s) => s.levelProgress);

  if (!isOpen) return null;

  const handlePick = (id: string, unlocked: boolean) => {
    if (!unlocked) return;
    startLevel(id);
    setOpen(false);
  };

  return (
    <div className="level-panel-overlay" onClick={() => setOpen(false)}>
      <div className="level-panel" onClick={(e) => e.stopPropagation()}>
        <div className="level-panel-header">
          <h3 className="level-panel-title">{t('level.panel.title')}</h3>
          <button className="level-panel-close" onClick={() => setOpen(false)} title={t('level.panel.closeTitle')}>
            ✕
          </button>
        </div>
        <div className="level-grid">
          {LEVELS.map((level, i) => {
            const unlocked = isLevelUnlocked(level, progress);
            const stars = progress[level.id]?.stars ?? 0;
            return (
              <button
                key={level.id}
                className={`level-card ${unlocked ? '' : 'locked'} ${level.bonus ? 'bonus' : ''}`}
                onClick={() => handlePick(level.id, unlocked)}
                disabled={!unlocked}
              >
                {level.bonus && <span className="level-card-bonus-badge">{t('level.panel.bonusBadge')}</span>}
                <span className="level-card-index">{i + 1}</span>
                <span className="level-card-name">{unlocked ? t(level.titleKey) : t('level.panel.locked')}</span>
                {unlocked ? <StarRow stars={stars} /> : <span className="level-card-lock">🔒</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
