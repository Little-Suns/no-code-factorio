import React, { useRef, useEffect } from 'react';
import { useStore } from '../state/store';
import { startRun, stopRun } from '../state/runtime';
import type { Entity } from '../core/types';
import './TopBar.css';

export function TopBar() {
  const running = useStore((state) => state.running);
  const entities = useStore((state) => state.entities);
  const loadWorld = useStore((state) => state.loadWorld);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const entityCount = Object.keys(entities).length;

  // Хоткей Space для Run/Stop (не в input'ах)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
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
          {entityCount}
        </span>

        <div className={`status-indicator ${running ? 'active' : ''}`} />
      </div>

      <div className="top-bar-center">
        <span className="top-bar-title">no-code-factorio</span>
      </div>

      <div className="top-bar-right">
        <button className="icon-button" onClick={handleExport} title="Export (JSON)">
          ↓
        </button>
        <button className="icon-button" onClick={handleImport} title="Import (JSON)">
          ↑
        </button>
        <button className="icon-button" onClick={handleLoadDemo} title="Load demo">
          🎲
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
