import React from 'react';
import { useStore } from '../state/store';
import { LEVELS, isLevelUnlocked } from '../core/levels/definitions';
import { startLevel, exitLevel } from '../state/runtime';
import { useT } from '../i18n';
import './LevelComplete.css';

/**
 * Модалка успеха уровня — звёзды за эффективность (число сущностей на момент успеха,
 * см. core/levels/stars.ts::computeStars), «Следующий»/«Переиграть»/«В меню».
 * Управляется store.levelCompleteInfo (транзиент, ставится из runtime.ts::evaluateActiveLevel).
 */
export function LevelComplete() {
  const t = useT();
  const info = useStore((s) => s.levelCompleteInfo);
  const setInfo = useStore((s) => s.setLevelCompleteInfo);
  const setLevelPanelOpen = useStore((s) => s.setLevelPanelOpen);
  const progress = useStore((s) => s.levelProgress);

  if (!info) return null;
  const index = LEVELS.findIndex((l) => l.id === info.id);
  const level = LEVELS[index];
  const nextCandidate = LEVELS[index + 1];
  // «Следующий» не должен вести на ещё не разлоченный bonus-уровень (editorial) — та
  // же проверка, что и в LevelPanel.tsx, см. core/levels/definitions.ts::isLevelUnlocked.
  const next = nextCandidate && isLevelUnlocked(nextCandidate, progress) ? nextCandidate : undefined;

  const handleNext = () => {
    if (!next) return;
    setInfo(null);
    startLevel(next.id);
  };

  const handleRetry = () => {
    setInfo(null);
    startLevel(info.id);
  };

  const handleMenu = () => {
    setInfo(null);
    exitLevel();
    setLevelPanelOpen(true);
  };

  return (
    <div className="level-complete-overlay">
      <div className="level-complete-card">
        <div className="level-complete-title">{t('level.complete.title')}</div>
        <div className="level-complete-name">{level ? t(level.titleKey) : ''}</div>
        <div className="level-complete-stars">
          {[1, 2, 3].map((n) => (
            <span key={n} className={n <= info.stars ? 'level-complete-star filled' : 'level-complete-star'}>
              {n <= info.stars ? '★' : '☆'}
            </span>
          ))}
        </div>
        <div className="level-complete-actions">
          {next && (
            <button className="level-complete-btn primary" onClick={handleNext}>
              {t('level.complete.next')}
            </button>
          )}
          <button className="level-complete-btn" onClick={handleRetry}>
            {t('level.complete.retry')}
          </button>
          <button className="level-complete-btn" onClick={handleMenu}>
            {t('level.complete.menu')}
          </button>
        </div>
      </div>
    </div>
  );
}
