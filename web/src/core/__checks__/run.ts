// Check runner — импортирует все проверки из __checks__/
// Запускается: pnpm --filter web check

import './grid';
import './graph';
import './rasterize';
import './tpl';
import './engine';
import './nodes';
import './demo';
import './blueprint';
import './blueprintLibrary';
import './stress';

console.log('✓ Check runner ready');
