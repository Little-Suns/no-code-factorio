// Check runner — импортирует все проверки из __checks__/
// Запускается: pnpm --filter web check

// _polyfill первым — некоторые связки tsx/Node не проставляют глобальный Web Crypto
// (crypto.randomUUID используется в core/engine.ts и core/blueprint.ts), а статические
// импорты ES-модулей выполняются в порядке объявления до остального кода этого файла.
import './_polyfill';
import './grid';
import './graph';
import './manipulator-intake';
import './rasterize';
import './tpl';
import './engine';
import './nodes';
import './demo';
import './blueprint';
import './blueprintLibrary';
import './stress';
import './manipulator-invariant';

console.log('✓ Check runner ready');
