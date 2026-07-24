import React, { useRef, useEffect } from 'react';
import { useStore } from '../state/store';
import { startRun, stopRun } from '../state/runtime';
import type { Entity } from '../core/types';
import './TopBar.css';

const ENERGY_SEGMENTS = 10;

export function TopBar() {
  const running = useStore((state) => state.running);
  const entities = useStore((state) => state.entities);
  const loadWorld = useStore((state) => state.loadWorld);
  const energy = useStore((state) => state.energy);
  const blueprintPanelOpen = useStore((state) => state.blueprintPanelOpen);
  const setBlueprintPanelOpen = useStore((state) => state.setBlueprintPanelOpen);
  const resultPanelOpen = useStore((state) => state.resultPanelOpen);
  const setResultPanelOpen = useStore((state) => state.setResultPanelOpen);
  const logsPanelOpen = useStore((state) => state.logsPanelOpen);
  const setLogsPanelOpen = useStore((state) => state.setLogsPanelOpen);
  const logsUnread = useStore((state) => state.logsUnread);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const entityCount = Object.keys(entities).length;
  const litSegments = energy ? Math.round((energy.charge / energy.capacity) * ENERGY_SEGMENTS) : 0;

  // Хоткей Space для Run/Stop (не в input'ах)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        if (e.repeat) return; // автоповтор ОС при удержании — иначе спам startRun()/stopRun()
        if (running) {
          stopRun();
        } else {
          startRun();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [running]);

  const handleRun = () => {
    if (running) {
      stopRun();
    } else {
      startRun();
    }
  };

  const handleExport = () => {
    const world = { version: 1, entities: Object.values(entities) };
    const json = JSON.stringify(world, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'factory.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const world = JSON.parse(content);
        if (world.version === 1 && Array.isArray(world.entities)) {
          loadWorld(world.entities);
          useStore.getState().toast('Фабрика загружена');
        } else {
          useStore.getState().toast('Некорректный формат файла');
        }
      } catch (err) {
        useStore.getState().toast('Ошибка при загрузке файла');
      }
    };
    reader.readAsText(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLoadDemo = async () => {
    try {
      const res = await fetch('/demo.json');
      if (!res.ok) {
        useStore.getState().toast('Не удалось загрузить демо');
        return;
      }
      const world = await res.json();
      loadWorld(world.entities);
      useStore.getState().toast('Демо-фабрика загружена');
    } catch (err) {
      useStore.getState().toast('Ошибка при загрузке демо');
    }
  };

  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <button
          className={`run-button ${running ? 'running' : ''}`}
          onClick={handleRun}
          title="Space"
        >
          {running ? '⏹ Stop' : '▶ Run'}
        </button>

        <span className="entity-counter" title={`Entities: ${entityCount}`}>
          <span>ENTITIES</span>
          <span className="entity-counter-value">{entityCount}</span>
        </span>

        <div className={`status-indicator ${running ? 'active' : ''}`} />

        {energy && (
          <div
            className="energy-bar"
            title={`Энергия: ${Math.round(energy.charge)} / ${Math.round(energy.capacity)}`}
          >
            <span className="energy-bar-icon">⚡</span>
            <div className="energy-bar-track">
              {Array.from({ length: ENERGY_SEGMENTS }, (_, i) => (
                <div key={i} className={`energy-segment ${i < litSegments ? 'lit' : ''}`} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="top-bar-center">
        <span className="top-bar-title">no-code-factorio</span>
      </div>

      <div className="top-bar-right">
        <button
          className={`icon-button ${logsPanelOpen ? 'active' : ''} ${logsUnread ? 'unread' : ''}`}
          onClick={() => setLogsPanelOpen(!logsPanelOpen)}
          title="Показать/скрыть логи"
        >
          ⚠ Логи
        </button>
        <button
          className={`icon-button ${blueprintPanelOpen ? 'active' : ''}`}
          onClick={() => setBlueprintPanelOpen(!blueprintPanelOpen)}
          title="Показать/скрыть панель чертежей (B)"
        >
          ▤ Чертежи
        </button>
        <button
          className={`icon-button ${resultPanelOpen ? 'active' : ''}`}
          onClick={() => setResultPanelOpen(!resultPanelOpen)}
          title="Показать/скрыть панель результатов"
        >
          ▥ Результаты
        </button>
        <button className="icon-button" onClick={handleExport} title="Export (JSON)">
          ↓ Export
        </button>
        <button className="icon-button" onClick={handleImport} title="Import (JSON)">
          ↑ Import
        </button>
        <button className="icon-button" onClick={handleLoadDemo} title="Load demo">
          🎲 Demo
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}
