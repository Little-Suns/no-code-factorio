import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './ui/App';
import { initPersist } from './state/persist';
import { initBlueprintPersist } from './state/blueprintPersist';
import { initLocalePersist } from './state/localePersist';
import { initTutorialPersist } from './state/tutorialPersist';

// Инициализировать персистентность (загрузить из localStorage, подписаться на сохранение)
initPersist();
initBlueprintPersist();
initLocalePersist();
initTutorialPersist();

const root = ReactDOM.createRoot(document.getElementById('root')!);
// Без StrictMode: двойной mount-эффект инициализировал бы Pixi дважды на одном canvas
root.render(<App />);
