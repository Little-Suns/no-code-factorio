import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './ui/App';
import { initPersist } from './state/persist';
import { initBlueprintPersist } from './state/blueprintPersist';

// Инициализировать персистентность (загрузить из localStorage, подписаться на сохранение)
initPersist();
initBlueprintPersist();

const root = ReactDOM.createRoot(document.getElementById('root')!);
// Без StrictMode: двойной mount-эффект инициализировал бы Pixi дважды на одном canvas
root.render(<App />);
