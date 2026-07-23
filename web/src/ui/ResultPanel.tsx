import React, { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { JsonView } from './JsonView';
import './ResultPanel.css';

export function ResultPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const results = useStore((state) => state.results);
  const selectedEntityId = useStore((state) => state.selectedEntityId);
  const entities = useStore((state) => state.entities);

  // Открыться автоматически при новом result от silo
  useEffect(() => {
    const silos = Object.values(entities).filter((e) => e.kind === 'silo');
    for (const silo of silos) {
      if (results[silo.id]?.length) {
        setIsOpen(true);
        break;
      }
    }
  }, [results, entities]);

  // Получить результаты активного silo
  const activeSilo =
    selectedEntityId && useStore.getState().entities[selectedEntityId]?.kind === 'silo'
      ? selectedEntityId
      : Object.values(useStore.getState().entities).find((e) => e.kind === 'silo')?.id;

  const siloResults = activeSilo ? results[activeSilo] || [] : [];

  const handleClearResults = () => {
    if (activeSilo) {
      const state = useStore.getState();
      const newResults = { ...state.results };
      delete newResults[activeSilo];
      useStore.setState({ results: newResults });
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="result-panel">
      <div className="result-header">
        <h3 className="result-title">Results</h3>
        <div className="result-controls">
          <button
            className="result-clear"
            onClick={handleClearResults}
            disabled={siloResults.length === 0}
            title="Clear results"
          >
            Clear
          </button>
          <button className="result-close" onClick={handleClose} title="Close">
            ✕
          </button>
        </div>
      </div>

      <div className="result-content">
        {siloResults.length === 0 ? (
          <div className="result-empty">No results yet</div>
        ) : (
          <div className="result-list">
            {siloResults.map((result, idx) => {
              const time = new Date(result.at).toLocaleTimeString();
              return (
                <div key={idx} className="result-item">
                  <div className="result-time">{time}</div>
                  <JsonView value={result.data} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
