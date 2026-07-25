import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { NODE_DEFS } from '../core/nodes';
import { focusEntity } from '../game/camera';
import { tutorialBlocksInput } from '../state/tutorialSteps';
import { useT } from '../i18n';
import './NodeSearch.css';

/**
 * Поиск/фокус по узлам (docs/06): Ctrl+F или кнопка в TopBar открывают поле, ввод
 * kind/id фильтрует список, выбор — select() (открывает ConfigPanel) + плавный перелёт
 * камеры с подсветкой (game/camera.ts). На большом чертеже (demo.json, 21 entity)
 * иначе легко потерять нужный узел за краем экрана.
 */
export function NodeSearch() {
  const t = useT();
  const searchOpen = useStore((state) => state.searchOpen);
  const setSearchOpen = useStore((state) => state.setSearchOpen);
  const entities = useStore((state) => state.entities);
  const select = useStore((state) => state.select);
  const tutorialActive = useStore((state) => state.tutorialActive);
  const tutorialStep = useStore((state) => state.tutorialStep);

  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl/Cmd+F открывает поиск (перехватывает браузерный Find-in-page); Esc закрывает
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (tutorialBlocksInput(useStore.getState())) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setQuery('');
        setActiveIdx(0);
        setSearchOpen(true);
      } else if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, tutorialActive, tutorialStep, setSearchOpen]);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return Object.values(entities)
      .filter((e) => e.id.toLowerCase().includes(q) || e.kind.toLowerCase().includes(q))
      .slice(0, 20);
  }, [entities, query]);

  if (!searchOpen) return null;

  const handlePick = (entityId: string) => {
    const entity = entities[entityId];
    if (!entity) return;
    select(entityId);
    const def = NODE_DEFS[entity.kind];
    focusEntity(entity.pos, def?.size ?? { w: 1, h: 1 });
    setSearchOpen(false);
  };

  const handleKeyDownInput = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = matches[activeIdx] ?? matches[0];
      if (pick) handlePick(pick.id);
    }
    // Escape закрывается общим window-хендлером выше
  };

  return (
    <div className="node-search">
      <input
        ref={inputRef}
        className="node-search-input"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIdx(0);
        }}
        onKeyDown={handleKeyDownInput}
        // Небольшая задержка — клик по результату (onMouseDown) успевает сработать
        // раньше, чем blur закроет панель
        onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
        placeholder={t('search.placeholder')}
      />
      {matches.length > 0 && (
        <div className="node-search-results">
          {matches.map((entity, idx) => {
            const def = NODE_DEFS[entity.kind];
            return (
              <div
                key={entity.id}
                className={`node-search-result ${idx === activeIdx ? 'active' : ''}`}
                onMouseDown={() => handlePick(entity.id)}
                onMouseEnter={() => setActiveIdx(idx)}
              >
                <span className="node-search-kind" data-kind={entity.kind}>{entity.kind}</span>
                <span className="node-search-title">{def?.title ?? entity.kind}</span>
                <span className="node-search-id">#{entity.id}</span>
              </div>
            );
          })}
        </div>
      )}
      {query.trim() && matches.length === 0 && (
        <div className="node-search-empty">{t('search.empty')}</div>
      )}
    </div>
  );
}
