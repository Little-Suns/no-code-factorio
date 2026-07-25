import React, { useRef, useEffect } from 'react';
import { useStore } from '../state/store';
import { startRun, stopRun } from '../state/runtime';
import type { Entity } from '../core/types';
import { useT, LOCALES, LOCALE_NAMES } from '../i18n';
import './TopBar.css';

const ENERGY_SEGMENTS = 10;

export function TopBar() {
  const t = useT();
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
  const locale = useStore((state) => state.locale);
  const setLocale = useStore((state) => state.setLocale);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCycleLocale = () => {
    const idx = LOCALES.indexOf(locale);
    setLocale(LOCALES[(idx + 1) % LOCALES.length]);
  };

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
          useStore.getState().toast(t('toast.worldLoaded'));
        } else {
          useStore.getState().toast(t('toast.invalidFileFormat'));
        }
      } catch (err) {
        useStore.getState().toast(t('toast.fileLoadError'));
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
        useStore.getState().toast(t('toast.demoLoadFailed'));
        return;
      }
      const world = await res.json();
      loadWorld(world.entities);
      useStore.getState().toast(t('toast.demoLoaded'));
    } catch (err) {
      useStore.getState().toast(t('toast.demoLoadError'));
    }
  };

  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <button
          className={`run-button ${running ? 'running' : ''}`}
          onClick={handleRun}
          title={t('top.runTitle')}
        >
          {running ? t('top.stop') : t('top.run')}
        </button>

        <span className="entity-counter" title={`${t('top.entities')}: ${entityCount}`}>
          <span>{t('top.entities')}</span>
          <span className="entity-counter-value">{entityCount}</span>
        </span>

        <div className={`status-indicator ${running ? 'active' : ''}`} />

        {energy && (
          <div
            className="energy-bar"
            title={t('top.energyTitle', { charge: Math.round(energy.charge), capacity: Math.round(energy.capacity) })}
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
        <span className="top-bar-title">{t('top.title')}</span>
      </div>

      <div className="top-bar-right">
        <button
          className="icon-button"
          onClick={handleCycleLocale}
          title={t('top.langTitle')}
        >
          🌐 {LOCALE_NAMES[locale]}
        </button>
        <button
          className={`icon-button ${logsPanelOpen ? 'active' : ''} ${logsUnread ? 'unread' : ''}`}
          onClick={() => setLogsPanelOpen(!logsPanelOpen)}
          title={t('top.logsTitle')}
        >
          ⚠ {t('top.logs')}
        </button>
        <button
          className={`icon-button ${blueprintPanelOpen ? 'active' : ''}`}
          onClick={() => setBlueprintPanelOpen(!blueprintPanelOpen)}
          title={t('top.blueprintsTitle')}
        >
          ▤ {t('top.blueprints')}
        </button>
        <button
          className={`icon-button ${resultPanelOpen ? 'active' : ''}`}
          onClick={() => setResultPanelOpen(!resultPanelOpen)}
          title={t('top.resultsTitle')}
        >
          ▥ {t('top.results')}
        </button>
        <button className="icon-button" onClick={handleExport} title={t('top.exportTitle')}>
          ↓ {t('top.export')}
        </button>
        <button className="icon-button" onClick={handleImport} title={t('top.importTitle')}>
          ↑ {t('top.import')}
        </button>
        <button className="icon-button" onClick={handleLoadDemo} title={t('top.demoTitle')}>
          🎲 {t('top.demo')}
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
